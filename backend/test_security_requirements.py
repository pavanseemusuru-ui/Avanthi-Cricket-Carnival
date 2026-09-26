import base64

import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, main
from app.database import Base
from app.models import AuditLog, AuctionState, Franchise, Player


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
    operator_headers = {"authorization":f"Bearer {operator_session['access_token']}"}
    assert asyncio.run(check("/api/auction/hammer", "POST", operator_headers)).status_code == 200
    assert asyncio.run(check("/api/auction/draw-next", "POST", operator_headers)).status_code == 200
    assert asyncio.run(check("/api/auction/bid", "POST", operator_headers)).status_code == 200
    assert asyncio.run(check("/api/auction/undo", "POST", operator_headers)).status_code == 403
    assert asyncio.run(check("/api/auction/relax-minimum", "POST", operator_headers)).status_code == 403
    assert asyncio.run(check("/api/auction/auto-allot", "POST", operator_headers)).status_code == 403


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
    franchise = Franchise(
        name="Timer Test Franchise",
        short_code="TT",
        faculty_coordinator_name="Coordinator",
        faculty_coordinator_dept="CSE",
        faculty_coordinator_mobile="9999999993",
    )
    player = Player(
        roll_number="TIMER001",
        name="Timer Test Player",
        mobile_number="9999999992",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=20,
        derived_player_type="Batter",
    )
    session.add_all([franchise, player])
    session.commit()
    state = AuctionState(
        id=1,
        current_player_id=player.id,
        current_bidder_id=franchise.id,
        current_bid_price=20,
        timer_seconds=1,
        timer_running=True,
        is_paused=False,
    )
    session.add(state)
    session.commit()
    player_id = player.id

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
    assert session.get(Player, player_id).sold_franchise_id is None
    assert session.query(AuditLog).filter(AuditLog.action_type == "HAMMER_SOLD").count() == 0
    session.close()
    engine.dispose()


def make_auction_session(profile_status="completed", passed_franchise_ids="[]"):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    franchise = Franchise(
        name="Test Franchise",
        short_code="TF",
        faculty_coordinator_name="Coordinator",
        faculty_coordinator_dept="CSE",
        faculty_coordinator_mobile="9999999998",
    )
    player = Player(
        roll_number="TEST001",
        name="Test Player",
        mobile_number="9999999999",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=20,
        profile_status=profile_status,
        payment_status="paid",
        derived_player_type="Batter",
    )
    state = AuctionState(
        id=1,
        current_bucket="B1",
        current_player_id=1,
        current_bid_price=20,
        timer_seconds=30,
        timer_duration_seconds=30,
        timer_running=True,
        passed_franchise_ids=passed_franchise_ids,
    )
    session.add_all([franchise, player])
    session.commit()
    state.current_player_id = player.id
    session.add(state)
    session.commit()
    return engine, session, franchise, player, state


def test_first_bid_accepts_base_price_and_resets_next_phase_to_20_seconds(monkeypatch):
    engine, session, franchise, _player, state = make_auction_session()

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    request = main.Request({"type": "http", "state": {"user": {"role": "Captain", "franchise_id": franchise.id}}})
    result = asyncio.run(main.place_bid(main.schemas.BidRequest(franchise_id=franchise.id, attempted_bid=20), request, session))

    assert result["new_bid"] == 20
    session.refresh(state)
    assert state.current_bid_price == 20
    assert state.timer_seconds == 20
    assert state.timer_duration_seconds == 20
    assert main.get_auction_state_data(session)["next_required_bid"] == 30
    session.close()
    engine.dispose()


def test_passed_franchise_must_reenter_before_bidding(monkeypatch):
    engine, session, franchise, _player, _state = make_auction_session(
        passed_franchise_ids="[1]"
    )
    request = main.Request({"type": "http", "state": {"user": {"role": "Captain", "franchise_id": franchise.id}}})

    with pytest.raises(main.HTTPException, match="Re-enter bidding") as error:
        asyncio.run(main.place_bid(main.schemas.BidRequest(franchise_id=franchise.id, attempted_bid=20), request, session))

    assert error.value.status_code == 400
    session.close()
    engine.dispose()


def test_pending_cricheroes_profile_cannot_be_marked_paid():
    engine, session, _franchise, player, _state = make_auction_session(
        profile_status="profile_creation_pending"
    )
    player.payment_status = "unpaid"

    with pytest.raises(main.HTTPException, match="Resolve the CricHeroes profile") as error:
        asyncio.run(main.mark_player_paid(player.id, None, True, session))

    assert error.value.status_code == 400
    assert session.get(Player, player.id).payment_status == "unpaid"
    session.close()
    engine.dispose()


