import asyncio
import base64
import binascii
import io
import json
import logging
import os
import re
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text, func
from sqlalchemy.exc import IntegrityError
import openpyxl
from pydantic import BaseModel

from app.database import Base, engine, get_db, SessionLocal, DATABASE_URL
from app.models import Franchise, Player, AuctionState, AuditLog
from app import auth, schemas, auction_engine, roll_parser
from app.websocket import manager

timer_task = None
app_event_loop = None
state_broadcast_lock = asyncio.Lock()
pending_state_broadcasts = set()
MAX_PHOTO_SIZE_BYTES = 300 * 1024
PHOTO_DATA_URL_PATTERN = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$")


class PhotoUploadRequest(BaseModel):
    photo_data: str


class LoginRequest(BaseModel):
    username: str
    password: str


def validate_photo_data(photo_data: str) -> bytes:
    if photo_data.startswith("http://") or photo_data.startswith("https://"):
        return b""
    photo_match = PHOTO_DATA_URL_PATTERN.fullmatch(photo_data)
    if not photo_match:
        raise HTTPException(status_code=400, detail="Photo must be uploaded as an image file.")
    try:
        photo_bytes = base64.b64decode(photo_match.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid photo data.")
    if len(photo_bytes) >= MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Photo size must be 300 KB or less.")
    return photo_bytes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")


def audit_actor(request: Request, fallback: str) -> str:
    claims = getattr(getattr(request, "state", None), "user", {})
    if claims.get("role") and claims.get("sub"):
        return f"{claims['role']}:{claims['sub']}"
    return fallback

app = FastAPI(
    title="Avanthi Cricket Carnival - Player Auction Portal",
    description="Authoritative auction system with financial validity, squad composition rules, real-time sync, and safe audit undo.",
    version="1.0.0"
)


@app.middleware("http")
async def authorization_middleware(request: Request, call_next):
    return await auth.enforce_api_permissions(request, call_next)


cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
if cors_origins_raw == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_production_configuration():
    if os.getenv("APP_ENV", "development").lower() != "production":
        return

    auth_secret = os.getenv("AUCTION_AUTH_SECRET", "")
    if len(auth_secret) < 32:
        raise RuntimeError("AUCTION_AUTH_SECRET must contain at least 32 characters in production.")
    if not DATABASE_URL.startswith("postgresql://"):
        raise RuntimeError("Set DATABASE_URL to persistent PostgreSQL storage in production.")
    if not origins or "*" in origins:
        raise RuntimeError("Set CORS_ORIGINS to the deployed frontend origin in production.")

    try:
        configured_users = json.loads(os.getenv("AUCTION_AUTH_USERS", "[]"))
    except json.JSONDecodeError as error:
        raise RuntimeError("AUCTION_AUTH_USERS must be a valid JSON array in production.") from error
    if not isinstance(configured_users, list) or not any(
        isinstance(user, dict)
        and user.get("username")
        and user.get("password")
        and user.get("role") in auth.ALLOWED_ROLES
        for user in configured_users
    ):
        raise RuntimeError("Configure at least one valid account in AUCTION_AUTH_USERS for production.")


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    return auth.login(req.username, req.password)


@app.api_route("/health", methods=["GET", "HEAD"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as error:
        logger.exception("Health check database query failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    global timer_task, app_event_loop
    app_event_loop = asyncio.get_running_loop()
    validate_production_configuration()
    # Create database schema first if tables do not exist
    Base.metadata.create_all(bind=engine)

    # Add legacy columns with types compatible with the configured database.
    boolean_default = "BOOLEAN DEFAULT FALSE" if engine.dialect.name == "postgresql" else "BOOLEAN DEFAULT 0"
    legacy_columns = {
        "players": [
            ("skip_recalled", boolean_default),
            ("round_one_complete", boolean_default),
            ("round_two_complete", boolean_default),
            ("year_discrepancy_reported", boolean_default),
        ],
        "franchises": [
            ("captain_name", "VARCHAR"),
            ("vice_captain_name", "VARCHAR"),
            ("vice_captain_mobile", "VARCHAR"),
        ],
        "auction_state": [
            ("timer_seconds", "INTEGER DEFAULT 30"),
            ("timer_duration_seconds", "INTEGER DEFAULT 30"),
            ("timer_running", boolean_default),
            ("draw_mode", "VARCHAR DEFAULT 'auto'"),
            ("passed_franchise_ids", "VARCHAR DEFAULT '[]'"),
            ("bucket_minimums_json", "VARCHAR DEFAULT '{\"B1\":2,\"B2\":2,\"B3\":2,\"B4\":2,\"B5\":2}'"),
            ("is_paused", boolean_default),
            ("round_number", "INTEGER DEFAULT 1"),
        ],
    }
    boolean_columns = {"timer_running", "is_paused"}
    with engine.begin() as conn:
        for table_name, columns in legacy_columns.items():
            existing_columns = {
                column["name"]: column for column in inspect(conn).get_columns(table_name)
            }
            for column_name, column_type in columns:
                existing_column = existing_columns.get(column_name)
                if existing_column is None:
                    conn.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                    ))
                elif (
                    engine.dialect.name == "postgresql"
                    and column_name in boolean_columns
                    and "INT" in str(existing_column["type"]).upper()
                ):
                    conn.execute(text(
                        f"ALTER TABLE {table_name} ALTER COLUMN {column_name} "
                        f"TYPE BOOLEAN USING {column_name} <> 0"
                    ))

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

def _advance_auction_timer():
    """Run the blocking SQLAlchemy timer tick outside the asyncio event loop."""
    db = SessionLocal()
    try:
        state = get_or_create_auction_state(db)
        if not state or not state.timer_running or state.is_paused or state.timer_seconds <= 0:
            return None
        state.timer_seconds -= 1
        if state.timer_seconds <= 0:
            state.timer_seconds = 0
            state.timer_running = False
        db.commit()
        return {
            "timer_seconds": state.timer_seconds,
            "timer_running": state.timer_running,
            "is_paused": state.is_paused,
        }
    except Exception:
        db.rollback()
        logger.exception("Auction timer tick failed")
        return None
    finally:
        db.close()


async def run_auction_timer():
    while True:
        await asyncio.sleep(1)
        timer_data = await asyncio.to_thread(_advance_auction_timer)
        if timer_data is not None:
            await broadcast_auction_timer(timer_data)

def _load_latest_auction_state_data():
    """Load the blocking database payload in a worker thread."""
    db = SessionLocal()
    try:
        return get_auction_state_data(db)
    finally:
        db.close()


async def broadcast_auction_state():
    state_data = await asyncio.to_thread(_load_latest_auction_state_data)
    await manager.broadcast({
        "type": "AUCTION_STATE_UPDATE",
        "data": state_data
    })


async def _broadcast_latest_auction_state():
    async with state_broadcast_lock:
        try:
            await broadcast_auction_state()
        except Exception:
            logger.exception("Auction state broadcast failed")


def _launch_state_broadcast():
    task = asyncio.create_task(_broadcast_latest_auction_state())
    pending_state_broadcasts.add(task)
    task.add_done_callback(pending_state_broadcasts.discard)


def schedule_auction_state_broadcast():
    loop = app_event_loop
    if loop is not None and not loop.is_closed():
        loop.call_soon_threadsafe(_launch_state_broadcast)


async def broadcast_auction_timer(timer_data: Dict[str, Any]):
    """Send lightweight timer ticks without rebuilding the full auction payload."""
    await manager.broadcast({
        "type": "AUCTION_TIMER_UPDATE",
        "data": timer_data,
    })

def normalize_bucket_name(raw_bucket: Optional[str]) -> str:
    if not raw_bucket:
        return "B3"
    b = str(raw_bucket).strip().upper()
    if b in {"B1", "B2", "B3", "B4", "B5", "PG"}:
        return b
    if b.startswith("BUCKET"):
        num = b.replace("BUCKET", "").strip()
        if num in {"1", "2", "3", "4", "5"}:
            return f"B{num}"
    if b in {"1", "2", "3", "4", "5"}:
        return f"B{b}"
    if "1" in b: return "B1"
    if "2" in b: return "B2"
    if "3" in b: return "B3"
    if "4" in b: return "B4"
    if "5" in b: return "B5"
    if "PG" in b: return "PG"
    return "B3"

def get_franchise_bucket_counts(db: Session, franchise_id: int) -> Dict[str, int]:
    # Squad quotas count only auction purchases; retained and referred players are free.
    players = db.query(Player).filter(
        Player.sold_franchise_id == franchise_id,
        (Player.sold_type.is_(None) | ~Player.sold_type.in_(["retained", "referred"])),
    ).all()
    
    counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}
    for p in players:
        b = normalize_bucket_name(p.bucket)
        if b in counts:
            counts[b] += 1
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

def get_franchise_stats(db: Session, franchise_ids: List[int]):
    """Calculate public squad totals in one player query, not four per franchise."""
    stats = {
        franchise_id: {
            "bucket_counts": {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0},
            "purchases": 0,
            "squad_count": 0,
            "purse": 1000,
        }
        for franchise_id in franchise_ids
    }
    unsold_counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}
    if not stats:
        return stats, unsold_counts

    active_sale_types = {"sold", "allotted", "scouted", "direct_assigned"}
    excluded_bucket_types = {"retained", "referred"}
    player_rows = db.query(
        Player.sold_franchise_id,
        Player.retained_franchise_id,
        Player.referred_franchise_id,
        Player.sold_type,
        Player.sold_price,
        Player.bucket,
        Player.payment_status,
    ).all()

    for row in player_rows:
        sold_id = row.sold_franchise_id
        sale_is_active = row.sold_type in active_sale_types
        if sold_id in stats:
            franchise_stats = stats[sold_id]
            if sale_is_active:
                franchise_stats["purchases"] += 1
                franchise_stats["purse"] -= row.sold_price or 0
            if row.sold_type is None or row.sold_type not in excluded_bucket_types:
                bucket = normalize_bucket_name(row.bucket)
                if bucket in franchise_stats["bucket_counts"]:
                    franchise_stats["bucket_counts"][bucket] += 1

        for franchise_id in {
            row.sold_franchise_id,
            row.retained_franchise_id,
            row.referred_franchise_id,
        } & stats.keys():
            stats[franchise_id]["squad_count"] += 1

        if (
            row.payment_status == "paid"
            and sold_id is None
            and row.retained_franchise_id is None
            and row.referred_franchise_id is None
        ):
            bucket = row.bucket
            if bucket in unsold_counts:
                unsold_counts[bucket] += 1

    for franchise_stats in stats.values():
        franchise_stats["purse"] = max(0, franchise_stats["purse"])
    return stats, unsold_counts

