import asyncio
import io
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text, func
from sqlalchemy.exc import IntegrityError
import openpyxl

from app.database import Base, engine, get_db, SessionLocal
from app.models import Franchise, Player, AuctionState, AuditLog
from app import schemas, auction_engine, roll_parser
from app.websocket import manager

timer_task = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(
    title="Avanthi Cricket Carnival - Player Auction Portal",
    description="Authoritative auction system with financial validity, squad composition rules, real-time sync, and safe audit undo.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    global timer_task
    # Auto-migrate missing columns for existing SQLite database
    with engine.connect() as conn:
        # Franchises columns
        for col_name, col_type in [
            ("captain_name", "VARCHAR"),
            ("vice_captain_name", "VARCHAR"),
            ("vice_captain_mobile", "VARCHAR")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE franchises ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

        # Auction state columns
        for col_name, col_type in [
            ("timer_seconds", "INTEGER DEFAULT 30"),
            ("timer_duration_seconds", "INTEGER DEFAULT 30"),
            ("timer_running", "INTEGER DEFAULT 0"),
            ("draw_mode", "VARCHAR DEFAULT 'auto'"),
            ("passed_franchise_ids", "VARCHAR DEFAULT '[]'"),
            ("bucket_minimums_json", "VARCHAR DEFAULT '{\"B1\":2,\"B2\":2,\"B3\":2,\"B4\":2,\"B5\":2}'"),
            ("is_paused", "INTEGER DEFAULT 0"),
            ("round_number", "INTEGER DEFAULT 1")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE auction_state ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

    Base.metadata.create_all(bind=engine)
    from app.seed import seed_database
    seed_database()
    timer_task = asyncio.create_task(run_auction_timer())

@app.on_event("shutdown")
async def shutdown_event():
    if timer_task:
        timer_task.cancel()
        try:
            await timer_task
        except asyncio.CancelledError:
            pass

async def run_auction_timer():
    while True:
        await asyncio.sleep(1)
        db = SessionLocal()
        try:
            state = db.query(AuctionState).filter(AuctionState.id == 1).first()
            if state and state.timer_running and not state.is_paused and state.timer_seconds > 0:
                state.timer_seconds -= 1
                if state.timer_seconds <= 0:
                    state.timer_seconds = 0
                    state.timer_running = False
                db.commit()
                await broadcast_auction_state(db)
        except Exception:
            db.rollback()
            logger.exception("Auction timer tick failed")
        finally:
            db.close()

async def broadcast_auction_state(db: Session):
    state_data = get_auction_state_data(db)
    await manager.broadcast({
        "type": "AUCTION_STATE_UPDATE",
        "data": state_data
    })

def get_franchise_bucket_counts(db: Session, franchise_id: int) -> Dict[str, int]:
    # Counts auction purchases + retained + referred in each bucket
    players = db.query(Player).filter(
        (Player.sold_franchise_id == franchise_id) |
        (Player.retained_franchise_id == franchise_id) |
        (Player.referred_franchise_id == franchise_id)
    ).all()
    
    counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}
    for p in players:
        if p.bucket in counts:
            counts[p.bucket] += 1
    return counts

def get_franchise_auction_purchases_count(db: Session, franchise_id: int) -> int:
    # Only count auction purchases (sold_type in ['sold', 'allotted', 'scouted', 'direct_assigned'])
    return db.query(Player).filter(
        Player.sold_franchise_id == franchise_id,
        Player.sold_type.in_(["sold", "allotted", "scouted", "direct_assigned"])
    ).count()

def get_franchise_total_squad_count(db: Session, franchise_id: int) -> int:
    return db.query(Player).filter(
        (Player.sold_franchise_id == franchise_id) |
        (Player.retained_franchise_id == franchise_id) |
        (Player.referred_franchise_id == franchise_id)
    ).count()

def calculate_franchise_purse(db: Session, franchise_id: int) -> int:
    # Purse = 1000 - sum(sold_price of active non-undone sales)
    spent = 0
    sold_players = db.query(Player).filter(Player.sold_franchise_id == franchise_id).all()
    for p in sold_players:
        if p.sold_price and p.sold_type in ["sold", "allotted", "scouted", "direct_assigned"]:
            spent += p.sold_price
    return max(0, 1000 - spent)

def get_auction_state_data(db: Session) -> Dict[str, Any]:
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state:
        return {}

    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else auction_engine.DEFAULT_BUCKET_MINIMUMS
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []

    current_player = None
    if state.current_player_id:
        p = db.query(Player).filter(Player.id == state.current_player_id).first()
        if p:
            current_player = schemas.PublicPlayerResponse.from_orm(p).dict()

    current_bidder = None
    if state.current_bidder_id:
        f = db.query(Franchise).filter(Franchise.id == state.current_bidder_id).first()
        if f:
            current_bidder = schemas.PublicFranchiseResponse.from_orm(f).dict()

    # Calculate next required bid
    if state.current_bid_price > 0:
        next_bid = auction_engine.get_next_bid_increment(state.current_bid_price)
    elif current_player:
        next_bid = current_player["base_price"]
    else:
        next_bid = 20

    # Calculate scarcity warnings across all franchises
    franchises = db.query(Franchise).all()
    all_f_bucket_counts = []
    for f in franchises:
        all_f_bucket_counts.append(get_franchise_bucket_counts(db, f.id))

    # Calculate unsold available count per bucket
    unsold_counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}
    for b in unsold_counts:
        cnt = db.query(Player).filter(
            Player.bucket == b,
            Player.payment_status == "paid",
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None)
        ).count()
        unsold_counts[b] = cnt

    scarcity_warnings = auction_engine.calculate_scarcity_warnings(all_f_bucket_counts, unsold_counts, bucket_mins)

    return {
        "current_bucket": state.current_bucket,
        "current_player": current_player,
        "current_bid_price": state.current_bid_price,
        "current_bidder": current_bidder,
        "next_required_bid": next_bid,
        "timer_seconds": state.timer_seconds,
        "timer_duration_seconds": state.timer_duration_seconds,
        "timer_running": state.timer_running,
        "draw_mode": state.draw_mode,
        "passed_franchise_ids": passed_ids,
        "bucket_minimums": bucket_mins,
        "scarcity_warnings": scarcity_warnings,
        "is_paused": state.is_paused,
        "round_number": state.round_number
    }

