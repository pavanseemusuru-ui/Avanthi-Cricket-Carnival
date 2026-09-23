from app.database import SessionLocal
from app.models import Player, Franchise, AuctionState
from app.main import get_auction_state_data, get_public_franchises

def test():
    db = SessionLocal()
    try:
        state = get_auction_state_data(db)
        player_name = state["current_player"]["name"] if state.get("current_player") else "None"
        print(f"[OK] Auction State retrieved successfully. Active Player: {player_name}")
        
        franchises = get_public_franchises(db)
        print(f"[OK] Total Franchises retrieved: {len(franchises)}")
        
        players_count = db.query(Player).count()
        print(f"[OK] Total Players in DB: {players_count}")
        
    finally:
        db.close()

if __name__ == "__main__":
    test()