def get_or_create_auction_state(db: Session) -> AuctionState:
    state = db.query(AuctionState).first()
    if not state:
        first_player = db.query(Player).filter(
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None)
        ).first()
        state = AuctionState(
            id=1,
            current_bucket=first_player.bucket if first_player else "B3",
            current_player_id=first_player.id if first_player else None,
            current_bid_price=0,
            current_bidder_id=None,
            timer_seconds=30,
            timer_duration_seconds=30,
            timer_running=False,
            draw_mode="auto",
            passed_franchise_ids="[]",
            bucket_minimums_json='{"B1":2,"B2":2,"B3":2,"B4":2,"B5":2}',
            is_paused=False,
            round_number=1
        )
        db.add(state)
        db.commit()
        db.refresh(state)
    return state

def get_auction_state_data(db: Session) -> Dict[str, Any]:
    state = get_or_create_auction_state(db)
    if not state.current_player_id:
        unassigned = db.query(Player).filter(
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None)
        ).first()
        if unassigned:
            state.current_player_id = unassigned.id
            state.current_bucket = unassigned.bucket
            db.commit()
            db.refresh(state)

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
    if state.current_bidder_id and state.current_bid_price > 0:
        next_bid = auction_engine.get_next_bid_increment(state.current_bid_price)
    elif current_player:
        next_bid = current_player["base_price"]
    else:
        next_bid = 20

    # Calculate scarcity warnings across all franchises
    franchises = db.query(Franchise).all()
    franchise_stats, unsold_counts = get_franchise_stats(db, [f.id for f in franchises])
    all_f_bucket_counts = [franchise_stats[f.id]["bucket_counts"] for f in franchises]

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
def register_player(req: schemas.PlayerRegisterRequest, db: Session = Depends(get_db)):
    if not req.photo_url:
        raise HTTPException(status_code=400, detail="A player photograph is required.")
    validate_photo_data(req.photo_url)
    allowed_base_prices = {20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 230, 250}
    if req.base_price not in allowed_base_prices:
        raise HTTPException(status_code=400, detail="Base price must use an allowed price-ladder value.")
    if not (req.is_skilled_batter or req.is_skilled_bowler or req.is_wicket_keeper or req.confirm_fielder_only):
        raise HTTPException(status_code=400, detail="Confirm Fielder-only registration or declare a cricketing skill.")

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
    if not parsed["valid"]:
        if not normalized_roll_number.startswith("PG"):
            raise HTTPException(status_code=400, detail=parsed["formatted_summary"])
        if (
            req.program not in {"M.Tech", "MBA", "MCA"}
            or not req.branch or not req.branch.strip()
            or req.year_of_study not in {1, 2}
            or req.admission_year is None
            or not 2000 <= req.admission_year <= roll_parser.CURRENT_ACADEMIC_YEAR
        ):
            raise HTTPException(status_code=400, detail="PG registrations require program, specialization, study year, and admission year.")
        parsed.update({
            "program": req.program,
            "branch": req.branch.strip(),
            "year_of_study": req.year_of_study,
            "admission_year": req.admission_year,
            "show_acc_reference": req.admission_year == roll_parser.CURRENT_ACADEMIC_YEAR,
        })
    
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
        year_discrepancy_reported=req.year_discrepancy_reported,
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
        referring_team_name=req.referring_team_name if parsed["show_acc_reference"] else None
    )
    max_lot_number = db.query(func.max(Player.random_lot_number)).filter(Player.bucket == parsed["bucket"]).scalar()
    player.random_lot_number = (max_lot_number or 0) + 1
    db.add(player)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Roll number or mobile number is already registered.")
    db.refresh(player)

    schedule_auction_state_broadcast()
    return player


