# Deployment Guide

## Current status

The app supports a single FastAPI backend and a Vite-built React frontend. Use a managed PostgreSQL database for production. The backend currently keeps WebSocket connections in process memory, so deploy one backend instance with one Uvicorn worker until shared pub/sub is implemented.

## Local development

1. Create a PostgreSQL database, copy `backend/.env.example` to `backend/.env`, and replace its database URL, secret, and account passwords with your values.
2. From the repository root, run `npm run dev`.
3. Open `http://localhost:3000`. The API health check is `http://127.0.0.1:8005/health`.

Do not commit `.env` files. The root launcher starts the backend through `backend/run-dev.ps1`; the backend listens on port 8005 to match the Vite proxy.

## Production backend

Configure these variables in the backend host's secret/environment settings:

- `APP_ENV=production`
- `DATABASE_URL`: persistent PostgreSQL connection URL
- `AUCTION_AUTH_SECRET`: randomly generated secret of at least 32 characters
- `AUCTION_AUTH_USERS`: JSON array of accounts, for example `[ {"username":"organizer","password":"CHANGE_ME","role":"Super Admin"}, {"username":"captain1","password":"CHANGE_ME","role":"Captain","franchise_id":1} ]`
- `CORS_ORIGINS`: exact public frontend origin, such as `https://auction.example.com`; do not use `*` in production

Supported account roles are `Super Admin`, `Admin`, `Operator`, and `Captain`. Captain accounts must use the matching database franchise ID. There are no default production credentials.

Install `backend/requirements.txt` and start the API without reload, with one worker:

```sh
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
```

Configure the host's health check to request `/health`. It returns success only when the database responds.

## Production frontend

Set `VITE_API_URL` at frontend build time to the backend origin only, without `/api`, for example `https://auction-api.example.com`. The app appends `/api` for HTTP calls and uses `wss` for WebSockets on HTTPS. Then run `npm ci` in `frontend` and `npm run build`; publish `frontend/dist` as a static site. If both apps share one origin, configure the host's reverse proxy for `/api` and `/ws` instead of setting `VITE_API_URL`.

## Before opening to users

- Verify unauthenticated `GET /api/players/admin` returns `401` and public `GET /api/auction/state` returns `200`.
- Sign in with a real Super Admin account; verify management calls work and a Captain can act only for the assigned franchise.
- Test registration, bidding, timer, undo, Excel export, and WebSocket updates in staging.
- Start with an empty PostgreSQL database or migrate any existing data using a separately planned migration process.
- Keep a database backup and confirm the host's restart/deploy behavior before the live auction.

The current app does not include multi-instance WebSocket fan-out, automated database migrations, rate limiting, or a provider-specific deployment manifest. Add these as needed before scaling or operating a high-stakes live auction.
