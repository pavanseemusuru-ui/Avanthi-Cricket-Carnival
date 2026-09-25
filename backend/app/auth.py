"""Signed, short-lived API sessions backed by server-side account configuration.

Configure AUCTION_AUTH_USERS as a JSON array of objects with username, password,
role, and optional franchise_id. Never store credentials in the browser bundle.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse

TOKEN_TTL_SECONDS = 8 * 60 * 60
ALLOWED_ROLES = {"Operator", "Captain", "Admin", "Super Admin"}


def _secret() -> bytes:
    configured = os.getenv("AUCTION_AUTH_SECRET")
    if configured:
        return configured.encode("utf-8")
    # Useful for local development; set a stable secret in deployment.
    if not hasattr(_secret, "ephemeral"):
        _secret.ephemeral = secrets.token_bytes(32)
    return _secret.ephemeral


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def login(username: str, password: str) -> dict[str, Any]:
    try:
        users = json.loads(os.getenv("AUCTION_AUTH_USERS", "[]"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=503, detail="Server account configuration is invalid.")
    account = next((u for u in users if isinstance(u, dict) and
                    hmac.compare_digest(str(u.get("username", "")), username) and
                    hmac.compare_digest(str(u.get("password", "")), password)), None)
    if not account or account.get("role") not in ALLOWED_ROLES:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    claims = {"sub": account["username"], "role": account["role"],
              "franchise_id": account.get("franchise_id"), "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    body = _encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signature = _encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return {"access_token": f"{body}.{signature}", "token_type": "bearer",
            "role": claims["role"], "franchise_id": claims["franchise_id"], "expires_in": TOKEN_TTL_SECONDS}


def verify_token(token: str) -> dict[str, Any]:
    try:
        body, signature = token.split(".", 1)
        expected = _encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if int(claims["exp"]) <= int(time.time()) or claims["role"] not in ALLOWED_ROLES:
            raise ValueError("expired")
        return claims
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Session is invalid or expired. Please sign in again.")


async def enforce_api_permissions(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api") or path == "/api/auth/login":
        return await call_next(request)
    method = request.method.upper()
    # Public read-only routes and player self-registration remain public.
    public_gets = {"/api/auction/state", "/api/players/public", "/api/franchises/public",
                   "/api/roll-parse", "/api/players/lookup"}
    if method == "GET" and path in public_gets:
        return await call_next(request)
    if method == "POST" and path == "/api/players/register":
        return await call_next(request)

    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return JSONResponse(status_code=401, content={"detail": "Sign in is required for this action."})
    try:
        claims = verify_token(authorization[7:].strip())
    except HTTPException as error:
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})
    role = claims["role"]
    admin_roles = {"Admin", "Super Admin"}
    captain_roles = admin_roles | {"Captain"}
    allowed = False
    if method == "GET":
        allowed = role in admin_roles | {"Operator"} and path in {
            "/api/players/admin", "/api/franchises/admin", "/api/audit-log", "/api/export/excel"}
        allowed = allowed or (role == "Captain" and path == "/api/captain/dashboard")
    elif path in {"/api/auction/bid", "/api/auction/pass", "/api/auction/unpass"}:
        allowed = role in captain_roles
    else:
        # Every remaining mutation is an organizer action. Caller-supplied
        # performed_by text is deliberately not used for authorization.
        allowed = role in admin_roles
    if role == "Admin" and method == "PUT" and path.endswith("/override-year"):
        allowed = False
    if not allowed:
        return JSONResponse(status_code=403, content={"detail": "Your account role cannot perform this action."})
    request.state.user = claims
    if role == "Captain" and path in {"/api/auction/bid", "/api/auction/pass", "/api/auction/unpass"}:
        franchise_id = request.query_params.get("franchise_id") if path != "/api/auction/bid" else None
        if path != "/api/auction/bid" and (not claims.get("franchise_id") or str(franchise_id) != str(claims["franchise_id"])):
            return JSONResponse(status_code=403, content={"detail": "Captains can act only for their assigned franchise."})
    return await call_next(request)