# --- Roll Number Parser Endpoint ---

@app.get("/api/roll-parse")
def parse_roll(roll_number: str):
    return roll_parser.parse_roll_number(roll_number)

# --- Player Endpoints ---

@app.get("/api/players/public", response_model=List[schemas.PublicPlayerResponse])
def get_public_players(
    bucket: Optional[str] = None,
    course: Optional[str] = None,
    player_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Player)
    if bucket:
        query = query.filter(Player.bucket == bucket)
    if course:
        query = query.filter(Player.course == course)
    if player_type:
        query = query.filter(Player.derived_player_type == player_type)
    return query.all()

@app.get("/api/players/admin", response_model=List[schemas.AdminPlayerResponse])
def get_admin_players(db: Session = Depends(get_db)):
    return db.query(Player).all()

@app.post("/api/players/register", response_model=schemas.PublicPlayerResponse)
async def register_player(req: schemas.PlayerRegisterRequest, db: Session = Depends(get_db)):
    # Normalize identity fields before checking uniqueness. The database stores
    # roll numbers in uppercase and trims whitespace from both identity fields.
    normalized_roll_number = req.roll_number.strip().upper()
    normalized_mobile_number = req.mobile_number.strip()
    if not normalized_roll_number or not normalized_mobile_number:
        raise HTTPException(status_code=400, detail="Roll number and mobile number are required.")

    existing_roll = db.query(Player).filter(
        func.upper(func.trim(Player.roll_number)) == normalized_roll_number
    ).first()
    if existing_roll:
        raise HTTPException(status_code=409, detail="Roll number already registered.")

    existing_mobile = db.query(Player).filter(
        func.trim(Player.mobile_number) == normalized_mobile_number
    ).first()
    if existing_mobile:
        raise HTTPException(status_code=409, detail="Mobile number already registered.")

    parsed = roll_parser.parse_roll_number(normalized_roll_number)
    
    # Check CricHeroes profile pending rule (§5.2)
    profile_status = "completed"
    if not req.cricheroes_url or not req.cricheroes_mobile:
        profile_status = "profile_creation_pending"

    # Derive player type
    if req.is_wicket_keeper and req.is_skilled_batter:
        p_type = "Wicket-keeper batter"
    elif req.is_wicket_keeper:
        p_type = "Wicket-keeper"
    elif req.is_skilled_batter and req.is_skilled_bowler:
        p_type = "All-rounder"
    elif req.is_skilled_batter:
        p_type = "Batter"
    elif req.is_skilled_bowler:
        p_type = "Bowler"
    else:
        p_type = "Fielder"

    player = Player(
        roll_number=normalized_roll_number,
        name=req.name,
        mobile_number=normalized_mobile_number,
        photo_url=req.photo_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={normalized_roll_number}",
        course=parsed["course"],
        program=parsed["program"],
        branch=parsed["branch"],
        year_of_study=parsed["year_of_study"],
        bucket=parsed["bucket"],
        base_price=req.base_price,
        cricheroes_url=req.cricheroes_url,
        cricheroes_mobile=req.cricheroes_mobile,
        profile_status=profile_status,
        payment_status="unpaid", # SA marks paid
        is_skilled_batter=req.is_skilled_batter,
        batting_style=req.batting_style,
        preferred_batting_pos=req.preferred_batting_pos,
        batting_arm=req.batting_arm,
        is_skilled_bowler=req.is_skilled_bowler,
        bowling_arm=req.bowling_arm,
        bowling_type=req.bowling_type,
        pace_variety=req.pace_variety,
        spin_variety=req.spin_variety,
        bowling_roles=req.bowling_roles,
        is_wicket_keeper=req.is_wicket_keeper,
        fielding_zone=req.fielding_zone,
        preferred_fielding_pos=req.preferred_fielding_pos,
        highest_level_played=req.highest_level_played,
        played_acc_before=req.played_acc_before,
        previous_acc_team=req.previous_acc_team,
        derived_player_type=p_type,
        matches=req.matches,
        runs=req.runs,
        batting_avg=req.batting_avg,
        strike_rate=req.strike_rate,
        highest_score=req.highest_score,
        wickets=req.wickets,
        bowling_avg=req.bowling_avg,
        economy=req.economy,
        best_bowling=req.best_bowling,
        catches=req.catches,
        stumpings=req.stumpings,
        referring_team_name=req.referring_team_name
    )
    db.add(player)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Roll number or mobile number is already registered.")
    db.refresh(player)

    await broadcast_auction_state(db)
    return player

