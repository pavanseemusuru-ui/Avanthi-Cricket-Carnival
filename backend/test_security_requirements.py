import base64

import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, main
from app.database import Base
from app.models import AuctionState, Franchise, Player


def test_signed_login_session_and_role_enforcement(monkeypatch):
    monkeypatch.setenv("AUCTION_AUTH_SECRET", "test-only-secret")
    monkeypatch.setenv("AUCTION_AUTH_USERS", '[{"username":"captain1","password":"pass","role":"Captain","franchise_id":1},{"username":"admin1","password":"admin-pass","role":"Admin"},{"username":"operator1","password":"operator-pass","role":"Operator"}]')
    async def continue_request(_request):
        return SimpleNamespace(status_code=200)

    async def check(path, method, headers=None, query=None):
        request = SimpleNamespace(url=SimpleNamespace(path=path), method=method,
                                  headers=headers or {}, query_params=query or {}, state=SimpleNamespace())
        return await auth.enforce_api_permissions(request, continue_request)

    assert asyncio.run(check("/api/players/admin", "GET")).status_code == 401
    assert asyncio.run(check("/api/auction/bid", "POST", {"authorization":"Bearer Super Admin"})).status_code == 401
    session = auth.login("captain1", "pass")
    assert auth.verify_token(session["access_token"])["franchise_id"] == 1
    assert asyncio.run(check("/api/auction/pass", "POST", {"authorization":f"Bearer {session['access_token']}"}, {"franchise_id":"2"})).status_code == 403
    admin_session = auth.login("admin1", "admin-pass")
    admin_headers = {"authorization":f"Bearer {admin_session['access_token']}"}
    assert asyncio.run(check("/api/players/1", "DELETE", admin_headers)).status_code == 200
    assert asyncio.run(check("/api/players/1/override-year", "PUT", admin_headers)).status_code == 403
    operator_session = auth.login("operator1", "operator-pass")
    assert asyncio.run(check("/api/auction/bid", "POST", {"authorization":f"Bearer {operator_session['access_token']}"})).status_code == 403


def test_photo_upload_rejects_300_kb_and_accepts_smaller_valid_png(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    player = Player(roll_number="TEST001", name="Test Player", mobile_number="9999999999", course="UG",
                    program="B.Tech", branch="CSE", year_of_study=1, bucket="B1", base_price=20,
                    derived_player_type="Batter")
    session.add(player)
    session.commit()

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    from app.main import PhotoUploadRequest, upload_player_photo

    too_large = b"\x89PNG\r\n\x1a\n" + b"x" * (300 * 1024 - 8)
    with pytest.raises(main.HTTPException) as error:
        asyncio.run(upload_player_photo(player.id, PhotoUploadRequest(photo_data="data:image/png;base64," + base64.b64encode(too_large).decode()), session))
    assert error.value.status_code == 413

    valid = b"\x89PNG\r\n\x1a\n" + b"x" * (299 * 1024 - 8)
    result = asyncio.run(upload_player_photo(player.id, PhotoUploadRequest(photo_data="data:image/png;base64," + base64.b64encode(valid).decode()), session))
    assert result["photo_url"].startswith("data:image/png;base64,")
    assert session.get(Player, player.id).photo_url == result["photo_url"]
    session.close()
    engine.dispose()


def test_server_timer_persists_sold_tie_and_unsold_results():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    team_a = Franchise(name="Team A", short_code="TA", faculty_coordinator_name="A", faculty_coordinator_dept="CSE", faculty_coordinator_mobile="9000000001", purse=1000)
    team_b = Franchise(name="Team B", short_code="TB", faculty_coordinator_name="B", faculty_coordinator_dept="CSE", faculty_coordinator_mobile="9000000002", purse=1000)
    session.add_all([team_a, team_b])
    session.flush()
    players = [Player(roll_number=f"TEST00{i}", name=f"Player {i}", mobile_number=f"999999999{i}", course="UG", program="B.Tech", branch="CSE", year_of_study=1, bucket="B1", base_price=20, derived_player_type="Batter") for i in range(1, 4)]
    session.add_all(players)
    session.flush()
    state = AuctionState(id=1, current_player_id=players[0].id, current_bid_price=75, current_bidder_id=team_a.id, timer_seconds=0, timer_running=False, tied_franchise_ids_json="[]", lot_status="BIDDING")
    session.add(state)
    session.commit()

    asyncio.run(main.auto_evaluate_lot_internal(session, state))
    assert players[0].auction_status == "SOLD" and players[0].sold_franchise_id == team_a.id
    assert main.calculate_franchise_purse(session, team_a.id) == 925

    state.current_player_id = players[1].id
    state.current_bid_price = 100
    state.current_bidder_id = team_a.id
    state.tied_franchise_ids_json = f"[{team_a.id},{team_b.id}]"
    state.lot_status = "BIDDING"
    session.commit()
    asyncio.run(main.auto_evaluate_lot_internal(session, state))
    assert players[1].auction_status == "TIE" and players[1].sold_franchise_id is None
    assert main.calculate_franchise_purse(session, team_a.id) == 925

    state.current_player_id = players[2].id
    state.current_bid_price = 0
    state.current_bidder_id = None
    state.tied_franchise_ids_json = "[]"
    state.lot_status = "BIDDING"
    session.commit()
    asyncio.run(main.auto_evaluate_lot_internal(session, state))
    assert players[2].auction_status == "UNSOLD" and players[2].sold_franchise_id is None
    assert main.calculate_franchise_purse(session, team_a.id) == 925
    session.close()
    engine.dispose()
