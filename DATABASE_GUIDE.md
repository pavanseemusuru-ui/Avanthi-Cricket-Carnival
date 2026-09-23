# Database Architecture & Hosting Guide — Avanthi Cricket Carnival

This document provides complete technical recommendations for database management, hosting architecture, real-time bidding synchronization, and production deployment for the **Avanthi Cricket Carnival Player Auction Portal**.

---

## 1. Development vs. Production Database Architecture

### **Local Development (Current Setup)**
- **Database Engine**: **SQLite** via SQLAlchemy ORM (`auction.db`).
- **Benefits**: Zero setup overhead, single file portability, instant local debugging.
- **Location**: `backend/auction.db`.

### **Production Recommended Stack**
For a live production auction with hundreds of simultaneous viewers and high-concurrency bidding, use **PostgreSQL**:
- **Managed Database**: **Supabase PostgreSQL** or **GCP Cloud SQL (PostgreSQL)**.
- **Benefits of PostgreSQL**:
  - ACID compliant transactions with `SELECT ... FOR UPDATE` locking to prevent race conditions during rapid bids.
  - Native JSONB support for bucket configurations, audit trails, and squad statistics.
  - High availability & automatic backups.

---

## 2. Real-Time Bidding Architecture (Sub-10ms Latency)

Live auctions require instant UI sync across all connected clients (Public viewers, Projector displays, Team Captains, and Super Admins).

```
   +-----------------------+           +-----------------------+
   |  Frontend Clients     | <=======> |   FastAPI WebSocket   |
   | (React + Vite App)    | WebSockets|   (Uvicorn ASGI)      |
   +-----------------------+           +-----------------------+
                                                   ||
                                                   \/
                                       +-----------------------+
                                       |  Redis Pub/Sub        |
                                       |  (Real-Time Engine)   |
                                       +-----------------------+
                                                   ||
                                                   \/
                                       +-----------------------+
                                       | PostgreSQL / Supabase |
                                       | (Persistent Store)    |
                                       +-----------------------+
```

### Key Components:
1. **Redis Pub/Sub**:
   - Stores high-frequency transient state (Current Bid Price, Active Bidder, Timer Countdown).
   - Broadcasts bidding events to all server instances instantly.
2. **WebSocket Manager**:
   - Maintained in `backend/app/websocket.py`.
   - Pushes `AUCTION_STATE_UPDATE` JSON events to connected clients upon every accepted bid or timer tick.
3. **Database Persistence**:
   - Commits finalized transactions (`HAMMER_SOLD`, `HAMMER_UNSOLD`, `DIRECT_ASSIGN`, `REGISTRATION`) to PostgreSQL.

---

## 3. Database Schema Overview

```sql
-- Franchises Table
CREATE TABLE franchises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    logo_url TEXT,
    faculty_coordinator_name VARCHAR(100),
    faculty_coordinator_dept VARCHAR(100),
    faculty_coordinator_mobile VARCHAR(20),
    captain_mobile VARCHAR(20),
    purse INTEGER DEFAULT 1000
);

-- Players Table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    roll_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    photo_url TEXT,
    course VARCHAR(50),
    program VARCHAR(50),
    branch VARCHAR(50),
    year_of_study INTEGER,
    bucket VARCHAR(10) NOT NULL,
    base_price INTEGER DEFAULT 20,
    cricheroes_url TEXT,
    cricheroes_mobile VARCHAR(20),
    profile_status VARCHAR(30) DEFAULT 'completed',
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    derived_player_type VARCHAR(50) DEFAULT 'Fielder',
    sold_franchise_id INTEGER REFERENCES franchises(id),
    retained_franchise_id INTEGER REFERENCES franchises(id),
    referred_franchise_id INTEGER REFERENCES franchises(id),
    sold_price INTEGER,
    sold_type VARCHAR(30),
    is_skipped BOOLEAN DEFAULT FALSE,
    random_lot_number INTEGER
);

-- Auction State Table
CREATE TABLE auction_state (
    id SERIAL PRIMARY KEY,
    current_bucket VARCHAR(10) DEFAULT 'B3',
    current_player_id INTEGER REFERENCES players(id),
    current_bid_price INTEGER DEFAULT 0,
    current_bidder_id INTEGER REFERENCES franchises(id),
    timer_seconds INTEGER DEFAULT 30,
    timer_duration_seconds INTEGER DEFAULT 30,
    timer_running BOOLEAN DEFAULT FALSE,
    draw_mode VARCHAR(20) DEFAULT 'auto',
    passed_franchise_ids TEXT DEFAULT '[]',
    bucket_minimums_json TEXT,
    is_paused BOOLEAN DEFAULT FALSE,
    round_number INTEGER DEFAULT 1
);

-- Audit Log Table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    player_id INTEGER REFERENCES players(id),
    franchise_id INTEGER REFERENCES franchises(id),
    amount INTEGER,
    performed_by VARCHAR(100) NOT NULL,
    reason TEXT,
    is_undone BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Production Hosting Options

| Service Layer | Recommended Hosting Provider | Free/Low-Cost Plan |
|---|---|---|
| **Frontend Web App** | **Vercel** / **Netlify** | Free Tier (Global CDN) |
| **Backend API Server** | **Render** / **Fly.io** / **GCP Cloud Run** | ~$5 - $10 / month |
| **Database (PostgreSQL)** | **Supabase** / **Neon.tech** / **GCP Cloud SQL** | Free Tier (500MB DB) |
| **Real-time Cache (Redis)** | **Upstash Redis** | Free Tier (10,000 req/day) |

---

## 5. Deployment Commands & Environment Variables

### Environment Variables (`backend/.env`):
```env
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres
REDIS_URL=redis://default:password@upstash.io:6379
SECRET_KEY=your_production_secret_key_here
```

### Run Server in Production:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```
