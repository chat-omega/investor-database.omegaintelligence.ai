"""
Database configuration for Clean Data Layer

Reuses the same PostgreSQL instance as Preqin, with a separate 'clean_data' schema.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# Database Configuration
# =============================================================================

# Reuse the same database URL as Preqin
CLEAN_DATA_DATABASE_URL = os.getenv("PREQIN_DATABASE_URL")
if not CLEAN_DATA_DATABASE_URL:
    raise ValueError(
        "PREQIN_DATABASE_URL environment variable is required. "
        "Example: postgresql://user:pass@host:5432/dbname"
    )

IS_POSTGRES = CLEAN_DATA_DATABASE_URL.startswith("postgresql")

# Engine configuration
if IS_POSTGRES:
    engine = create_engine(
        CLEAN_DATA_DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"
    )
else:
    raise ValueError("Clean Data Layer requires PostgreSQL for JSONB support")

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
CleanDataBase = declarative_base()


def get_clean_data_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI endpoints to get Clean Data database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================================================================
# Schema Initialization
# =============================================================================

def init_clean_data_schema() -> None:
    """
    Initialize the clean_data schema in PostgreSQL.
    """
    logger.info("Initializing clean_data schema...")

    with engine.connect() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS clean_data"))
        connection.commit()
        logger.info("Created clean_data schema")

    # Import and create all tables (including enrichment models)
    from clean_data.models import (
        GPFirm, GPContact, LPInvestor, LPContact,
        Deal, Fund, FundContact, ColumnMetadata, ExportSession
    )

    # Also import enrichment models
    try:
        from enrichment.models import EnrichmentJob, EnrichmentResult
        logger.info("Enrichment models imported")
    except ImportError:
        logger.warning("Enrichment models not available")

    CleanDataBase.metadata.create_all(bind=engine)
    logger.info("Created all clean_data tables")


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_clean_data_schema()
    print("Clean Data schema initialized successfully!")