def test_retained_and_referred_players_do_not_count_toward_auction_bucket_quotas():
    engine, session, franchise, player, _state = make_auction_session()
    player.retained_franchise_id = franchise.id
    player.retained_role = "captain"
    player.sold_type = "retained"
    referred = Player(
        roll_number="TEST002",
        name="Referred Player",
        mobile_number="9999999997",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=20,
        referred_franchise_id=franchise.id,
        sold_type="referred",
        derived_player_type="Batter",
    )
    session.add(referred)
    session.commit()

    assert main.get_franchise_total_squad_count(session, franchise.id) == 2
    assert main.get_franchise_auction_purchases_count(session, franchise.id) == 0
    assert main.get_franchise_bucket_counts(session, franchise.id)["B1"] == 0
    session.close()
    engine.dispose()


def test_draw_skips_empty_buckets_and_reopens_unsold_players_in_round_two():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    player = Player(
        roll_number="PG2026TEST",
        name="Postgraduate Player",
        mobile_number="9999999996",
        course="PG",
        program="MBA",
        branch="Finance",
        year_of_study=1,
        bucket="PG",
        base_price=230,
        payment_status="paid",
        random_lot_number=1,
        derived_player_type="Batter",
    )
    state = AuctionState(id=1, current_bucket="B3", round_number=1, passed_franchise_ids="[]")
    session.add_all([player, state])
    session.commit()

    asyncio.run(main.draw_next_player_internal(session, state))
    session.refresh(state)
    assert state.current_player_id == player.id
    assert state.current_bucket == "PG"
    assert state.round_number == 1

    player.round_one_complete = True
    session.commit()
    asyncio.run(main.draw_next_player_internal(session, state))
    session.refresh(state)
    session.refresh(player)
    assert state.round_number == 2
    assert state.current_player_id == player.id
    assert player.base_price == 20
    session.close()
    engine.dispose()


def test_guest_draw_waits_for_and_resolves_bucket_lot_number():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    player = Player(
        roll_number="GUEST001",
        name="Guest Draw Player",
        mobile_number="9999999985",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=3,
        bucket="B3",
        base_price=50,
        payment_status="paid",
        random_lot_number=7,
        derived_player_type="Batter",
    )
    state = AuctionState(id=1, current_bucket="B3", draw_mode="guest", round_number=1)
    session.add_all([player, state])
    session.commit()

    asyncio.run(main.draw_next_player_internal(session, state))
    session.refresh(state)
    assert state.current_player_id is None

    asyncio.run(main.draw_next_player_internal(session, state, lot_number=7))
    session.refresh(state)
    assert state.current_player_id == player.id
    session.close()
    engine.dispose()


def test_skipped_player_is_recalled_once_after_unskipped_players():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    completed_player = Player(
        roll_number="B3DONE",
        name="Completed Player",
        mobile_number="9999999995",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=3,
        bucket="B3",
        base_price=20,
        payment_status="paid",
        round_one_complete=True,
        derived_player_type="Batter",
    )
    skipped_player = Player(
        roll_number="B3SKIP",
        name="Skipped Player",
        mobile_number="9999999994",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=3,
        bucket="B3",
        base_price=20,
        payment_status="paid",
        is_skipped=True,
        derived_player_type="Batter",
    )
    state = AuctionState(id=1, current_bucket="B3", round_number=1, passed_franchise_ids="[]")
    session.add_all([completed_player, skipped_player, state])
    session.commit()

    asyncio.run(main.draw_next_player_internal(session, state))
    session.refresh(state)
    session.refresh(skipped_player)
    assert state.current_player_id == skipped_player.id
    assert skipped_player.skip_recalled is True
    assert skipped_player.is_skipped is False
    session.close()
    engine.dispose()


def test_all_franchises_can_pass_without_stopping_timer_and_can_reenter(monkeypatch):
    engine, session, first_franchise, _player, state = make_auction_session()
    franchises = [first_franchise]
    for index in range(2, 12):
        franchises.append(Franchise(
            name=f"Pass Franchise {index}",
            short_code=f"P{index}",
            faculty_coordinator_name="Coordinator",
            faculty_coordinator_dept="CSE",
            faculty_coordinator_mobile=f"99999999{index:02d}",
        ))
    session.add_all(franchises[1:])
    session.commit()
    for franchise in franchises:
        session.refresh(franchise)
    state.timer_seconds = 2
    state.timer_running = True
    session.commit()

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    request = main.Request({"type": "http", "state": {}})
    for franchise in franchises:
        asyncio.run(main.pass_franchise(franchise.id, request, session))

    session.refresh(state)
    assert set(main.json.loads(state.passed_franchise_ids)) == {franchise.id for franchise in franchises}
    assert state.timer_running is True
    asyncio.run(main.unpass_franchise(first_franchise.id, request, session))
    session.refresh(state)
    assert first_franchise.id not in main.json.loads(state.passed_franchise_ids)
    assert state.timer_running is True
    session.close()
    engine.dispose()


