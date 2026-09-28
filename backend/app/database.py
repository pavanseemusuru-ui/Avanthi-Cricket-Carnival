import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env file automatically from backend directory or parent directories
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv(find_dotenv(usecwd=True))
    load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
default_db_path = BASE_DIR / "auction.db"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL or DATABASE_URL == "sqlite:///./auction.db":
    DATABASE_URL = f"sqlite:///{default_db_path.as_posix()}"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
