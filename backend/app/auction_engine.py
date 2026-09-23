from typing import Dict, List, Tuple, Optional, Any

DEFAULT_BUCKET_MINIMUMS = {
    "B1": 2,
    "B2": 2,
    "B3": 2,
    "B4": 2,
    "B5": 2
}

MIN_AUCTION_SLOTS = 15
MIN_SQUAD_SIZE = 17
MAX_SQUAD_SIZE = 22
MIN_PLAYER_PRICE = 20

def get_next_bid_increment(current_price: int) -> int:
    """
    Returns the next allowed bid price given the current bid price.
    Below 100: +10
    100 to 199: +20
    200 and above: +30
    """
    if current_price < 100:
        return current_price + 10
    elif current_price < 200:
        return current_price + 20
    else:
        return current_price + 30

def validate_bid_price(current_price: int, base_price: int, attempted_bid: int) -> Tuple[bool, str]:
    """
    Validates that attempted bid is exact legal next increment without jump bidding.
    """
    if current_price == 0:
        expected_bid = base_price
    else:
        expected_bid = get_next_bid_increment(current_price)
        
    if attempted_bid != expected_bid:
        return False, f"Rejected — no jump bidding. Expected bid is {expected_bid}, got {attempted_bid}."
    return True, "Valid bid price"

def calculate_mandatory_slots_needed(
    bucket_counts: Dict[str, int],
    bucket_minimums: Dict[str, int],
    target_player_bucket: Optional[str] = None
) -> int:
    """
    Calculates total mandatory bucket slots still needed.
    If target_player_bucket is provided, simulates state AFTER acquiring a player in that bucket.
    """
    simulated_counts = dict(bucket_counts)
    if target_player_bucket and target_player_bucket in DEFAULT_BUCKET_MINIMUMS:
        simulated_counts[target_player_bucket] = simulated_counts.get(target_player_bucket, 0) + 1

    mandatory_needed = 0
    for b in DEFAULT_BUCKET_MINIMUMS:
        req_min = bucket_minimums.get(b, DEFAULT_BUCKET_MINIMUMS[b])
        curr = simulated_counts.get(b, 0)
        needed = max(0, req_min - curr)
        mandatory_needed += needed

    return mandatory_needed

def calculate_max_permissible_bid(
    purse: int,
    auction_purchases_count: int,
    bucket_counts: Dict[str, int],
    bucket_minimums: Dict[str, int] = DEFAULT_BUCKET_MINIMUMS,
    player_bucket: Optional[str] = None
) -> int:
    """
    Calculates the maximum permissible bid for a franchise (§12.1).
    """
    # If franchise already has 15 or more auction purchases, no reserved purse for minimum squad apply
    if auction_purchases_count >= MIN_AUCTION_SLOTS:
        return purse

    # If we are evaluating for a specific player purchase:
    # 1. New slots bought count = auction_purchases_count + 1
    new_purchases_count = auction_purchases_count + 1
    
    # 2. Remaining slots to reach 15
    remaining_slots_to_15 = max(0, MIN_AUCTION_SLOTS - new_purchases_count)
    
    # 3. Mandatory bucket slots needed after acquiring this player
    mandatory_needed_after = calculate_mandatory_slots_needed(bucket_counts, bucket_minimums, player_bucket)
    
    # 4. Total slots still needed after this purchase
    slots_needed_new = max(remaining_slots_to_15, mandatory_needed_after)
    
    # 5. Minimum reserved purse needed for remaining slots (at 20 credits per slot)
    reserved_purse = MIN_PLAYER_PRICE * slots_needed_new
    
    max_bid = purse - reserved_purse
    return max(0, max_bid)

def check_bucket_eligibility(
    total_squad_count: int,
    auction_purchases_count: int,
    bucket_counts: Dict[str, int],
    target_player_bucket: str,
    bucket_minimums: Dict[str, int] = DEFAULT_BUCKET_MINIMUMS
) -> Tuple[bool, str]:
    """
    Checks if a franchise is legally allowed to bid on a player in target_player_bucket (§12.2).
    """
    # 1. Total squad size limit check
    if total_squad_count + 1 > MAX_SQUAD_SIZE:
        return False, f"Blocked — squad size limit of {MAX_SQUAD_SIZE} exceeded."

    # 2. If team already has 15+ auction purchases, no slot restriction applies
    if auction_purchases_count >= MIN_AUCTION_SLOTS:
        return True, "Allowed"

    # 3. Open slots remaining to reach 15 after acquiring this player
    new_purchases_count = auction_purchases_count + 1
    remaining_slots_to_15 = max(0, MIN_AUCTION_SLOTS - new_purchases_count)

    # 4. Mandatory slots needed after acquiring this player
    mandatory_needed_after = calculate_mandatory_slots_needed(bucket_counts, bucket_minimums, target_player_bucket)

    if remaining_slots_to_15 < mandatory_needed_after:
        return False, f"Blocked — buying this player leaves insufficient slots ({remaining_slots_to_15}) to fulfill mandatory bucket requirements ({mandatory_needed_after})."

    return True, "Allowed"

def calculate_scarcity_warnings(
    all_franchises_bucket_counts: List[Dict[str, int]],
    unsold_available_counts: Dict[str, int],
    bucket_minimums: Dict[str, int] = DEFAULT_BUCKET_MINIMUMS
) -> Dict[str, Dict[str, Any]]:
    """
    Calculates scarcity status for all buckets (§12.3).
    Returns dict per bucket with supply, total_needed, and whether warning is active.
    """
    result = {}
    for bucket in DEFAULT_BUCKET_MINIMUMS:
        req_min = bucket_minimums.get(bucket, DEFAULT_BUCKET_MINIMUMS[bucket])
        total_needed_players = 0
        teams_needing = 0
        
        for f_counts in all_franchises_bucket_counts:
            curr = f_counts.get(bucket, 0)
            needed = max(0, req_min - curr)
            if needed > 0:
                total_needed_players += needed
                teams_needing += 1
                
        unsold_supply = unsold_available_counts.get(bucket, 0)
        # Scarcity warning when remaining supply <= total players needed AND needed > 0
        warning_active = (unsold_supply <= total_needed_players) and (total_needed_players > 0)
        
        result[bucket] = {
            "bucket": bucket,
            "unsold_supply": unsold_supply,
            "total_needed_players": total_needed_players,
            "teams_needing": teams_needing,
            "warning_active": warning_active
        }
        
    return result