@app.put("/api/players/{player_id}/photo")
def upload_player_photo(player_id: int, req: PhotoUploadRequest, db: Session = Depends(get_db)):
    validate_photo_data(req.photo_data)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.photo_url = req.photo_data
    db.commit()
    schedule_auction_state_broadcast()
    return {"photo_url": player.photo_url}

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
def update_timer_config(req: schemas.TimerSettingRequest, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)

    if req.duration_seconds is not None:
        expected_duration = 20 if state.current_bidder_id else 30
        if req.duration_seconds != expected_duration:
            raise HTTPException(status_code=400, detail=f"Timer duration is fixed at {expected_duration} seconds for this bidding phase.")
        state.timer_duration_seconds = expected_duration
        state.timer_seconds = expected_duration

    if req.action == "pause":
        state.is_paused = True
    elif req.action == "resume":
        state.is_paused = False
    elif req.action in {"reset", "stop"}:
        state.timer_seconds = state.timer_duration_seconds
        state.timer_running = False
        state.is_paused = False
    elif req.action == "start":
        state.timer_seconds = state.timer_duration_seconds
        state.timer_running = True
        state.is_paused = False

    db.add(AuditLog(
        action_type="TIMER_CONFIG",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Timer action={req.action or 'configure'}, duration={state.timer_duration_seconds} seconds.",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": "Timer settings updated", "timer_duration": state.timer_duration_seconds, "timer_seconds": state.timer_seconds}

@app.put("/api/players/{player_id}/pay")
def mark_player_paid(player_id: int, request: Request, paid: bool = True, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if paid and player.profile_status != "completed":
        raise HTTPException(status_code=400, detail="Resolve the CricHeroes profile before marking this player as paid.")
    player.payment_status = "paid" if paid else "unpaid"
    db.add(AuditLog(
        action_type="PLAYER_PAID" if paid else "PLAYER_UNPAID",
        player_id=player.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Payment status set to {player.payment_status}.",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Player {player.name} payment status set to {player.payment_status}"}

@app.put("/api/players/{player_id}/resolve-profile")
def resolve_player_profile(player_id: int, cricheroes_url: str, cricheroes_mobile: str, request: Request, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.cricheroes_url = cricheroes_url
    player.cricheroes_mobile = cricheroes_mobile
    player.profile_status = "completed"
    db.add(AuditLog(
        action_type="PROFILE_RESOLVED",
        player_id=player.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason="CricHeroes profile details verified.",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Profile resolved for {player.name}"}

@app.put("/api/players/{player_id}/override-year")
def override_player_year(player_id: int, override_year: int, request: Request, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    valid_years = {"UG": {1, 2, 3, 4}, "Diploma": {1, 2, 3}, "PG": {1, 2}}
    if override_year not in valid_years.get(player.course, set()):
        raise HTTPException(status_code=400, detail="Override year is outside the player's supported course years.")
    player.year_override = override_year
    player.year_of_study = override_year
    player.year_discrepancy_reported = False
    if player.course == "UG":
        player.bucket = f"B{override_year}"
    log = AuditLog(
        action_type="YEAR_OVERRIDE",
        player_id=player.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Manually overridden player year of study to {override_year} (Detained student correction)."
    )
    db.add(log)
    db.commit()

    schedule_auction_state_broadcast()
    return {"message": f"Year override applied for {player.name} -> {player.bucket}"}


@app.put("/api/players/{player_id}")
def update_player(player_id: int, req: schemas.PlayerUpdateRequest, request: Request, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if req.roll_number and req.roll_number.strip().upper() != player.roll_number:
        new_roll = req.roll_number.strip().upper()
        existing = db.query(Player).filter(Player.roll_number == new_roll, Player.id != player_id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Another player with this roll number already exists.")
        player.roll_number = new_roll

    if req.mobile_number and req.mobile_number.strip() != player.mobile_number:
        new_mobile = req.mobile_number.strip()
        existing = db.query(Player).filter(Player.mobile_number == new_mobile, Player.id != player_id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Another player with this mobile number already exists.")
        player.mobile_number = new_mobile

    if req.photo_url:
        validate_photo_data(req.photo_url)
        player.photo_url = req.photo_url

    if req.name is not None: player.name = req.name.strip()
    if req.course is not None: player.course = req.course.strip()
    if req.program is not None: player.program = req.program.strip()
    if req.branch is not None: player.branch = req.branch.strip()
    if req.year_of_study is not None: player.year_of_study = req.year_of_study
    if req.bucket is not None: player.bucket = req.bucket.strip().upper()
    if req.base_price is not None: player.base_price = req.base_price
    if req.derived_player_type is not None: player.derived_player_type = req.derived_player_type
    if req.cricheroes_url is not None: player.cricheroes_url = req.cricheroes_url
    if req.cricheroes_mobile is not None: player.cricheroes_mobile = req.cricheroes_mobile
    if req.payment_status is not None: player.payment_status = req.payment_status
    if req.profile_status is not None: player.profile_status = req.profile_status
    if req.is_skilled_batter is not None: player.is_skilled_batter = req.is_skilled_batter
    if req.is_skilled_bowler is not None: player.is_skilled_bowler = req.is_skilled_bowler
    if req.is_wicket_keeper is not None: player.is_wicket_keeper = req.is_wicket_keeper
    if req.matches is not None: player.matches = req.matches
    if req.runs is not None: player.runs = req.runs
    if req.wickets is not None: player.wickets = req.wickets

    db.add(AuditLog(
        action_type="PLAYER_UPDATE",
        player_id=player.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Updated details for player {player.name} ({player.roll_number})."
    ))
    db.commit()
    db.refresh(player)
    schedule_auction_state_broadcast()
    return {"message": f"Player '{player.name}' updated successfully."}


@app.delete("/api/players/{player_id}")
def delete_player(player_id: int, request: Request, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    p_name = player.name
    p_roll = player.roll_number

    state = get_or_create_auction_state(db)
    if state.current_player_id == player_id:
        state.current_player_id = None
        state.current_bid_price = 0
        state.current_bidder_id = None

    db.delete(player)
    db.add(AuditLog(
        action_type="PLAYER_DELETE",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Deleted player '{p_name}' ({p_roll}, ID: {player_id})."
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Player '{p_name}' deleted successfully."}

# --- Franchise Endpoints ---

@app.get("/api/franchises/public", response_model=List[schemas.PublicFranchiseResponse])
def get_public_franchises(db: Session = Depends(get_db)):
    franchises = db.query(Franchise).all()
    state = get_or_create_auction_state(db)
    bucket_mins = json.loads(state.bucket_minimums_json) if (state and state.bucket_minimums_json) else auction_engine.DEFAULT_BUCKET_MINIMUMS
    active_player = db.query(Player).filter(Player.id == state.current_player_id).first() if state and state.current_player_id else None
    franchise_stats, _ = get_franchise_stats(db, [f.id for f in franchises])

    result = []
    for f in franchises:
        stats = franchise_stats[f.id]
        b_counts = stats["bucket_counts"]
        purchases_cnt = stats["purchases"]
        total_squad_cnt = stats["squad_count"]
        current_purse = stats["purse"]

        # Calculate max permissible bid for current lot player if active
        max_bid = auction_engine.calculate_max_permissible_bid(
            purse=current_purse,
            auction_purchases_count=purchases_cnt,
            bucket_counts=b_counts,
            bucket_minimums=bucket_mins,
            player_bucket=active_player.bucket if active_player else None,
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
    franchises_by_id = {f.id: f for f in db.query(Franchise).all()}
    result = []
    for pf in public_f:
        f = franchises_by_id.get(pf.id)
        af = schemas.AdminFranchiseResponse(
            **pf.dict(),
            faculty_coordinator_mobile=f.faculty_coordinator_mobile if f else "",
            captain_mobile=f.captain_mobile if f else None,
            vice_captain_mobile=f.vice_captain_mobile if f else None
        )
        result.append(af)
    return result

@app.post("/api/franchises/register", response_model=schemas.PublicFranchiseResponse)
def register_franchise(req: schemas.FranchiseRegisterRequest, db: Session = Depends(get_db)):
    if db.query(Franchise).count() >= 11:
        raise HTTPException(status_code=400, detail="The tournament is limited to eleven franchises.")
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
    schedule_auction_state_broadcast()
    return get_public_franchises(db)[-1]


@app.put("/api/franchises/{franchise_id}")
def update_franchise(franchise_id: int, req: schemas.FranchiseUpdateRequest, request: Request, db: Session = Depends(get_db)):
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    if not franchise:
        raise HTTPException(status_code=404, detail="Franchise not found")

    if req.name and req.name.strip() and req.name != franchise.name:
        dup = db.query(Franchise).filter(Franchise.name == req.name.strip(), Franchise.id != franchise_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Another franchise with this name already exists.")
        franchise.name = req.name.strip()

    if req.short_code and req.short_code.strip() and req.short_code.strip().upper() != franchise.short_code:
        code_upper = req.short_code.strip().upper()
        dup_code = db.query(Franchise).filter(Franchise.short_code == code_upper, Franchise.id != franchise_id).first()
        if dup_code:
            raise HTTPException(status_code=400, detail="Another franchise with this short code already exists.")
        franchise.short_code = code_upper

    if req.logo_url is not None:
        if req.logo_url and req.logo_url.startswith("data:"):
            validate_photo_data(req.logo_url)
        franchise.logo_url = req.logo_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={franchise.short_code}"
    if req.faculty_coordinator_name is not None:
        franchise.faculty_coordinator_name = req.faculty_coordinator_name
    if req.faculty_coordinator_dept is not None:
        franchise.faculty_coordinator_dept = req.faculty_coordinator_dept
    if req.faculty_coordinator_photo is not None:
        franchise.faculty_coordinator_photo = req.faculty_coordinator_photo
    if req.faculty_coordinator_mobile is not None:
        franchise.faculty_coordinator_mobile = req.faculty_coordinator_mobile
    if req.captain_name is not None:
        franchise.captain_name = req.captain_name
    if req.captain_mobile is not None:
        franchise.captain_mobile = req.captain_mobile
    if req.vice_captain_name is not None:
        franchise.vice_captain_name = req.vice_captain_name
    if req.vice_captain_mobile is not None:
        franchise.vice_captain_mobile = req.vice_captain_mobile

    db.add(AuditLog(
        action_type="FRANCHISE_UPDATE",
        franchise_id=franchise.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Updated franchise profile for {franchise.name} ({franchise.short_code}).",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Franchise '{franchise.name}' updated successfully."}


@app.delete("/api/franchises/{franchise_id}")
def delete_franchise(franchise_id: int, request: Request, db: Session = Depends(get_db)):
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    if not franchise:
        raise HTTPException(status_code=404, detail="Franchise not found")

    f_name = franchise.name

    # Reset any players assigned to this franchise back to unassigned
    assigned_players = db.query(Player).filter(
        (Player.sold_franchise_id == franchise_id) |
        (Player.retained_franchise_id == franchise_id) |
        (Player.referred_franchise_id == franchise_id)
    ).all()
    for p in assigned_players:
        if p.sold_franchise_id == franchise_id:
            p.sold_franchise_id = None
            p.sold_price = None
            p.sold_type = None
        if p.retained_franchise_id == franchise_id:
            p.retained_franchise_id = None
            p.retained_role = None
        if p.referred_franchise_id == franchise_id:
            p.referred_franchise_id = None

    state = get_or_create_auction_state(db)
    if state.current_bidder_id == franchise_id:
        state.current_bidder_id = None
        state.current_bid_price = 0

    db.delete(franchise)
    db.add(AuditLog(
        action_type="FRANCHISE_DELETE",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Deleted franchise '{f_name}' (ID: {franchise_id}).",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Franchise '{f_name}' deleted successfully."}


@app.post("/api/franchises/refer-player")
def refer_player(req: schemas.ReferPlayerRequest, request: Request, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == req.player_id).first()
    franchise = db.query(Franchise).filter(Franchise.id == req.franchise_id).first()
    if not player or not franchise:
        raise HTTPException(status_code=404, detail="Player or Franchise not found.")
    if not player.referring_team_name or player.referring_team_name.strip().lower() in {"no", "none"}:
        raise HTTPException(status_code=400, detail="The player did not declare an ACC referral.")
    if player.referring_team_name.strip().casefold() != franchise.name.strip().casefold():
        raise HTTPException(status_code=409, detail="The player and franchise referral declarations conflict.")
    if player.referred_franchise_id and player.referred_franchise_id != franchise.id:
        raise HTTPException(status_code=409, detail="This player has already been referred to another franchise.")
    player.referred_franchise_id = franchise.id
    player.sold_type = "referred"
    db.add(AuditLog(
        action_type="REFERRAL_ASSIGNED",
        player_id=player.id,
        franchise_id=franchise.id,
        performed_by=audit_actor(request, "Super Admin"),
        reason=req.reason,
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Referral for {player.name} assigned to {franchise.name}."}

# --- Auction Core Mechanics Endpoints ---

@app.get("/api/auction/state")
def get_auction_state(db: Session = Depends(get_db)):
    return get_auction_state_data(db)

@app.post("/api/auction/bid")
def place_bid(req: schemas.BidRequest, request: Request, db: Session = Depends(get_db)):
    claims = getattr(request.state, "user", {})
    if claims.get("role") == "Captain" and str(claims.get("franchise_id")) != str(req.franchise_id):
        raise HTTPException(status_code=403, detail="Captains can bid only for their assigned franchise.")

    state = get_or_create_auction_state(db)
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active player up for auction.")

    player = db.query(Player).filter(Player.id == state.current_player_id).first()
    franchise = db.query(Franchise).filter(Franchise.id == req.franchise_id).first()
    if not player or not franchise:
        raise HTTPException(status_code=404, detail="Player or Franchise not found.")
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []
    if franchise.id in passed_ids:
        raise HTTPException(status_code=400, detail="Re-enter bidding before placing another bid.")
    if player.payment_status != "paid" or player.sold_franchise_id or player.retained_franchise_id or player.referred_franchise_id:
        raise HTTPException(status_code=400, detail="This player is not eligible for auction.")
    if state.current_bidder_id == franchise.id:
        raise HTTPException(status_code=400, detail="The current high bidder cannot bid against itself.")

    if not state.timer_running or state.timer_seconds <= 0:
        raise HTTPException(status_code=400, detail="Bidding is closed for this lot.")

    # 1. Price increment check (§11, Appendix A.6)
    current_price = state.current_bid_price if state.current_bidder_id else 0
    valid_price, price_msg = auction_engine.validate_bid_price(current_price, player.base_price, req.attempted_bid)
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
    state.timer_duration_seconds = 20
    state.timer_seconds = 20
    state.timer_running = True

    # Log action
    log = AuditLog(
        action_type="BID",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=req.attempted_bid,
        performed_by=audit_actor(request, f"Franchise:{franchise.short_code}"),
        reason=f"Bid placed on {player.name} at {req.attempted_bid}"
    )
    db.add(log)
    db.commit()

    schedule_auction_state_broadcast()
    return {"message": "Bid accepted", "new_bid": req.attempted_bid, "franchise": franchise.name}

@app.post("/api/auction/pass")
def pass_franchise(franchise_id: int, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active lot to pass on.")
    if state.current_bidder_id == franchise_id:
        raise HTTPException(status_code=400, detail="The current high bidder cannot pass before the hammer.")
    if not db.query(Franchise).filter(Franchise.id == franchise_id).first():
        raise HTTPException(status_code=404, detail="Franchise not found.")
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []
    if franchise_id not in passed_ids:
        passed_ids.append(franchise_id)
        state.passed_franchise_ids = json.dumps(passed_ids)
        db.commit()

        log = AuditLog(
            action_type="PASS",
            player_id=state.current_player_id,
            franchise_id=franchise_id,
            performed_by=audit_actor(request, f"Franchise:{franchise_id}"),
            reason="Franchise passed on current lot"
        )
        db.add(log)
        db.commit()

    schedule_auction_state_broadcast()
    return {"message": "Franchise passed"}

@app.post("/api/auction/unpass")
def unpass_franchise(franchise_id: int, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active lot to re-enter.")
    passed_ids = json.loads(state.passed_franchise_ids) if state.passed_franchise_ids else []
    if franchise_id in passed_ids:
        passed_ids.remove(franchise_id)
        state.passed_franchise_ids = json.dumps(passed_ids)
        db.commit()

        log = AuditLog(
            action_type="UNPASS",
            player_id=state.current_player_id,
            franchise_id=franchise_id,
            performed_by=audit_actor(request, f"Franchise:{franchise_id}"),
            reason="Franchise re-entered bidding"
        )
        db.add(log)
        db.commit()

    schedule_auction_state_broadcast()
    return {"message": "Franchise re-entered play"}

@app.post("/api/auction/hammer")
def hammer_lot(request: Request, performed_by: str = "Super Admin", db: Session = Depends(get_db)):
    performed_by = audit_actor(request, performed_by)
    state = get_or_create_auction_state(db)
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
        # Unsold players are carried to Round 2, not immediately recalled.
        player.is_skipped = False
        log = AuditLog(
            action_type="HAMMER_UNSOLD",
            player_id=player.id,
            performed_by=performed_by,
            reason=f"Hammer pressed — {player.name} UNSOLD."
        )
        db.add(log)
        res_msg = f"{player.name} UNSOLD"

    if state.round_number == 1:
        player.round_one_complete = True
    else:
        player.round_two_complete = True
    state.timer_running = False

    db.commit()

    # Automatically draw next player in bucket
    draw_next_player_internal(db, state)
    schedule_auction_state_broadcast()

    return {"message": res_msg}

@app.post("/api/auction/skip")
def skip_player(request: Request, performed_by: str = "Super Admin", db: Session = Depends(get_db)):
    performed_by = audit_actor(request, performed_by)
    state = get_or_create_auction_state(db)
    if not state or not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active player to skip.")

    player = db.query(Player).filter(Player.id == state.current_player_id).first()
    if state.round_number != 1:
        raise HTTPException(status_code=400, detail="Players cannot be skipped after Round 1.")
    if player.skip_recalled:
        player.round_one_complete = True
    else:
        player.is_skipped = True
        player.skip_recalled = False
    
    log = AuditLog(
        action_type="SKIP",
        player_id=player.id,
        performed_by=performed_by,
        reason=f"Player {player.name} skipped to end of bucket."
    )
    db.add(log)
    db.commit()

    draw_next_player_internal(db, state)
    schedule_auction_state_broadcast()
    return {"message": f"Skipped {player.name}"}

@app.post("/api/auction/undo")
def undo_transaction(req: schemas.UndoRequest, request: Request, db: Session = Depends(get_db)):
    audit_entry = db.query(AuditLog).filter(AuditLog.id == req.audit_id).first()
    if not audit_entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found.")

    if audit_entry.is_undone:
        # Appendix A.4 Case 18: Same sale undone twice -> Second attempt rejected
        raise HTTPException(status_code=400, detail="Second attempt rejected — sale has already been undone.")

    if audit_entry.action_type not in {"HAMMER_SOLD", "DIRECT_ASSIGN", "ALLOT", "SCOUT"}:
        raise HTTPException(status_code=400, detail="Only completed player assignments can be undone.")

    # Mark as undone
    audit_entry.is_undone = True

    # Reverse player squad assignment if HAMMER_SOLD or DIRECT_ASSIGN
    if audit_entry.action_type in ["HAMMER_SOLD", "DIRECT_ASSIGN", "ALLOT"]:
        player = db.query(Player).filter(Player.id == audit_entry.player_id).first()
        if player:
            player.sold_franchise_id = None
            player.sold_price = None
            player.sold_type = None
            player.is_skipped = False
            player.skip_recalled = False
            state = db.query(AuctionState).filter(AuctionState.id == 1).first()
            player.round_one_complete = state is not None and state.round_number == 2
            player.round_two_complete = False

    undo_log = AuditLog(
        action_type="UNDO",
        player_id=audit_entry.player_id,
        franchise_id=audit_entry.franchise_id,
        amount=audit_entry.amount,
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"UNDONE Audit ID {audit_entry.id}: {req.reason}"
    )
    db.add(undo_log)
    db.commit()

    schedule_auction_state_broadcast()
    return {"message": f"Successfully undone Audit Entry #{audit_entry.id}. All pursed, slots, and limits recalculated."}

@app.post("/api/auction/direct-assign")
def direct_assign_player(req: schemas.DirectAssignRequest, request: Request, db: Session = Depends(get_db)):
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
        performed_by=audit_actor(request, "Super Admin"),
        reason=req.reason
    )
    db.add(log)
    db.commit()

    schedule_auction_state_broadcast()
    return {"message": f"Directly assigned {player.name} to {franchise.name} for {req.price} credits."}

@app.post("/api/auction/relax-minimum")
def relax_bucket_minimum(req: schemas.RelaxMinimumRequest, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    if state.round_number != 2 or state.current_player_id:
        raise HTTPException(status_code=400, detail="Minimums can be relaxed only after Round 2 lots are complete.")
    pending_round_two = db.query(Player).filter(
        Player.payment_status == "paid",
        Player.round_one_complete.is_(True),
        Player.round_two_complete.is_(False),
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    ).first()
    if pending_round_two:
        raise HTTPException(status_code=400, detail="Complete all Round 2 lots before relaxing bucket minimums.")
    remaining_bucket_supply = db.query(Player).filter(
        Player.bucket == req.bucket,
        Player.payment_status == "paid",
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    ).first()
    if remaining_bucket_supply:
        raise HTTPException(status_code=400, detail="Bucket minimums can be relaxed only after that bucket is exhausted.")
    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else dict(auction_engine.DEFAULT_BUCKET_MINIMUMS)
    if req.bucket not in bucket_mins or not 0 <= req.new_minimum <= bucket_mins[req.bucket]:
        raise HTTPException(status_code=400, detail="Minimum relaxation must lower a known bucket requirement.")
    bucket_mins[req.bucket] = req.new_minimum
    state.bucket_minimums_json = json.dumps(bucket_mins)

    log = AuditLog(
        action_type="RELAX_MINIMUM",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Uniform relaxation of bucket {req.bucket} minimum to {req.new_minimum} across all franchises: {req.reason}"
    )
    db.add(log)
    db.commit()

    schedule_auction_state_broadcast()
    return {"message": f"Relaxed bucket {req.bucket} minimum to {req.new_minimum} uniformly for all 11 franchises."}


@app.post("/api/auction/auto-allot")
def auto_allot_round_two(request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    if not state or state.round_number != 2 or state.current_player_id:
        raise HTTPException(status_code=400, detail="Auto-allotment is available only after Round 2 lots are complete.")
    pending_round_two = db.query(Player).filter(
        Player.payment_status == "paid",
        Player.round_one_complete.is_(True),
        Player.round_two_complete.is_(False),
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    ).first()
    if pending_round_two:
        raise HTTPException(status_code=400, detail="Complete all Round 2 lots before auto-allotment.")

    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else auction_engine.DEFAULT_BUCKET_MINIMUMS
    franchises = db.query(Franchise).order_by(Franchise.id.asc()).all()
    assignments = []

    def available_players(bucket=None):
        query = db.query(Player).filter(
            Player.payment_status == "paid",
            Player.round_one_complete.is_(True),
            Player.sold_franchise_id.is_(None),
            Player.retained_franchise_id.is_(None),
            Player.referred_franchise_id.is_(None),
        )
        if bucket:
            query = query.filter(Player.bucket == bucket)
        return query.order_by(Player.random_lot_number.asc(), Player.id.asc())

    def priority(franchise):
        counts = get_franchise_bucket_counts(db, franchise.id)
        purchases = get_franchise_auction_purchases_count(db, franchise.id)
        mandatory = auction_engine.calculate_mandatory_slots_needed(counts, bucket_mins)
        unfilled = max(max(0, auction_engine.MIN_AUCTION_SLOTS - purchases), mandatory)
        return (-unfilled, calculate_franchise_purse(db, franchise.id), franchise.id)

    def allot(player, franchise):
        player.sold_franchise_id = franchise.id
        player.sold_price = 20
        player.sold_type = "allotted"
        player.round_two_complete = True
        player.is_skipped = False
        assignments.append({"player_id": player.id, "franchise_id": franchise.id, "bucket": player.bucket})
        db.add(AuditLog(
            action_type="ALLOT",
            player_id=player.id,
            franchise_id=franchise.id,
            amount=20,
            performed_by=audit_actor(request, "Super Admin"),
            reason="Round 2 auto-allotment for incomplete squad requirements.",
        ))

    for bucket, minimum in bucket_mins.items():
        while True:
            player = available_players(bucket).first()
            if not player:
                break
            candidates = [
                franchise for franchise in franchises
                if get_franchise_bucket_counts(db, franchise.id).get(bucket, 0) < minimum
                and get_franchise_total_squad_count(db, franchise.id) < auction_engine.MAX_SQUAD_SIZE
                and calculate_franchise_purse(db, franchise.id) >= 20
            ]
            if not candidates:
                break
            allot(player, min(candidates, key=priority))
            db.flush()

    for franchise in sorted(franchises, key=priority):
        while (
            get_franchise_auction_purchases_count(db, franchise.id) < auction_engine.MIN_AUCTION_SLOTS
            and get_franchise_total_squad_count(db, franchise.id) < auction_engine.MAX_SQUAD_SIZE
            and calculate_franchise_purse(db, franchise.id) >= 20
        ):
            player = available_players().first()
            if not player:
                break
            allot(player, franchise)
            db.flush()

    unresolved = {
        franchise.short_code: {
            "purchases_needed": max(0, auction_engine.MIN_AUCTION_SLOTS - get_franchise_auction_purchases_count(db, franchise.id)),
            "bucket_counts": get_franchise_bucket_counts(db, franchise.id),
        }
        for franchise in franchises
        if get_franchise_auction_purchases_count(db, franchise.id) < auction_engine.MIN_AUCTION_SLOTS
        or auction_engine.calculate_mandatory_slots_needed(get_franchise_bucket_counts(db, franchise.id), bucket_mins) > 0
    }
    db.add(AuditLog(
        action_type="AUTO_ALLOTMENT",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Round 2 auto-allotment applied to {len(assignments)} players.",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"assignments": assignments, "unresolved": unresolved}


@app.post("/api/auction/scout")
def scout_player(req: schemas.ScoutRequest, request: Request, db: Session = Depends(get_db)):
    state = db.query(AuctionState).filter(AuctionState.id == 1).with_for_update().first()
    if not state or state.round_number != 2 or state.current_player_id:
        raise HTTPException(status_code=400, detail="Scouting is available only after Round 2 lots are complete.")
    pending_round_two = db.query(Player).filter(
        Player.payment_status == "paid",
        Player.round_one_complete.is_(True),
        Player.round_two_complete.is_(False),
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    ).first()
    if pending_round_two:
        raise HTTPException(status_code=400, detail="Complete all Round 2 lots before scouting.")
    bucket_mins = json.loads(state.bucket_minimums_json) if state.bucket_minimums_json else auction_engine.DEFAULT_BUCKET_MINIMUMS
    if req.bucket not in bucket_mins:
        raise HTTPException(status_code=400, detail="Scouting requires a valid quota bucket.")

    player = db.query(Player).filter(Player.id == req.player_id).first()
    franchise = db.query(Franchise).filter(Franchise.id == req.franchise_id).first()
    if not player or not franchise:
        raise HTTPException(status_code=404, detail="Player or Franchise not found.")
    if player.bucket != req.bucket or player.payment_status != "paid" or player.profile_status != "completed":
        raise HTTPException(status_code=400, detail="Scouted players must be paid, profile-verified, and in the requested bucket.")
    if player.sold_franchise_id or player.retained_franchise_id or player.referred_franchise_id:
        raise HTTPException(status_code=400, detail="This player is already assigned.")
    other_supply = db.query(Player).filter(
        Player.bucket == req.bucket,
        Player.payment_status == "paid",
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
        Player.id != player.id,
    ).count()
    if other_supply:
        raise HTTPException(status_code=400, detail="Scouting is blocked while any other paid unsold player remains in this bucket.")
    if get_franchise_bucket_counts(db, franchise.id).get(req.bucket, 0) >= bucket_mins[req.bucket]:
        raise HTTPException(status_code=400, detail="This franchise has already met the bucket minimum.")
    if calculate_franchise_purse(db, franchise.id) < 20 or get_franchise_total_squad_count(db, franchise.id) >= auction_engine.MAX_SQUAD_SIZE:
        raise HTTPException(status_code=400, detail="The franchise cannot afford or fit another player.")

    player.sold_franchise_id = franchise.id
    player.sold_price = 20
    player.sold_type = "scouted"
    player.round_two_complete = True
    db.add(AuditLog(
        action_type="SCOUT",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=20,
        performed_by=audit_actor(request, "Super Admin"),
        reason=req.reason,
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"{player.name} scouted to {franchise.name} for 20 credits."}

def draw_next_player_internal(db: Session, state: AuctionState, lot_number: Optional[int] = None):
    bucket_sequence = ["B3", "B4", "B2", "B5", "B1", "PG"]
    available = db.query(Player).filter(
        Player.payment_status == "paid",
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    )
    next_player = None

    if state.draw_mode == "guest" and state.round_number == 1:
        if lot_number is None:
            state.current_player_id = None
            state.current_bid_price = 0
            state.current_bidder_id = None
            state.timer_running = False
            state.passed_franchise_ids = "[]"
            db.commit()
            return
        next_player = available.filter(
            Player.bucket == state.current_bucket,
            Player.random_lot_number == lot_number,
            Player.round_one_complete.is_(False),
        ).first()
        if not next_player:
            raise HTTPException(status_code=404, detail="That lot number is not available in the active bucket.")
        if next_player.is_skipped:
            unskipped_remain = available.filter(
                Player.bucket == state.current_bucket,
                Player.round_one_complete.is_(False),
                Player.is_skipped.is_(False),
            ).first()
            if unskipped_remain:
                raise HTTPException(status_code=400, detail="Skipped players are recalled only after the rest of their bucket.")
            next_player.is_skipped = False
            next_player.skip_recalled = True

    if state.round_number == 1 and state.draw_mode != "guest":
        start_index = bucket_sequence.index(state.current_bucket) if state.current_bucket in bucket_sequence else 0
        for bucket in bucket_sequence[start_index:]:
            state.current_bucket = bucket
            next_player = available.filter(
                Player.bucket == bucket,
                Player.round_one_complete.is_(False),
                Player.is_skipped.is_(False),
            ).order_by(Player.random_lot_number.asc(), Player.id.asc()).first()
            if next_player:
                break

            next_player = available.filter(
                Player.bucket == bucket,
                Player.round_one_complete.is_(False),
                Player.is_skipped.is_(True),
                Player.skip_recalled.is_(False),
            ).order_by(Player.random_lot_number.asc(), Player.id.asc()).first()
            if next_player:
                next_player.is_skipped = False
                next_player.skip_recalled = True
                break

        if not next_player:
            state.round_number = 2

    if state.round_number == 2:
        next_player = available.filter(
            Player.round_one_complete.is_(True),
            Player.round_two_complete.is_(False),
        ).order_by(Player.random_lot_number.asc(), Player.id.asc()).first()
        if next_player:
            next_player.base_price = 20
            state.current_bucket = next_player.bucket

    if next_player:
        state.current_player_id = next_player.id
        state.current_bid_price = 0
        state.current_bidder_id = None
        state.timer_duration_seconds = 30
        state.timer_seconds = 30
        state.timer_running = False
        state.passed_franchise_ids = "[]"
    else:
        state.current_player_id = None
        state.current_bid_price = 0
        state.current_bidder_id = None

    db.commit()

@app.post("/api/auction/draw-next")
def draw_next_player(request: Request, lot_number: Optional[int] = Query(None), db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    draw_next_player_internal(db, state, lot_number)
    db.add(AuditLog(action_type="DRAW_NEXT", performed_by=audit_actor(request, "Super Admin"), reason="Next auction lot drawn."))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": "Drawn next player"}


@app.post("/api/auction/draw-mode")
def set_draw_mode(mode: str, request: Request, db: Session = Depends(get_db)):
    if mode not in {"auto", "guest"}:
        raise HTTPException(status_code=400, detail="Draw mode must be auto or guest.")
    state = get_or_create_auction_state(db)
    state.draw_mode = mode
    db.add(AuditLog(
        action_type="DRAW_MODE",
        performed_by=audit_actor(request, "Super Admin"),
        reason=f"Draw mode changed to {mode}.",
    ))
    db.commit()
    schedule_auction_state_broadcast()
    return {"draw_mode": state.draw_mode}

@app.post("/api/auction/set-bucket")
def set_active_bucket(bucket: str, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    normalized_bucket = normalize_bucket_name(bucket)
    if normalized_bucket not in {"B1", "B2", "B3", "B4", "B5", "PG"}:
        raise HTTPException(status_code=400, detail="Unknown auction bucket.")
    
    state.current_bucket = normalized_bucket

    # Find next available player in this specific requested bucket
    available = db.query(Player).filter(
        Player.bucket == normalized_bucket,
        Player.payment_status == "paid",
        Player.sold_franchise_id.is_(None),
        Player.retained_franchise_id.is_(None),
        Player.referred_franchise_id.is_(None),
    )
    
    next_player = available.filter(
        Player.round_one_complete.is_(False),
        Player.is_skipped.is_(False),
    ).order_by(Player.random_lot_number.asc(), Player.id.asc()).first()

    if not next_player:
        # Fallback to skipped players in this bucket if any
        next_player = available.filter(
            Player.round_one_complete.is_(False),
            Player.is_skipped.is_(True),
        ).order_by(Player.random_lot_number.asc(), Player.id.asc()).first()
        if next_player:
            next_player.is_skipped = False
            next_player.skip_recalled = True

    if not next_player:
        # Fallback to any remaining player in this bucket regardless of round
        next_player = available.order_by(Player.random_lot_number.asc(), Player.id.asc()).first()

    if next_player:
        state.current_player_id = next_player.id
        state.current_bid_price = 0
        state.current_bidder_id = None
        state.timer_duration_seconds = 30
        state.timer_seconds = 30
        state.timer_running = False
        state.passed_franchise_ids = "[]"
        msg = f"Active stage bucket set to {normalized_bucket}. Player {next_player.name} drawn!"
    else:
        state.current_player_id = None
        state.current_bid_price = 0
        state.current_bidder_id = None
        state.timer_running = False
        msg = f"Active stage bucket set to {normalized_bucket}, but no unsold players remain in Bucket {normalized_bucket}."

    db.add(AuditLog(action_type="SET_BUCKET", performed_by=audit_actor(request, "Super Admin"), reason=f"Active bucket set to {normalized_bucket}."))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": msg}

@app.post("/api/auction/select-player")
def select_player_for_lot(player_id: int, request: Request, db: Session = Depends(get_db)):
    state = get_or_create_auction_state(db)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")
    if (
        player.payment_status != "paid"
        or player.sold_franchise_id is not None
        or player.retained_franchise_id is not None
        or player.referred_franchise_id is not None
    ):
        raise HTTPException(status_code=400, detail="Only paid, unassigned players can be selected for auction.")
    
    state.current_player_id = player.id
    state.current_bucket = player.bucket
    state.current_bid_price = 0
    state.current_bidder_id = None
    state.timer_seconds = state.timer_duration_seconds or 30
    state.timer_running = False
    state.passed_franchise_ids = "[]"
    db.add(AuditLog(action_type="SELECT_PLAYER", player_id=player.id, performed_by=audit_actor(request, "Super Admin"), reason="Player selected for the active lot."))
    db.commit()
    schedule_auction_state_broadcast()
    return {"message": f"Player {player.name} ({player.roll_number}) set as active lot."}

@app.get("/api/audit-log")
def get_audit_log(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).all()

@app.get("/api/export/excel")
def export_tournament_excel(db: Session = Depends(get_db)):
    wb = openpyxl.Workbook()
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
            vc.name if vc else "N/A",
        ])

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
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Load initial state in a worker so ORM work cannot stall other sockets.
        initial_state = await asyncio.to_thread(_load_latest_auction_state_data)
        await websocket.send_json({
            "type": "AUCTION_STATE_UPDATE",
            "data": initial_state
        })
        while True:
            data = await websocket.receive_text()
            # Handle client heartbeats if any
    except WebSocketDisconnect:
        manager.disconnect(websocket)


