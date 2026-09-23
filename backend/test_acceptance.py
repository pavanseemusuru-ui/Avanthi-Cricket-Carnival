import pytest
from app.auction_engine import (
    calculate_max_permissible_bid,
    check_bucket_eligibility,
    calculate_scarcity_warnings,
    get_next_bid_increment,
    validate_bid_price,
    DEFAULT_BUCKET_MINIMUMS
)
from app.roll_parser import parse_roll_number

# ==========================================
# A.1 Maximum Permissible Bid (Cases 1-6)
# ==========================================

def test_case_1_max_bid_no_players_bought():
    # Purse 1000. No players bought. All five bucket minimums unmet (needs 2 from each = 10 mandatory slots).
    # Buying 1 player leaves 14 slots to 15, mandatory slots = 9 -> slots_needed = 14.
    # Reserved = 14 * 20 = 280. Max bid = 1000 - 280 = 720.
    b_counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0}
    max_bid = calculate_max_permissible_bid(
        purse=1000,
        auction_purchases_count=0,
        bucket_counts=b_counts,
        player_bucket="B1"
    )
    assert max_bid == 720

def test_case_2_max_bid_14_players_bought_all_mins_met():
    # Purse 1000. 14 players bought, all bucket minimums met.
    # Buying 1 player leaves 0 remaining slots needed. Max bid = 1000.
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 3, "B5": 2}
    max_bid = calculate_max_permissible_bid(
        purse=1000,
        auction_purchases_count=14,
        bucket_counts=b_counts,
        player_bucket="B1"
    )
    assert max_bid == 1000

def test_case_3_max_bid_11_players_bought_5_mandatory_slots_unfilled():
    # Purse 340. 11 players bought, 5 mandatory bucket slots still unfilled.
    # Buying 1 player that satisfies 1 mandatory slot leaves 4 mandatory slots, slots to 15 = 3 -> slots_needed = max(3, 4) = 4.
    # Reserved = 4 * 20 = 80. Max bid = 340 - 80 = 260.
    b_counts = {"B1": 1, "B2": 1, "B3": 1, "B4": 1, "B5": 1} # needs 1 more in each of 5 buckets = 5 mandatory slots
    max_bid = calculate_max_permissible_bid(
        purse=340,
        auction_purchases_count=11,
        bucket_counts=b_counts,
        player_bucket="B1" # satisfies B1 mandatory slot
    )
    assert max_bid == 260

def test_case_4_max_bid_200_purse_13_bought_all_mins_met():
    # Purse 200. 13 players bought, all bucket minimums met.
    # Buying 1 player leaves 1 slot needed to 15. Reserved = 20. Max bid = 200 - 20 = 180.
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 2, "B5": 2}
    max_bid = calculate_max_permissible_bid(
        purse=200,
        auction_purchases_count=13,
        bucket_counts=b_counts,
        player_bucket="B1"
    )
    assert max_bid == 180

def test_case_5_max_bid_20_purse_14_bought_all_mins_met():
    # Purse 20. 14 players bought, all bucket minimums met.
    # Reserved = 0. Max bid = 20.
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 3, "B5": 2}
    max_bid = calculate_max_permissible_bid(
        purse=20,
        auction_purchases_count=14,
        bucket_counts=b_counts,
        player_bucket="B1"
    )
    assert max_bid == 20

def test_case_6_max_bid_600_purse_15_bought_no_restriction():
    # Purse 600. 15 players bought, all bucket minimums met.
    # No squad restriction applies -> Max bid = 600.
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 3, "B5": 3}
    max_bid = calculate_max_permissible_bid(
        purse=600,
        auction_purchases_count=15,
        bucket_counts=b_counts,
        player_bucket="B1"
    )
    assert max_bid == 600

# ==========================================
# A.2 Bucket Eligibility (Cases 7-10)
# ==========================================

