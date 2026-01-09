"""Database connection for secondary funds SQLite database."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Path to the secondary funds database
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "secondary_funds.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine for SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_secondary_db():
    """Dependency for getting secondary funds database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
