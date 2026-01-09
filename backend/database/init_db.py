"""
Database initialization script
"""

import logging
from database.db import engine, Base
from database.models import Fund, LP, LPFundCommitment, LPHolding

logger = logging.getLogger(__name__)


def init_database():
    """
    Initialize the database by creating all tables.
    This is safe to call multiple times - it will not drop existing tables.
    """
    logger.info("Initializing database...")

    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
