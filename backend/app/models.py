import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Franchise(Base):
    __tablename__ = "franchises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    short_code = Column(String, unique=True, index=True, nullable=False)
    logo_url = Column(String, nullable=True)
    faculty_coordinator_name = Column(String, nullable=False)
    faculty_coordinator_dept = Column(String, nullable=False)
    faculty_coordinator_photo = Column(String, nullable=True)
    faculty_coordinator_mobile = Column(String, nullable=False)  # Private!
    captain_name = Column(String, nullable=True)
    captain_mobile = Column(String, nullable=True)               # Private!
    vice_captain_name = Column(String, nullable=True)
    vice_captain_mobile = Column(String, nullable=True)          # Private!
    purse = Column(Integer, default=1000)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    mobile_number = Column(String, unique=True, nullable=False)  # Private!
    photo_url = Column(String, nullable=True)
    course = Column(String, nullable=False)                       # UG, Diploma, PG
    program = Column(String, nullable=False)                      # B.Tech, Polytechnic, M.Tech, etc.
    branch = Column(String, nullable=False)                       # ECE, CSE, CM, etc.
    year_of_study = Column(Integer, nullable=False)               # 1, 2, 3, 4
    year_override = Column(Integer, nullable=True)                # Super Admin override for detained
    bucket = Column(String, nullable=False)                       # B1, B2, B3, B4, B5, PG
    base_price = Column(Integer, nullable=False, default=20)
    
    cricheroes_url = Column(String, nullable=True)
    cricheroes_mobile = Column(String, nullable=True)             # Private!
    profile_status = Column(String, default="completed")          # completed, profile_creation_pending
    payment_status = Column(String, default="unpaid")             # unpaid, paid
    can_edit = Column(Boolean, default=True)

    # Skill questionnaire
    is_skilled_batter = Column(Boolean, default=False)
    batting_style = Column(String, nullable=True)
    preferred_batting_pos = Column(String, nullable=True)
    batting_arm = Column(String, default="Right")
    
    is_skilled_bowler = Column(Boolean, default=False)
    bowling_arm = Column(String, nullable=True)
    bowling_type = Column(String, nullable=True)
    pace_variety = Column(String, nullable=True)
    spin_variety = Column(String, nullable=True)
    bowling_roles = Column(String, nullable=True)
    
    is_wicket_keeper = Column(Boolean, default=False)
    fielding_zone = Column(String, nullable=True)
    preferred_fielding_pos = Column(String, nullable=True)
    
    highest_level_played = Column(String, default="Recreational only")
    played_acc_before = Column(Boolean, default=False)
    previous_acc_team = Column(String, nullable=True)
    derived_player_type = Column(String, nullable=False, default="Fielder")

    # Career Statistics (Self-declared)
    matches = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    batting_avg = Column(Float, default=0.0)
    strike_rate = Column(Float, default=0.0)
    highest_score = Column(Integer, default=0)
    wickets = Column(Integer, default=0)
    bowling_avg = Column(Float, default=0.0)
    economy = Column(Float, default=0.0)
    best_bowling = Column(String, default="0/0")
    catches = Column(Integer, default=0)
    stumpings = Column(Integer, default=0)

    # ACC Reference declaration
    referring_team_name = Column(String, nullable=True)

    # Squad status
    retained_franchise_id = Column(Integer, ForeignKey("franchises.id"), nullable=True)
    retained_role = Column(String, nullable=True)                 # captain, vice_captain
    referred_franchise_id = Column(Integer, ForeignKey("franchises.id"), nullable=True)
    
    sold_franchise_id = Column(Integer, ForeignKey("franchises.id"), nullable=True)
    sold_price = Column(Integer, nullable=True)
    sold_type = Column(String, nullable=True)                     # sold, allotted, scouted, retained, referred
    
    is_skipped = Column(Boolean, default=False)
    random_lot_number = Column(Integer, nullable=True)

class AuctionState(Base):
    __tablename__ = "auction_state"

    id = Column(Integer, primary_key=True, index=True)
    current_bucket = Column(String, default="B3")
    current_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    current_bid_price = Column(Integer, default=0)
    current_bidder_id = Column(Integer, ForeignKey("franchises.id"), nullable=True)
    timer_seconds = Column(Integer, default=30)
    timer_duration_seconds = Column(Integer, default=30)
    timer_running = Column(Boolean, default=False)
    draw_mode = Column(String, default="auto")                     # auto, guest
    passed_franchise_ids = Column(String, default="[]")           # JSON array of franchise IDs
    bucket_minimums_json = Column(String, default='{"B1":2,"B2":2,"B3":2,"B4":2,"B5":2}')
    is_paused = Column(Boolean, default=False)
    round_number = Column(Integer, default=1)

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String, nullable=False)                 # BID, PASS, UNPASS, HAMMER_SOLD, HAMMER_UNSOLD, SKIP, UNDO, ALLOT, SCOUT, DIRECT_ASSIGN, RELAX_MINIMUM
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    franchise_id = Column(Integer, ForeignKey("franchises.id"), nullable=True)
    amount = Column(Integer, nullable=True)
    performed_by = Column(String, nullable=False)                # Super Admin, Operator, Franchise:short_code
    reason = Column(String, nullable=True)
    is_undone = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
