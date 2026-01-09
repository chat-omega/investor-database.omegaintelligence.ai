"""
Database connection and session management for MySQL (RDS) with SQLite fallback
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration from environment
DB_HOST = os.getenv("INVESTOR_DB_HOST", os.getenv("DB_HOST", "localhost"))
DB_PORT = os.getenv("INVESTOR_DB_PORT", os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("INVESTOR_DB_USER", os.getenv("DB_USER", "investor_user"))
DB_PASSWORD = os.getenv("INVESTOR_DB_PASSWORD", os.getenv("DB_PASSWORD", ""))

# Environment-aware database selection (dev/prod)
DB_ENVIRONMENT = os.getenv("DB_ENVIRONMENT", "prod").lower()

if DB_ENVIRONMENT == "dev":
    DB_NAME = os.getenv("INVESTOR_DB_NAME_DEV", os.getenv("DB_NAME_DEV", "investor_db_dev"))
else:
    DB_NAME = os.getenv("INVESTOR_DB_NAME_PROD", os.getenv("DB_NAME_PROD", os.getenv("DB_NAME", "investor_db")))

print(f"[Database] Environment: {DB_ENVIRONMENT}, Database: {DB_NAME}")

# Check if we should use SQLite (for local development)
USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"

# DATABASE_PATH is used for SQLite, set to None for MySQL
DATABASE_PATH = os.getenv("DATABASE_PATH", "/app/data/investor.db") if USE_SQLITE else None

if USE_SQLITE:
    # SQLite for local development
    DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Needed for SQLite
        echo=False,
        pool_pre_ping=True,
    )
else:
    # MySQL (AWS RDS) for production
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_size=5,
        max_overflow=10,
        echo=False,
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for declarative models
Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI endpoints to get database session.

    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Call this on application startup to ensure all tables exist.
    """
    from database.models import Fund, LP, LPFundCommitment, LPHolding
    Base.metadata.create_all(bind=engine)