def test_player_registration_rejects_bad_roll_and_price_but_accepts_pg_details(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    photo = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nimage").decode()

    with pytest.raises(main.HTTPException, match="Roll number does not match"):
        asyncio.run(main.register_player(main.schemas.PlayerRegisterRequest(
            roll_number="NOT-A-ROLL",
            name="Invalid Student",
            mobile_number="9999999991",
            photo_url=photo,
            confirm_fielder_only=True,
        ), session))

    with pytest.raises(main.HTTPException, match="price-ladder"):
        asyncio.run(main.register_player(main.schemas.PlayerRegisterRequest(
            roll_number="26811A0501",
            name="Invalid Price",
            mobile_number="9999999990",
            photo_url=photo,
            base_price=25,
            confirm_fielder_only=True,
        ), session))

    player = asyncio.run(main.register_player(main.schemas.PlayerRegisterRequest(
        roll_number="PG2026MBA01",
        name="PG Student",
        mobile_number="9999999989",
        program="MBA",
        branch="Finance",
        year_of_study=1,
        admission_year=main.roll_parser.CURRENT_ACADEMIC_YEAR,
        photo_url=photo,
        confirm_fielder_only=True,
    ), session))

    assert player.course == "PG"
    assert player.bucket == "PG"
    assert player.profile_status == "profile_creation_pending"
    assert player.payment_status == "unpaid"
    assert player.referring_team_name is None
    session.close()
    engine.dispose()


def test_sale_undo_restores_round_pool_and_cannot_be_applied_twice():
    engine, session, franchise, player, state = make_auction_session()
    player.sold_franchise_id = franchise.id
    player.sold_price = 30
    player.sold_type = "sold"
    player.round_one_complete = True
    sale = AuditLog(
        action_type="HAMMER_SOLD",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=30,
        performed_by="Super Admin:admin1",
        reason="Recorded sale",
    )
    bid = AuditLog(
        action_type="BID",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=30,
        performed_by="Captain:captain1",
        reason="Recorded bid",
    )
    session.add_all([sale, bid])
    session.commit()
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "admin1"}}})

    with pytest.raises(main.HTTPException, match="Only completed player assignments"):
        asyncio.run(main.undo_transaction(main.schemas.UndoRequest(audit_id=bid.id, reason="Not a sale"), request, session))

    asyncio.run(main.undo_transaction(main.schemas.UndoRequest(audit_id=sale.id, reason="Wrong recording"), request, session))
    session.refresh(player)
    session.refresh(sale)
    assert player.sold_franchise_id is None
    assert player.sold_price is None
    assert player.round_one_complete is False
    assert sale.is_undone is True
    assert session.query(AuditLog).filter(AuditLog.action_type == "UNDO").count() == 1

    with pytest.raises(main.HTTPException, match="already been undone"):
        asyncio.run(main.undo_transaction(main.schemas.UndoRequest(audit_id=sale.id, reason="Duplicate"), request, session))
    assert session.query(AuditLog).filter(AuditLog.action_type == "UNDO").count() == 1

    state.round_number = 2
    player.round_one_complete = True
    player.round_two_complete = True
    second_sale = AuditLog(
        action_type="HAMMER_SOLD",
        player_id=player.id,
        franchise_id=franchise.id,
        amount=30,
        performed_by="Super Admin:admin1",
        reason="Round two sale",
    )
    player.sold_franchise_id = franchise.id
    player.sold_price = 30
    player.sold_type = "sold"
    session.add(second_sale)
    session.commit()
    asyncio.run(main.undo_transaction(main.schemas.UndoRequest(audit_id=second_sale.id, reason="Wrong round two sale"), request, session))
    session.refresh(player)
    assert player.round_one_complete is True
    assert player.round_two_complete is False
    session.close()
    engine.dispose()


def test_super_admin_auto_allotment_assigns_at_twenty_and_logs_each_player(monkeypatch):
    engine, session, franchise, player, state = make_auction_session()
    second_franchise = Franchise(
        name="Second Test Franchise",
        short_code="STF",
        faculty_coordinator_name="Coordinator",
        faculty_coordinator_dept="CSE",
        faculty_coordinator_mobile="9999999987",
    )
    second_player = Player(
        roll_number="TEST004",
        name="Second Unsold Player",
        mobile_number="9999999986",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=100,
        payment_status="paid",
        profile_status="completed",
        round_one_complete=True,
        round_two_complete=True,
        derived_player_type="Batter",
    )
    session.add_all([second_franchise, second_player])
    session.commit()
    state.current_player_id = None
    state.round_number = 2
    state.bucket_minimums_json = '{"B1":1,"B2":0,"B3":0,"B4":0,"B5":0}'
    player.round_one_complete = True
    player.round_two_complete = True
    session.commit()
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "admin1"}}})

    result = asyncio.run(main.auto_allot_round_two(request, session))

    session.refresh(player)
    assert player.sold_franchise_id == franchise.id
    assert player.sold_price == 20
    assert player.sold_type == "allotted"
    assert {assignment["player_id"] for assignment in result["assignments"]} == {player.id, second_player.id}
    assert len({assignment["franchise_id"] for assignment in result["assignments"]}) == 2
    assert session.query(AuditLog).filter(AuditLog.action_type == "ALLOT").count() == 2
    assert second_player.sold_price == 20
    session.close()
    engine.dispose()


