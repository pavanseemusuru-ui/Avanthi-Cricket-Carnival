import random
import json
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import Franchise, Player, AuctionState, AuditLog
from app.roll_parser import parse_roll_number

FRANCHISES_DATA = [
    {"name": "Royal Strikers", "short_code": "RS", "faculty_coordinator_name": "Dr. K. Srinivas", "faculty_coordinator_dept": "CSE", "faculty_coordinator_mobile": "9848011111", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=RS"},
    {"name": "Thunder Bolts", "short_code": "TB", "faculty_coordinator_name": "Prof. P. Ramu", "faculty_coordinator_dept": "ECE", "faculty_coordinator_mobile": "9848022222", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=TB"},
    {"name": "Super Kings", "short_code": "SK", "faculty_coordinator_name": "Dr. M. V. Rao", "faculty_coordinator_dept": "EEE", "faculty_coordinator_mobile": "9848033333", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=SK"},
    {"name": "Deccan Chargers", "short_code": "DC", "faculty_coordinator_name": "Prof. S. Suresh", "faculty_coordinator_dept": "ME", "faculty_coordinator_mobile": "9848044444", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=DC"},
    {"name": "Falcon Riders", "short_code": "FR", "faculty_coordinator_name": "Dr. Ch. Lakshmi", "faculty_coordinator_dept": "CSE", "faculty_coordinator_mobile": "9848055555", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=FR"},
    {"name": "Coastal Warriors", "short_code": "CW", "faculty_coordinator_name": "Prof. G. Naidu", "faculty_coordinator_dept": "ECE", "faculty_coordinator_mobile": "9848066666", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=CW"},
    {"name": "Titan Guardians", "short_code": "TG", "faculty_coordinator_name": "Dr. B. Prasad", "faculty_coordinator_dept": "Polytechnic", "faculty_coordinator_mobile": "9848077777", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=TG"},
    {"name": "Visakha Mavericks", "short_code": "VM", "faculty_coordinator_name": "Prof. V. Anitha", "faculty_coordinator_dept": "CSM", "faculty_coordinator_mobile": "9848088888", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=VM"},
    {"name": "Tamaram Lions", "short_code": "TL", "faculty_coordinator_name": "Dr. N. Satyanarayana", "faculty_coordinator_dept": "CSD", "faculty_coordinator_mobile": "9848099999", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=TL"},
    {"name": "Avanthi Heroes", "short_code": "AH", "faculty_coordinator_name": "Prof. R. Krishna", "faculty_coordinator_dept": "MBA", "faculty_coordinator_mobile": "9848010101", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=AH"},
    {"name": "Carnival Gladiators", "short_code": "CG", "faculty_coordinator_name": "Dr. T. Appa Rao", "faculty_coordinator_dept": "MCA", "faculty_coordinator_mobile": "9848012121", "logo_url": "https://api.dicebear.com/7.x/identicon/svg?seed=CG"},
]

FIRST_NAMES = ["Rahul", "Sai", "Karthik", "Pavan", "Venkatesh", "Varun", "Teja", "Nikhil", "Tarun", "Harsha", "Manish", "Dinesh", "Ganesh", "Mahesh", "Siddharth", "Lokesh", "Kalyan", "Rohan", "Naveen", "Abhinav"]
LAST_NAMES = ["Kumar", "Reddy", "Rao", "Naidu", "Verma", "Chowdary", "Varma", "Patnaik", "Sharma", "Goud", "Vaka", "Kolla", "Boni", "Sagi", "Penmetsa", "Gottipati"]

def generate_sample_players():
    players = []
    
    # Bucket distribution generator
    # B1 (26811A...): B.Tech 1st yr
    # B2 (25811A...): B.Tech 2nd yr regular
    # B3 (25815A... or 24811A...): B.Tech 3rd yr lateral / reg
    # B4 (23811A...): B.Tech 4th yr
    # B5 (24597-CM-..., 25597-EC-...): Diploma
    # PG (PG...): Postgraduate
    
    roll_specs = [
        # B1
        ("26811A0501", "B1"), ("26811A0502", "B1"), ("26811A0401", "B1"), ("26811A0402", "B1"),
        ("26811A0201", "B1"), ("26811A0301", "B1"), ("26811A4201", "B1"), ("26811A4401", "B1"),
        ("26811A0503", "B1"), ("26811A0504", "B1"), ("26811A0403", "B1"), ("26811A0404", "B1"),
        ("26811A0202", "B1"), ("26811A0302", "B1"), ("26811A4202", "B1"),

        # B2
        ("25811A0501", "B2"), ("25811A0502", "B2"), ("25811A0401", "B2"), ("25811A0402", "B2"),
        ("25811A0201", "B2"), ("25811A0301", "B2"), ("25811A4201", "B2"), ("25811A4401", "B2"),
        ("25811A0503", "B2"), ("25811A0504", "B2"), ("25811A0403", "B2"), ("25811A0404", "B2"),
        ("25811A0202", "B2"), ("25811A0302", "B2"), ("25811A4202", "B2"),

        # B3
        ("24811A0501", "B3"), ("24811A0502", "B3"), ("24811A0401", "B3"), ("24811A0402", "B3"),
        ("25815A0403", "B3"), ("25815A0501", "B3"), ("25815A0201", "B3"), ("25815A0301", "B3"),
        ("24811A0201", "B3"), ("24811A0301", "B3"), ("24811A4201", "B3"), ("24811A4401", "B3"),
        ("24811A0503", "B3"), ("24811A0504", "B3"), ("24811A0403", "B3"),

        # B4
        ("23811A0501", "B4"), ("23811A0502", "B4"), ("23811A0401", "B4"), ("23811A0402", "B4"),
        ("23811A0201", "B4"), ("23811A0301", "B4"), ("23811A4201", "B4"), ("23811A4401", "B4"),
        ("23811A0503", "B4"), ("23811A0504", "B4"), ("23811A0403", "B4"), ("23811A0404", "B4"),
        ("23811A0202", "B4"), ("23811A0302", "B4"), ("23811A4202", "B4"),

        # B5 (Diploma)
        ("24597-CM-015", "B5"), ("25597-EC-032", "B5"), ("25597-EE-005", "B5"), ("26597-M-041", "B5"),
        ("24597-EC-012", "B5"), ("24597-EE-018", "B5"), ("24597-M-022", "B5"), ("25597-CM-008", "B5"),
        ("25597-EC-019", "B5"), ("25597-EE-021", "B5"), ("26597-CM-003", "B5"), ("26597-EC-014", "B5"),
        ("26597-EE-027", "B5"), ("26597-M-009", "B5"), ("24597-CM-099", "B5"),

        # PG
        ("PG2026MTECH01", "PG"), ("PG2026MBA02", "PG"), ("PG2026MCA03", "PG"), ("PG2026MTECH04", "PG"), ("PG2026MBA05", "PG")
    ]

    base_prices = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 230, 250]

    for idx, (roll, expected_bucket) in enumerate(roll_specs):
        parsed = parse_roll_number(roll)
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        mobile = f"98{random.randint(10000000, 99999999)}"
        ch_mobile = f"97{random.randint(10000000, 99999999)}"
        
        # Determine player type
        p_type_rand = random.choice(["Batter", "Bowler", "All-rounder", "Wicket-keeper batter", "Fielder"])
        
        is_batter = "Batter" in p_type_rand or "All-rounder" in p_type_rand
        is_bowler = "Bowler" in p_type_rand or "All-rounder" in p_type_rand
        is_wk = "Wicket-keeper" in p_type_rand

        b_price = random.choice(base_prices)

        players.append({
            "roll_number": roll,
            "name": name,
            "mobile_number": mobile,
            "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={roll}",
            "course": parsed["course"],
            "program": parsed["program"],
            "branch": parsed["branch"],
            "year_of_study": parsed["year_of_study"],
            "bucket": parsed["bucket"],
            "base_price": b_price,
            "cricheroes_url": f"https://cricheroes.in/player-profile/{idx+1000}/{name.lower().replace(' ', '-')}",
            "cricheroes_mobile": ch_mobile,
            "profile_status": "completed",
            "payment_status": "paid", # Mark paid so auctionable
            "is_skilled_batter": is_batter,
            "batting_style": random.choice(["Aggressive batter", "Strike rotator", "Big hitter"]) if is_batter else None,
            "preferred_batting_pos": random.choice(["Opener", "Top order", "Middle order", "Finisher"]) if is_batter else None,
            "batting_arm": random.choice(["Right", "Left"]),
            "is_skilled_bowler": is_bowler,
            "bowling_arm": random.choice(["Right", "Left"]) if is_bowler else None,
            "bowling_type": random.choice(["Fast", "Spin"]) if is_bowler else None,
            "pace_variety": random.choice(["Express pace", "Swing", "Seam"]) if is_bowler else None,
            "bowling_roles": random.choice(["Death-over specialist", "Wicket-taking bowler", "Powerplay specialist"]) if is_bowler else None,
            "is_wicket_keeper": is_wk,
            "derived_player_type": p_type_rand,
            "matches": random.randint(10, 85),
            "runs": random.randint(150, 2400),
            "batting_avg": round(random.uniform(18.5, 45.0), 2),
            "strike_rate": round(random.uniform(115.0, 178.5), 2),
            "highest_score": random.randint(35, 112),
            "wickets": random.randint(5, 65) if is_bowler else 0,
            "bowling_avg": round(random.uniform(14.0, 28.0), 2) if is_bowler else 0.0,
            "economy": round(random.uniform(6.2, 9.1), 2) if is_bowler else 0.0,
            "best_bowling": f"{random.randint(3, 5)}/{random.randint(12, 35)}" if is_bowler else "0/0",
            "catches": random.randint(2, 30),
            "stumpings": random.randint(1, 15) if is_wk else 0,
            "random_lot_number": idx + 1
        })
    return players

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if already seeded
        if db.query(Franchise).count() > 0:
            print("Database already contains franchises. Skipping seed.")
            return

        print("Seeding 11 Franchises...")
        franchises = []
        for f_data in FRANCHISES_DATA:
            f = Franchise(**f_data)
            db.add(f)
            franchises.append(f)
        db.commit()

        # Refresh to get IDs
        for f in franchises:
            db.refresh(f)

        print("Seeding Players...")
        player_datas = generate_sample_players()
        players = []
        for p_data in player_datas:
            p = Player(**p_data)
            db.add(p)
            players.append(p)
        db.commit()

        # Refresh players
        for p in players:
            db.refresh(p)

        # Assign Captain & Vice-Captain retained players for each franchise (cost 0)
        print("Assigning Captains and Vice-Captains...")
        for idx, f in enumerate(franchises):
            cap_player = players[idx * 2]
            vc_player = players[idx * 2 + 1]

            cap_player.retained_franchise_id = f.id
            cap_player.retained_role = "captain"
            cap_player.sold_type = "retained"
            cap_player.sold_price = 0

            vc_player.retained_franchise_id = f.id
            vc_player.retained_role = "vice_captain"
            vc_player.sold_type = "retained"
            vc_player.sold_price = 0

            f.captain_mobile = cap_player.mobile_number

        db.commit()

        # Create initial AuctionState singleton
        print("Initializing Auction State...")
        # Get first B3 player for initial lot
        first_b3 = db.query(Player).filter(Player.bucket == "B3", Player.sold_franchise_id.is_(None), Player.retained_franchise_id.is_(None)).first()
        
        state = AuctionState(
            id=1,
            current_bucket="B3",
            current_player_id=first_b3.id if first_b3 else None,
            current_bid_price=first_b3.base_price if first_b3 else 0,
            current_bidder_id=None,
            timer_seconds=30,
            timer_running=False,
            draw_mode="auto",
            passed_franchise_ids="[]",
            bucket_minimums_json='{"B1":2,"B2":2,"B3":2,"B4":2,"B5":2}',
            is_paused=False,
            round_number=1
        )
        db.add(state)

        # Add initial AuditLog entry
        log = AuditLog(
            action_type="SYSTEM_INIT",
            performed_by="Super Admin",
            reason="Tournament initialized with 11 franchises and seed players."
        )
        db.add(log)

        db.commit()
        print("Database seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
