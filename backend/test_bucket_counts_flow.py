import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.models import Base, Franchise, Player, AuctionState, AuditLog
from app import main

def test_bucket_counts_calculation_and_updates():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    team_a = Franchise(id=1, name="Team A", short_code="TMA", purse=1000, faculty_coordinator_name="Coord A", faculty_coordinator_dept="CSE", faculty_coordinator_mobile="9000000001")
    team_b = Franchise(id=2, name="Team B", short_code="TMB", purse=1000, faculty_coordinator_name="Coord B", faculty_coordinator_dept="ECE", faculty_coordinator_mobile="9000000002")
    session.add_all([team_a, team_b])
    session.commit()

    # Initial bucket counts for both teams must be 0
    counts_a_init = main.get_franchise_bucket_counts(session, team_a.id)
    counts_b_init = main.get_franchise_bucket_counts(session, team_b.id)
    assert counts_a_init == {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}
    assert counts_b_init == {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}

    # Add 4 players with different bucket string representations
    p1 = Player(id=1, name="P1", roll_number="R1", mobile_number="111", course="UG", program="B.Tech", branch="CSE", year_of_study=1, bucket="B1", sold_franchise_id=team_a.id, sold_type="sold", sold_price=50)
    p2 = Player(id=2, name="P2", roll_number="R2", mobile_number="222", course="UG", program="B.Tech", branch="CSE", year_of_study=3, bucket="b3", sold_franchise_id=team_a.id, sold_type="sold", sold_price=100)
    p3 = Player(id=3, name="P3", roll_number="R3", mobile_number="333", course="UG", program="B.Tech", branch="CSE", year_of_study=3, bucket="Bucket 3", sold_franchise_id=team_a.id, sold_type="sold", sold_price=70)
    p4 = Player(id=4, name="P4", roll_number="R4", mobile_number="444", course="Diploma", program="Polytechnic", branch="ME", year_of_study=3, bucket="5", sold_franchise_id=team_a.id, sold_type="direct_assigned", sold_price=20)
    p_unsold = Player(id=5, name="P5", roll_number="R5", mobile_number="555", course="UG", program="B.Tech", branch="CSE", year_of_study=3, bucket="B3", sold_franchise_id=None, sold_type=None)
    session.add_all([p1, p2, p3, p4, p_unsold])
    session.commit()

    # Team A: B1:1, B3:2, B5:1
    counts_a = main.get_franchise_bucket_counts(session, team_a.id)
    assert counts_a["B1"] == 1
    assert counts_a["B2"] == 0
    assert counts_a["B3"] == 2
    assert counts_a["B4"] == 0
    assert counts_a["B5"] == 1

    # Team B should remain all 0
    counts_b = main.get_franchise_bucket_counts(session, team_b.id)
    assert counts_b == {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "PG": 0}

    # Reversing sale for P2
    p2.sold_franchise_id = None
    p2.sold_type = None
    session.commit()

    counts_a_after_undo = main.get_franchise_bucket_counts(session, team_a.id)
    assert counts_a_after_undo["B3"] == 1

    session.close()
    engine.dispose()