def test_uniform_bucket_relaxation_requires_genuine_exhaustion():
    engine, session, _franchise, player, state = make_auction_session()
    state.current_player_id = None
    state.round_number = 2
    state.bucket_minimums_json = '{"B1":2,"B2":0,"B3":0,"B4":0,"B5":0}'
    player.round_one_complete = True
    player.round_two_complete = True
    session.commit()
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "admin1"}}})

    with pytest.raises(main.HTTPException, match="only after that bucket is exhausted"):
        asyncio.run(main.relax_bucket_minimum(
            main.schemas.RelaxMinimumRequest(bucket="B1", new_minimum=1, reason="Supply shortage"),
            request,
            session,
        ))

    session.close()
    engine.dispose()


def test_referral_requires_matching_player_and_franchise_declarations():
    engine, session, franchise, player, _state = make_auction_session()
    player.referring_team_name = franchise.name
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "admin1"}}})
    payload = main.schemas.ReferPlayerRequest(player_id=player.id, franchise_id=franchise.id, reason="Verified records")

    asyncio.run(main.refer_player(payload, request, session))
    session.refresh(player)
    assert player.referred_franchise_id == franchise.id
    assert player.sold_type == "referred"
    assert session.query(AuditLog).filter(AuditLog.action_type == "REFERRAL_ASSIGNED").count() == 1

    second = Player(
        roll_number="TEST005",
        name="Conflict Referral",
        mobile_number="9999999984",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=20,
        referring_team_name="Different Franchise",
        derived_player_type="Batter",
    )
    session.add(second)
    session.commit()
    conflict_payload = main.schemas.ReferPlayerRequest(player_id=second.id, franchise_id=franchise.id, reason="Conflict")
    with pytest.raises(main.HTTPException, match="declarations conflict"):
        asyncio.run(main.refer_player(conflict_payload, request, session))

    session.close()
    engine.dispose()


def test_super_admin_year_override_updates_year_bucket_and_audit(monkeypatch):
    engine, session, _franchise, player, _state = make_auction_session()
    player.year_discrepancy_reported = True
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "organizer"}}})

    asyncio.run(main.override_player_year(player.id, 3, request, session))

    session.refresh(player)
    assert player.year_of_study == 3
    assert player.year_override == 3
    assert player.bucket == "B3"
    assert player.year_discrepancy_reported is False
    audit = session.query(AuditLog).filter(AuditLog.action_type == "YEAR_OVERRIDE").one()
    assert audit.performed_by == "Super Admin:organizer"
    session.close()
    engine.dispose()


def test_scouting_requires_genuine_bucket_exhaustion(monkeypatch):
    engine, session, franchise, candidate, state = make_auction_session()
    state.current_player_id = None
    state.round_number = 2
    state.bucket_minimums_json = '{"B1":1,"B2":0,"B3":0,"B4":0,"B5":0}'
    waiting_player = Player(
        roll_number="TEST003",
        name="Available Player",
        mobile_number="9999999988",
        course="UG",
        program="B.Tech",
        branch="CSE",
        year_of_study=1,
        bucket="B1",
        base_price=20,
        payment_status="paid",
        profile_status="completed",
        derived_player_type="Batter",
    )
    session.add(waiting_player)
    session.commit()
    request = main.Request({"type": "http", "state": {"user": {"role": "Super Admin", "sub": "admin1"}}})
    payload = main.schemas.ScoutRequest(
        player_id=candidate.id,
        franchise_id=franchise.id,
        bucket="B1",
        reason="Verified shortage",
    )

    with pytest.raises(main.HTTPException, match="while any other paid unsold player remains"):
        asyncio.run(main.scout_player(payload, request, session))

    waiting_player.payment_status = "unpaid"
    session.commit()

    async def no_broadcast(_db):
        return None

    monkeypatch.setattr(main, "broadcast_auction_state", no_broadcast)
    result = asyncio.run(main.scout_player(payload, request, session))
    session.refresh(candidate)
    assert candidate.sold_type == "scouted"
    assert candidate.sold_price == 20
    assert "20 credits" in result["message"]
    session.close()
    engine.dispose()