@app.get("/api/players/lookup", response_model=schemas.PlayerLookupResponse)
def lookup_player(query: str, db: Session = Depends(get_db)):
    q = query.strip().upper()
    player = db.query(Player).filter(
        (Player.roll_number == q) | (Player.mobile_number == q) | (Player.mobile_number == query.strip())
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player registration not found for the given Roll Number or Mobile Number.")

    assigned_f_id = player.sold_franchise_id or player.retained_franchise_id or player.referred_franchise_id
    franchise = db.query(Franchise).filter(Franchise.id == assigned_f_id).first() if assigned_f_id else None

    if player.sold_franchise_id:
        status = "SOLD"
    elif player.retained_franchise_id:
        status = "RETAINED"
    elif player.referred_franchise_id:
        status = "REFERRED"
    else:
        status = "UNASSIGNED"

    return {
        "player": schemas.PublicPlayerResponse.from_orm(player),
        "status": status,
        "team_name": franchise.name if franchise else None,
        "team_logo": franchise.logo_url if franchise else None,
        "sold_price": player.sold_price
    }

@app.post("/api/auction/timer-config")
async def update_timer_config(req: schemas.TimerSettingRequest, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state:
        raise HTTPException(status_code=404, detail="Auction state not found.")

    if req.duration_seconds is not None:
        state.timer_duration_seconds = max(5, req.duration_seconds)
        state.timer_seconds = state.timer_duration_seconds

    if req.action == "pause":
        state.is_paused = True
    elif req.action == "resume":
        state.is_paused = False
    elif req.action == "reset":
        state.timer_seconds = state.timer_duration_seconds
        state.timer_running = False
    elif req.action == "start":
        state.timer_seconds = state.timer_duration_seconds
        state.timer_running = True
        state.is_paused = False

    db.commit()
    await broadcast_auction_state(db)
    return {"message": "Timer settings updated", "timer_duration": state.timer_duration_seconds, "timer_seconds": state.timer_seconds}

@app.put("/api/players/{player_id}/pay")
async def mark_player_paid(player_id: int, paid: bool = True, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.payment_status = "paid" if paid else "unpaid"
    db.commit()
    await broadcast_auction_state(db)
    return {"message": f"Player {player.name} payment status set to {player.payment_status}"}

@app.put("/api/players/{player_id}/resolve-profile")
async def resolve_player_profile(player_id: int, cricheroes_url: str, cricheroes_mobile: str, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.cricheroes_url = cricheroes_url
    player.cricheroes_mobile = cricheroes_mobile
    player.profile_status = "completed"
    db.commit()
    await broadcast_auction_state(db)
    return {"message": f"Profile resolved for {player.name}"}

@app.put("/api/players/{player_id}/override-year")
async def override_player_year(player_id: int, override_year: int, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.year_override = override_year
    if player.course == "UG":
        player.bucket = f"B{override_year}"
    db.commit()
    
    log = AuditLog(
        action_type="YEAR_OVERRIDE",
        player_id=player.id,
        performed_by="Super Admin",
        reason=f"Manually overridden player year of study to {override_year} (Detained student correction)."
    )
    db.add(log)
    db.commit()

    await broadcast_auction_state(db)
    return {"message": f"Year override applied for {player.name} -> {player.bucket}"}

# --- Franchise Endpoints ---

@app.get("/api/franchises/public", response_model=List[schemas.PublicFranchiseResponse])
def get_public_franchises(db: Session = Depends(get_db)):
    franchises = db.query(Franchise).all()
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    bucket_mins = json.loads(state.bucket_minimums_json) if (state and state.bucket_minimums_json) else auction_engine.DEFAULT_BUCKET_MINIMUMS

    result = []
    for f in franchises:
        b_counts = get_franchise_bucket_counts(db, f.id)
        purchases_cnt = get_franchise_auction_purchases_count(db, f.id)
        total_squad_cnt = get_franchise_total_squad_count(db, f.id)
        current_purse = calculate_franchise_purse(db, f.id)

        # Calculate max permissible bid for current lot player if active
        max_bid = auction_engine.calculate_max_permissible_bid(
            purse=current_purse,
            auction_purchases_count=purchases_cnt,
            bucket_counts=b_counts,
            bucket_minimums=bucket_mins
        )

        mand_slots_needed = auction_engine.calculate_mandatory_slots_needed(b_counts, bucket_mins)

        f_resp = schemas.PublicFranchiseResponse(
            id=f.id,
            name=f.name,
            short_code=f.short_code,
            logo_url=f.logo_url,
            faculty_coordinator_name=f.faculty_coordinator_name,
            faculty_coordinator_dept=f.faculty_coordinator_dept,
            faculty_coordinator_photo=f.faculty_coordinator_photo,
            purse=current_purse,
            squad_count=total_squad_cnt,
            auction_purchases_count=purchases_cnt,
            max_permissible_bid=max_bid,
            bucket_counts=b_counts,
            mandatory_slots_needed=mand_slots_needed,
            is_blocked=(current_purse < 20 or max_bid <= 0)
        )
        result.append(f_resp)
    return result

@app.get("/api/franchises/admin", response_model=List[schemas.AdminFranchiseResponse])
def get_admin_franchises(db: Session = Depends(get_db)):
    public_f = get_public_franchises(db)
    result = []
    for pf in public_f:
        f = db.query(Franchise).filter(Franchise.id == pf.id).first()
        af = schemas.AdminFranchiseResponse(
            **pf.dict(),
            faculty_coordinator_mobile=f.faculty_coordinator_mobile if f else "",
            captain_mobile=f.captain_mobile if f else None,
            vice_captain_mobile=f.vice_captain_mobile if f else None
        )
        result.append(af)
    return result

@app.post("/api/franchises/register", response_model=schemas.PublicFranchiseResponse)
async def register_franchise(req: schemas.FranchiseRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Franchise).filter(
        (Franchise.name == req.name) | (Franchise.short_code == req.short_code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Franchise name or code already exists.")

    franchise = Franchise(
        name=req.name,
        short_code=req.short_code.upper(),
        logo_url=req.logo_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={req.short_code}",
        faculty_coordinator_name=req.faculty_coordinator_name,
        faculty_coordinator_dept=req.faculty_coordinator_dept,
        faculty_coordinator_photo=req.faculty_coordinator_photo,
        faculty_coordinator_mobile=req.faculty_coordinator_mobile,
        captain_name=req.captain_name,
        captain_mobile=req.captain_mobile,
        vice_captain_name=req.vice_captain_name,
        vice_captain_mobile=req.vice_captain_mobile,
        purse=1000
    )
    db.add(franchise)
    db.commit()
    db.refresh(franchise)
    await broadcast_auction_state(db)
    return get_public_franchises(db)[-1]

# --- Auction Core Mechanics Endpoints ---

@app.get("/api/auction/state")
def get_auction_state(db: Session = Depends(get_db)):
    return get_auction_state_data(db)

@app.post("/api/auction/bid")
async def place_bid(req: schemas.BidRequest, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active player up for auction.")

    player = db.query(Player).filter(Player.id == state.current_player_id).first()
    franchise = db.query(Franchise).filter(Franchise.id == req.franchise_id).first()
    if not player or not franchise:
        raise HTTPException(status_code=404, detail="Player or Franchise not found.")

    if not state.timer_running or state.timer_seconds <= 0:
        raise HTTPException(status_code=400, detail="Bidding is closed for this lot.")

    # 1. Price increment check (§11, Appendix A.6)
    valid_price, price_msg = auction_engine.validate_bid_price(state.current_bid_price, player.base_price, req.attempted_bid)
    if not valid_price:
        raise HTTPException(status_code=400, detail=price_msg)

    # 2. Bucket eligibility check (§12.2)
    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else auction_engine.DEFAULT_BUCKET_MINIMUMS
    b_counts = get_franchise_bucket_counts(db, franchise.id)
    purchases_cnt = get_franchise_auction_purchases_count(db, franchise.id)
    total_squad_cnt = get_franchise_total_squad_count(db, franchise.id)

    eligible, elig_msg = auction_engine.check_bucket_eligibility(
        total_squad_count=total_squad_cnt,
        auction_purchases_count=purchases_cnt,
        bucket_counts=b_counts,
        target_player_bucket=player.bucket,
        bucket_minimums=bucket_mins
    )
    if not eligible:
        raise HTTPException(status_code=400, detail=elig_msg)

    # 3. Financial validity check (§12.1)
    current_purse = calculate_franchise_purse(db, franchise.id)
    max_bid = auction_engine.calculate_max_permissible_bid(
        purse=current_purse,
        auction_purchases_count=purchases_cnt,
        bucket_counts=b_counts,
        bucket_minimums=bucket_mins,
        player_bucket=player.bucket
    )

    if req.attempted_bid > max_bid:
        raise HTTPException(status_code=400, detail=f"Blocked — bid of {req.attempted_bid} exceeds maximum permissible bid of {max_bid} for {franchise.name}.")

    # Every accepted bid restarts the auctioneer-configured countdown.
    state.current_bid_price = req.attempted_bid
    state.current_bidder_id = franchise.id
    state.timer_seconds = state.timer_duration_seconds
    state.timer_running = True

    # Log action
    log = AuditLog(
        action_type="BID",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=req.attempted_bid,
        performed_by=f"Franchise:{franchise.short_code}" if req.performed_by == "Franchise" else req.performed_by,
        reason=f"Bid placed on {player.name} at {req.attempted_bid}"
    )
    db.add(log)
    db.commit()

    await broadcast_auction_state(db)
    return {"message": "Bid accepted", "new_bid": req.attempted_bid, "franchise": franchise.name}

@app.post("/api/auction/pass")
async def pass_franchise(franchise_id: int, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []
    if franchise_id not in passed_ids:
        passed_ids.append(franchise_id)
        state.passed_franchise_ids = json.dumps(passed_ids)
        db.commit()

        log = AuditLog(
            action_type="PASS",
            player_id=state.current_player_id,
            franchise_id=franchise_id,
            performed_by="Franchise",
            reason="Franchise passed on current lot"
        )
        db.add(log)
        db.commit()

    await broadcast_auction_state(db)
    return {"message": "Franchise passed"}

@app.post("/api/auction/unpass")
async def unpass_franchise(franchise_id: int, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []
    if franchise_id in passed_ids:
        passed_ids.remove(franchise_id)
        state.passed_franchise_ids = json.dumps(passed_ids)
        db.commit()

        log = AuditLog(
            action_type="UNPASS",
            player_id=state.current_player_id,
            franchise_id=franchise_id,
            performed_by="Franchise",
            reason="Franchise re-entered bidding"
        )
        db.add(log)
        db.commit()

    await broadcast_auction_state(db)
    return {"message": "Franchise re-entered play"}

@app.post("/api/auction/hammer")
async def hammer_lot(performed_by: str = "Super Admin", db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active lot to hammer.")

    player = db.query(Player).filter(Player.id == state.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")

    if state.current_bidder_id and state.current_bid_price > 0:
        # Sold!
        franchise = db.query(Franchise).filter(Franchise.id == state.current_bidder_id).first()
        player.sold_franchise_id = franchise.id
        player.sold_price = state.current_bid_price
        player.sold_type = "sold"

        log = AuditLog(
            action_type="HAMMER_SOLD",
            player_id=player.id,
            franchise_id=franchise.id,
            amount=state.current_bid_price,
            performed_by=performed_by,
            reason=f"Hammer pressed — {player.name} SOLD to {franchise.name} for {state.current_bid_price} credits."
        )
        db.add(log)
        res_msg = f"{player.name} SOLD to {franchise.name} for {state.current_bid_price}"
    else:
        # Unsold!
        player.is_skipped = True
        log = AuditLog(
            action_type="HAMMER_UNSOLD",
            player_id=player.id,
            performed_by=performed_by,
            reason=f"Hammer pressed — {player.name} UNSOLD."
        )
        db.add(log)
        res_msg = f"{player.name} UNSOLD"

    db.commit()

    # Automatically draw next player in bucket
    await draw_next_player_internal(db, state)
    await broadcast_auction_state(db)

    return {"message": res_msg}

@app.post("/api/auction/skip")
async def skip_player(performed_by: str = "Super Admin", db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active player to skip.")

    player = db.query(Player).filter(Player.id == state.current_player_id).first()
    player.is_skipped = True
    
    log = AuditLog(
        action_type="SKIP",
        player_id=player.id,
        performed_by=performed_by,
        reason=f"Player {player.name} skipped to end of bucket."
    )
    db.add(log)
    db.commit()

    await draw_next_player_internal(db, state)
    await broadcast_auction_state(db)
    return {"message": f"Skipped {player.name}"}

@app.post("/api/auction/undo")
async def undo_transaction(req: schemas.UndoRequest, db: Session = Depends(get_db)):
    audit_entry = db.query(AuditLog).filter(AuditLog.id == req.audit_id).first()
    if not audit_entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found.")

    if audit_entry.is_undone:
        # Appendix A.4 Case 18: Same sale undone twice -> Second attempt rejected
        raise HTTPException(status_code=400, detail="Second attempt rejected — sale has already been undone.")

    # Mark as undone
    audit_entry.is_undone = True

    # Reverse player squad assignment if HAMMER_SOLD or DIRECT_ASSIGN
    if audit_entry.action_type in ["HAMMER_SOLD", "DIRECT_ASSIGN", "ALLOT"]:
        player = db.query(Player).filter(Player.id == audit_entry.player_id).first()
        if player:
            player.sold_franchise_id = None
            player.sold_price = None
            player.sold_type = None

    undo_log = AuditLog(
        action_type="UNDO",
        player_id=audit_entry.player_id,
        franchise_id=audit_entry.franchise_id,
        amount=audit_entry.amount,
        performed_by="Super Admin",
        reason=f"UNDONE Audit ID {audit_entry.id}: {req.reason}"
    )
    db.add(undo_log)
    db.commit()

    await broadcast_auction_state(db)
    return {"message": f"Successfully undone Audit Entry #{audit_entry.id}. All pursed, slots, and limits recalculated."}

@app.post("/api/auction/direct-assign")
async def direct_assign_player(req: schemas.DirectAssignRequest, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == req.player_id).first()
    franchise = db.query(Franchise).filter(Franchise.id == req.franchise_id).first()
    if not player or not franchise:
        raise HTTPException(status_code=404, detail="Player or Franchise not found.")

    player.sold_franchise_id = franchise.id
    player.sold_price = req.price
    player.sold_type = "direct_assigned"

    log = AuditLog(
        action_type="DIRECT_ASSIGN",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=req.price,
        performed_by="Super Admin",
        reason=req.reason
    )
    db.add(log)
    db.commit()

    await broadcast_auction_state(db)
    return {"message": f"Directly assigned {player.name} to {franchise.name} for {req.price} credits."}

@app.post("/api/auction/relax-minimum")
async def relax_bucket_minimum(req: schemas.RelaxMinimumRequest, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else dict(auction_engine.DEFAULT_BUCKET_MINIMUMS)
    
    bucket_mins[req.bucket] = req.new_minimum
    state.bucket_minimums_json = json.dumps(bucket_mins)

    log = AuditLog(
        action_type="RELAX_MINIMUM",
        performed_by="Super Admin",
        reason=f"Uniform relaxation of bucket {req.bucket} minimum to {req.new_minimum} across all franchises: {req.reason}"
    )
    db.add(log)
    db.commit()

    await broadcast_auction_state(db)
    return {"message": f"Relaxed bucket {req.bucket} minimum to {req.new_minimum} uniformly for all 11 franchises."}

async def draw_next_player_internal(db: Session, state: AuctionState):
    # Bucket sequence: B3 -> B4 -> B2 -> B5 -> B1 -> PG
    bucket_sequence = ["B3", "B4", "B2", "B5", "B1", "PG"]

    curr_idx = bucket_sequence.index(state.current_bucket) if state.current_bucket in bucket_sequence else 0

    # Search for next available player in current bucket
    next_player = db.query(Player).filter(
        Player.bucket == state.current_bucket,
        Player.payment_status == "paid",
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
        Player.is_skipped == False
    ).order_by(Player.random_lot_number.asc()).first()

    # If no unskipped player, search skipped players in current bucket
    if not next_player:
        next_player = db.query(Player).filter(
            Player.bucket == state.current_bucket,
            Player.payment_status == "paid",
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None)
        ).order_by(Player.random_lot_number.asc()).first()

    # If bucket completed, advance to next bucket in sequence
    if not next_player and curr_idx + 1 < len(bucket_sequence):
        state.current_bucket = bucket_sequence[curr_idx + 1]
        next_player = db.query(Player).filter(
            Player.bucket == state.current_bucket,
            Player.payment_status == "paid",
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None)
        ).order_by(Player.random_lot_number.asc()).first()

    if next_player:
        state.current_player_id = next_player.id
        state.current_bid_price = 0
        state.current_bidder_id = None
        state.timer_seconds = state.timer_duration_seconds or 30
        state.timer_running = False
        state.passed_franchise_ids = "[]"
    else:
        state.current_player_id = None
        state.current_bid_price = 0
        state.current_bidder_id = None

    db.commit()

@app.post("/api/auction/draw-next")
async def draw_next_player(db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    await draw_next_player_internal(db, state)
    await broadcast_auction_state(db)
    return {"message": "Drawn next player"}

@app.post("/api/auction/set-bucket")
async def set_active_bucket(bucket: str = Query(...), db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    if not state:
        raise HTTPException(status_code=404, detail="Auction state not found.")
    state.current_bucket = bucket.upper()
    db.commit()
    await draw_next_player_internal(db, state)
    await broadcast_auction_state(db)
    return {"message": f"Active bucket set to {state.current_bucket} and player drawn."}

@app.post("/api/auction/select-player")
async def select_player_for_lot(player_id: int = Query(...), db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).first()
    player = db.query(Player).filter(Player.id == player_id).first()
    if not state or not player:
        raise HTTPException(status_code=404, detail="Auction state or Player not found.")
    
    state.current_player_id = player.id
    state.current_bucket = player.bucket
    state.current_bid_price = 0
    state.current_bidder_id = None
    state.timer_seconds = state.timer_duration_seconds or 30
    state.timer_running = False
    state.passed_franchise_ids = "[]"
    db.commit()
    await broadcast_auction_state(db)
    return {"message": f"Player {player.name} ({player.roll_number}) set as active lot."}

@app.get("/api/audit-log")
def get_audit_log(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).all()

@app.get("/api/export/excel")
def export_tournament_excel(db: Session = Depends(get_db)):
    wb = openpyxl.Workbook()
    
    # Sheet 1: Franchises & Squads
    ws1 = wb.active
    ws1.title = "Franchises & Squads"
    ws1.append(["Franchise Name", "Code", "Faculty Coordinator", "Purse Remaining", "Squad Count", "Captain", "Vice Captain"])

    franchises = db.query(Franchise).all()
    for f in franchises:
        cap = db.query(Player).filter(Player.retained_franchise_id == f.id, Player.retained_role == "captain").first()
        vc = db.query(Player).filter(Player.retained_franchise_id == f.id, Player.retained_role == "vice_captain").first()
        purse = calculate_franchise_purse(db, f.id)
        squad_cnt = get_franchise_total_squad_count(db, f.id)
        
        ws1.append([
            f.name,
            f.short_code,
            f.faculty_coordinator_name,
            purse,
            squad_cnt,
            cap.name if cap else "N/A",
            vc.name if vc else "N/A"
        ])

    # Sheet 2: All Players
    ws2 = wb.create_sheet(title="All Players")
    ws2.append(["Roll Number", "Name", "Course", "Branch", "Year", "Bucket", "Base Price", "Sold Price", "Sold Franchise", "Sale Type"])

    players = db.query(Player).all()
    for p in players:
        sold_f = db.query(Franchise).filter(Franchise.id == (p.sold_franchise_id or p.retained_franchise_id or p.referred_franchise_id)).first()
        ws2.append([
            p.roll_number,
            p.name,
            p.course,
            p.branch,
            p.year_of_study,
            p.bucket,
            p.base_price,
            p.sold_price or 0,
            sold_f.name if sold_f else "Unsold",
            p.sold_type or ("Retained" if p.retained_franchise_id else "Unsold")
        ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    headers = {"Content-Disposition": "attachment; filename=Avanthi_Cricket_Carnival_Auction_Data.xlsx"}
    return StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)

# --- WebSocket Endpoint ---

@app.websocket("/ws/auction")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    try:
        # Send initial state on connection
        await websocket.send_json({
            "type": "AUCTION_STATE_UPDATE",
            "data": get_auction_state_data(db)
        })
        while True:
            data = await websocket.receive_text()
            # Handle client heartbeats if any
    except WebSocketDisconnect:
        manager.disconnect(websocket)


