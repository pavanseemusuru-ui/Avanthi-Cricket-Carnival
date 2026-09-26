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


def test_login_endpoint_and_http_authorization_are_wired(monkeypatch):
    monkeypatch.setenv("AUCTION_AUTH_SECRET", "test-only-secret")
    monkeypatch.setenv("AUCTION_AUTH_USERS", '[{"username":"admin1","password":"admin-pass","role":"Super Admin"}]')

    assert any(
        layer.kwargs.get("dispatch") is main.authorization_middleware
        for layer in main.app.user_middleware
    )
    assert any(route.path == "/api/auth/login" for route in main.app.routes)

    session = asyncio.run(main.login(main.LoginRequest(username="admin1", password="admin-pass")))
    assert auth.verify_token(session["access_token"])["role"] == "Super Admin"


def test_production_configuration_rejects_unsafe_defaults(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUCTION_AUTH_SECRET", "test-secret-long-enough-for-production-check")
    monkeypatch.setenv("AUCTION_AUTH_USERS", '[{"username":"admin1","password":"admin-pass","role":"Super Admin"}]')
    monkeypatch.setattr(main, "origins", ["https://auction.example.com"])
    monkeypatch.setattr(main, "DATABASE_URL", "sqlite:///./auction.db")

    with pytest.raises(RuntimeError, match="persistent PostgreSQL"):
        main.validate_production_configuration()


def test_captain_cannot_bid_for_another_franchise():
    request = main.Request({
        "type": "http",
        "state": {"user": {"role": "Captain", "franchise_id": 1}},
    })

    with pytest.raises(main.HTTPException) as error:
        asyncio.run(main.place_bid(
            main.schemas.BidRequest(franchise_id=2, attempted_bid=20),
            request,
            None,
        ))

    assert error.value.status_code == 403


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


def test_server_timer_stops_when_countdown_expires(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    state = AuctionState(id=1, timer_seconds=1, timer_running=True, is_paused=False)
    session.add(state)
    session.commit()

    sleep_calls = 0

    async def stop_after_one_tick(_seconds):
        nonlocal sleep_calls
        if sleep_calls:
            raise asyncio.CancelledError
        sleep_calls += 1

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "SessionLocal", lambda: session)
    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    monkeypatch.setattr(main.asyncio, "sleep", stop_after_one_tick)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(main.run_auction_timer())

    session.expire_all()
    stored_state = session.get(AuctionState, 1)
    assert stored_state.timer_seconds == 0
    assert stored_state.timer_running is False
    session.close()
    engine.dispose()
