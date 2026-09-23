from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Player Schemas ---

class PlayerBase(BaseModel):
    roll_number: str
    name: str
    photo_url: Optional[str] = None
    course: str
    program: str
    branch: str
    year_of_study: int
    year_override: Optional[int] = None
    bucket: str
    base_price: int
    cricheroes_url: Optional[str] = None
    profile_status: str = "completed"
    payment_status: str = "unpaid"
    can_edit: bool = True

    # Skills
    is_skilled_batter: bool = False
    batting_style: Optional[str] = None
    preferred_batting_pos: Optional[str] = None
    batting_arm: str = "Right"
    
    is_skilled_bowler: bool = False
    bowling_arm: Optional[str] = None
    bowling_type: Optional[str] = None
    pace_variety: Optional[str] = None
    spin_variety: Optional[str] = None
    bowling_roles: Optional[str] = None
    
    is_wicket_keeper: bool = False
    fielding_zone: Optional[str] = None
    preferred_fielding_pos: Optional[str] = None
    
    highest_level_played: str = "Recreational only"
    played_acc_before: bool = False
    previous_acc_team: Optional[str] = None
    derived_player_type: str = "Fielder"

    # Stats
    matches: int = 0
    runs: int = 0
    batting_avg: float = 0.0
    strike_rate: float = 0.0
    highest_score: int = 0
    wickets: int = 0
    bowling_avg: float = 0.0
    economy: float = 0.0
    best_bowling: str = "0/0"
    catches: int = 0
    stumpings: int = 0

    referring_team_name: Optional[str] = None

    # Squad status
    retained_franchise_id: Optional[int] = None
    retained_role: Optional[str] = None
    referred_franchise_id: Optional[int] = None
    sold_franchise_id: Optional[int] = None
    sold_price: Optional[int] = None
    sold_type: Optional[str] = None
    is_skipped: bool = False
    random_lot_number: Optional[int] = None

class PublicPlayerResponse(PlayerBase):
    id: int

    class Config:
        from_attributes = True

class AdminPlayerResponse(PublicPlayerResponse):
    mobile_number: str
    cricheroes_mobile: Optional[str] = None

class PlayerRegisterRequest(BaseModel):
    roll_number: str
    name: str
    mobile_number: str
    photo_url: Optional[str] = None
    cricheroes_url: Optional[str] = None
    cricheroes_mobile: Optional[str] = None
    base_price: int = 20

    is_skilled_batter: bool = False
    batting_style: Optional[str] = None
    preferred_batting_pos: Optional[str] = None
    batting_arm: str = "Right"

    is_skilled_bowler: bool = False
    bowling_arm: Optional[str] = None
    bowling_type: Optional[str] = None
    pace_variety: Optional[str] = None
    spin_variety: Optional[str] = None
    bowling_roles: Optional[str] = None

    is_wicket_keeper: bool = False
    fielding_zone: Optional[str] = None
    preferred_fielding_pos: Optional[str] = None

    highest_level_played: str = "Recreational only"
    played_acc_before: bool = False
    previous_acc_team: Optional[str] = None
    referring_team_name: Optional[str] = None

    matches: int = 0
    runs: int = 0
    batting_avg: float = 0.0
    strike_rate: float = 0.0
    highest_score: int = 0
    wickets: int = 0
    bowling_avg: float = 0.0
    economy: float = 0.0
    best_bowling: str = "0/0"
    catches: int = 0
    stumpings: int = 0

# --- Franchise Schemas ---

class FranchiseBase(BaseModel):
    name: str
    short_code: str
    logo_url: Optional[str] = None
    faculty_coordinator_name: str
    faculty_coordinator_dept: str
    faculty_coordinator_photo: Optional[str] = None
    captain_name: Optional[str] = None
    vice_captain_name: Optional[str] = None
    purse: int = 1000

class PublicFranchiseResponse(FranchiseBase):
    id: int
    squad_count: int = 0
    auction_purchases_count: int = 0
    max_permissible_bid: int = 1000
    bucket_counts: Dict[str, int] = {}
    mandatory_slots_needed: int = 10
    is_blocked: bool = False

    class Config:
        from_attributes = True

class AdminFranchiseResponse(PublicFranchiseResponse):
    faculty_coordinator_mobile: str
    captain_mobile: Optional[str] = None
    vice_captain_mobile: Optional[str] = None

class FranchiseRegisterRequest(BaseModel):
    name: str
    short_code: str
    logo_url: Optional[str] = None
    faculty_coordinator_name: str
    faculty_coordinator_dept: str
    faculty_coordinator_photo: Optional[str] = None
    faculty_coordinator_mobile: str
    captain_name: Optional[str] = None
    captain_mobile: Optional[str] = None
    vice_captain_name: Optional[str] = None
    vice_captain_mobile: Optional[str] = None

# --- Auction & Bidding Schemas ---

class BidRequest(BaseModel):
    franchise_id: int
    attempted_bid: int
    performed_by: str = "Franchise"

class DirectAssignRequest(BaseModel):
    player_id: int
    franchise_id: int
    price: int
    reason: str

class UndoRequest(BaseModel):
    audit_id: int
    reason: str

class RelaxMinimumRequest(BaseModel):
    bucket: str
    new_minimum: int
    reason: str

class TimerSettingRequest(BaseModel):
    duration_seconds: Optional[int] = None
    action: Optional[str] = None # 'pause', 'resume', 'reset', 'start'

class PlayerLookupResponse(BaseModel):
    player: PublicPlayerResponse
    status: str
    team_name: Optional[str] = None
    team_logo: Optional[str] = None
    sold_price: Optional[int] = None

class AuctionStateResponse(BaseModel):
    current_bucket: str
    current_player: Optional[PublicPlayerResponse] = None
    current_bid_price: int
    current_bidder: Optional[PublicFranchiseResponse] = None
    next_required_bid: int
    timer_seconds: int
    timer_duration_seconds: int
    timer_running: bool
    draw_mode: str
    passed_franchise_ids: List[int]
    bucket_minimums: Dict[str, int]
    scarcity_warnings: Dict[str, Dict[str, Any]]
    is_paused: bool
    round_number: int