def test_case_7_eligibility_1_slot_remaining_needs_diploma_bids_b2():
    # Franchise has 1 slot remaining (14 bought out of 15 min), needs 1 diploma player (B5).
    # Bids on B.Tech 2nd year (B2).
    # Remaining slots after buying B2 = 0. Mandatory needed = 1. 0 < 1 -> BLOCKED!
    b_counts = {"B1": 3, "B2": 3, "B3": 4, "B4": 3, "B5": 1} # needs 1 B5
    eligible, msg = check_bucket_eligibility(
        total_squad_count=16, # includes 2 retained
        auction_purchases_count=14,
        bucket_counts=b_counts,
        target_player_bucket="B2"
    )
    assert eligible is False
    assert "Blocked" in msg

def test_case_8_eligibility_3_slots_remaining_needs_2_diploma_bids_pg():
    # Franchise has 3 slots remaining (12 bought), needs 2 diploma players (B5).
    # Bids on PG player.
    # Remaining slots after = 2. Mandatory needed = 2. 2 >= 2 -> ALLOWED!
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 3, "B5": 0} # needs 2 B5
    eligible, msg = check_bucket_eligibility(
        total_squad_count=14,
        auction_purchases_count=12,
        bucket_counts=b_counts,
        target_player_bucket="PG"
    )
    assert eligible is True
    assert eligible

def test_case_9_eligibility_2_slots_remaining_needs_2_diploma_bids_pg():
    # Franchise has 2 slots remaining (13 bought), needs 2 diploma players.
    # Bids on PG player.
    # Remaining slots after = 1. Mandatory needed = 2. 1 < 2 -> BLOCKED!
    b_counts = {"B1": 4, "B2": 3, "B3": 3, "B4": 3, "B5": 0} # needs 2 B5
    eligible, msg = check_bucket_eligibility(
        total_squad_count=15,
        auction_purchases_count=13,
        bucket_counts=b_counts,
        target_player_bucket="PG"
    )
    assert eligible is False
    assert "Blocked" in msg

def test_case_10_eligibility_20_credits_1_unfilled_diploma_bids_diploma():
    # Franchise has 20 credits and one unfilled diploma slot. Bids 20 on a diploma player.
    b_counts = {"B1": 3, "B2": 3, "B3": 3, "B4": 4, "B5": 1} # needs 1 B5
    eligible, msg = check_bucket_eligibility(
        total_squad_count=16,
        auction_purchases_count=14,
        bucket_counts=b_counts,
        target_player_bucket="B5"
    )
    assert eligible is True

# ==========================================
# A.3 Scarcity Warnings (Cases 11-15)
# ==========================================

def test_case_11_scarcity_12_unsold_11_teams_need_1():
    # Diploma bucket: 12 unsold, 11 franchises still need one.
    # Unsold (12) > Needed (11) -> Allowed, NO warning.
    all_f_counts = [{"B5": 1} for _ in range(11)] # Each has 1 B5 (needs 1 more)
    unsold = {"B5": 12}
    warnings = calculate_scarcity_warnings(all_f_counts, unsold)
    assert warnings["B5"]["warning_active"] is False

def test_case_12_scarcity_11_unsold_11_teams_need_1():
    # Diploma bucket: 11 unsold, 11 franchises still need one.
    # Unsold (11) <= Needed (11) -> Scarcity warning raised!
    all_f_counts = [{"B5": 1} for _ in range(11)] # Each has 1 B5 (needs 1 more)
    unsold = {"B5": 11}
    warnings = calculate_scarcity_warnings(all_f_counts, unsold)
    assert warnings["B5"]["warning_active"] is True

def test_case_13_scarcity_11_unsold_6_teams_need_total_8():
    # Diploma bucket: 11 unsold, 6 franchises still need (4 need 1, 2 need 2 -> total players needed = 8).
    # Warning threshold is 8. Unsold (11) > 8 -> NO warning yet.
    all_f_counts = [{"B5": 1}, {"B5": 1}, {"B5": 1}, {"B5": 1}, {"B5": 0}, {"B5": 0}] + [{"B5": 2} for _ in range(5)]
    unsold = {"B5": 11}
    warnings = calculate_scarcity_warnings(all_f_counts, unsold)
    assert warnings["B5"]["total_needed_players"] == 8
    assert warnings["B5"]["warning_active"] is False

def test_case_14_scarcity_0_unsold_1_team_needs_1():
    # Diploma bucket: 0 unsold, 1 franchise still needs one.
    all_f_counts = [{"B5": 1}] + [{"B5": 2} for _ in range(10)]
    unsold = {"B5": 0}
    warnings = calculate_scarcity_warnings(all_f_counts, unsold)
    assert warnings["B5"]["warning_active"] is True
    assert warnings["B5"]["unsold_supply"] == 0

def test_case_15_scarcity_warning_clears_on_undo_returning_player():
    # Sale undone -> supply becomes 12, supply (12) > needed (11) -> warning clears immediately!
    all_f_counts = [{"B5": 1} for _ in range(11)]
    unsold_before = {"B5": 11}
    assert calculate_scarcity_warnings(all_f_counts, unsold_before)["B5"]["warning_active"] is True

    unsold_after_undo = {"B5": 12}
    assert calculate_scarcity_warnings(all_f_counts, unsold_after_undo)["B5"]["warning_active"] is False

# ==========================================
# A.5 Roll Number Parsing (Cases 19-24)
# ==========================================

def test_case_19_roll_parse_25811A0403():
    res = parse_roll_number("25811A0403")
    assert res["program"] == "B.Tech"
    assert res["branch"] == "ECE"
    assert res["entry_type"] == "regular"
    assert res["year_of_study"] == 2
    assert res["bucket"] == "B2"

def test_case_20_roll_parse_25815A0403():
    res = parse_roll_number("25815A0403")
    assert res["program"] == "B.Tech"
    assert res["branch"] == "ECE"
    assert res["entry_type"] == "lateral entry"
    assert res["year_of_study"] == 3
    assert res["bucket"] == "B3"

def test_case_21_roll_parse_23811A4201():
    res = parse_roll_number("23811A4201")
    assert res["program"] == "B.Tech"
    assert res["branch"] == "CSM"
    assert res["entry_type"] == "regular"
    assert res["year_of_study"] == 4
    assert res["bucket"] == "B4"

def test_case_22_roll_parse_24597_CM_015():
    res = parse_roll_number("24597-CM-015")
    assert res["course"] == "Diploma"
    assert res["branch"] == "CM"
    assert res["year_of_study"] == 3
    assert res["bucket"] == "B5"

def test_case_23_roll_parse_26597_M_041():
    res = parse_roll_number("26597-M-041")
    assert res["course"] == "Diploma"
    assert res["branch"] == "M"
    assert res["year_of_study"] == 1
    assert res["bucket"] == "B5"

def test_case_24_roll_parse_26811A0501():
    res = parse_roll_number("26811A0501")
    assert res["program"] == "B.Tech"
    assert res["branch"] == "CSE"
    assert res["entry_type"] == "regular"
    assert res["year_of_study"] == 1
    assert res["bucket"] == "B1"
    assert res["show_acc_reference"] is True

# ==========================================
# A.6 Bidding Mechanics (Cases 25-31)
# ==========================================

def test_case_25_increment_from_90():
    assert get_next_bid_increment(90) == 100

def test_case_26_increment_from_100():
    assert get_next_bid_increment(100) == 120

def test_case_27_increment_from_200():
    assert get_next_bid_increment(200) == 230

def test_case_28_no_jump_bidding_rejected():
    valid, msg = validate_bid_price(current_price=50, base_price=20, attempted_bid=150)
    assert valid is False
    assert "no jump bidding" in msg.lower()
