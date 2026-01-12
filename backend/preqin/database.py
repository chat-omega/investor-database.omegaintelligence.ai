"""
Database configuration and initialization for Preqin Data Layer

Supports PostgreSQL (RDS) with required extensions.
"""

import os
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# Database Configuration
# =============================================================================

# Require PREQIN_DATABASE_URL - no fallback to avoid confusion
PREQIN_DATABASE_URL = os.getenv("PREQIN_DATABASE_URL")
if not PREQIN_DATABASE_URL:
    raise ValueError(
        "PREQIN_DATABASE_URL environment variable is required. "
        "Example: postgresql://user:pass@host:5432/dbname"
    )

# Determine database type
IS_POSTGRES = PREQIN_DATABASE_URL.startswith("postgresql")
IS_SQLITE = PREQIN_DATABASE_URL.startswith("sqlite")

# Engine configuration
if IS_POSTGRES:
    engine = create_engine(
        PREQIN_DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"
    )
elif IS_SQLITE:
    engine = create_engine(
        PREQIN_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"
    )
else:
    raise ValueError(f"Unsupported database URL: {PREQIN_DATABASE_URL}")

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_preqin_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI endpoints to get Preqin database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================================================================
# Schema and Extension Initialization
# =============================================================================

def init_preqin_schemas(connection) -> None:
    """
    Initialize PostgreSQL schemas for Preqin data layer.
    Creates: preqin, preqin_bronze, preqin_silver
    """
    if not IS_POSTGRES:
        logger.info("Skipping schema creation (not PostgreSQL)")
        return

    schemas = ["preqin", "preqin_bronze", "preqin_silver"]

    for schema in schemas:
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        logger.info(f"Created schema: {schema}")

    connection.commit()


def init_preqin_extensions(connection) -> None:
    """
    Initialize PostgreSQL extensions for Preqin data layer.
    Extensions: pg_trgm, vector (pgvector), uuid-ossp
    """
    if not IS_POSTGRES:
        logger.info("Skipping extension creation (not PostgreSQL)")
        return

    extensions = [
        "uuid-ossp",      # UUID generation
        "pg_trgm",        # Trigram similarity for fuzzy matching
        "vector",         # pgvector for embeddings
    ]

    for ext in extensions:
        try:
            connection.execute(text(f"CREATE EXTENSION IF NOT EXISTS \"{ext}\""))
            logger.info(f"Created extension: {ext}")
        except Exception as e:
            logger.warning(f"Could not create extension {ext}: {e}")

    connection.commit()


def create_helper_functions(connection) -> None:
    """
    Create helper SQL functions for data processing.
    """
    if not IS_POSTGRES:
        logger.info("Skipping function creation (not PostgreSQL)")
        return

    # Function to normalize firm/fund names
    # NOTE: Uses multi-step approach to avoid regex bugs
    normalize_name_sql = """
    CREATE OR REPLACE FUNCTION preqin.normalize_name(input TEXT)
    RETURNS TEXT AS $$
    DECLARE
        result TEXT;
    BEGIN
        IF input IS NULL THEN
            RETURN NULL;
        END IF;

        -- Step 1: Remove punctuation (comma, period, apostrophe, quote, hyphen)
        result := REGEXP_REPLACE(input, '[,.''"\\-]', '', 'g');

        -- Step 2: Collapse multiple spaces
        result := REGEXP_REPLACE(result, '\\s+', ' ', 'g');

        -- Step 3: Remove common legal suffixes at end (must have space before)
        result := REGEXP_REPLACE(result, '\\s+(LLC|LP|Inc|Corp|Corporation|Ltd|Limited|PLC|LLP|PLLC|Company|Partners|GmbH|SARL|Trust|Fund|Capital|Management|Holdings|Group)$', '', 'i');

        -- Step 4: Remove leading articles
        result := REGEXP_REPLACE(result, '^(The|A|An)\\s+', '', 'i');

        -- Step 5: Trim and lowercase
        RETURN LOWER(TRIM(result));
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
    """

    # Function to parse currency strings to numeric
    parse_currency_sql = """
    CREATE OR REPLACE FUNCTION preqin.parse_currency(input TEXT)
    RETURNS NUMERIC AS $$
    DECLARE
        cleaned TEXT;
        multiplier NUMERIC := 1;
        result NUMERIC;
    BEGIN
        IF input IS NULL OR input = '' THEN
            RETURN NULL;
        END IF;

        -- Remove currency symbols and commas
        cleaned := REGEXP_REPLACE(input, '[^0-9\\.\\-]', '', 'g');

        -- Detect magnitude suffixes
        IF input ~* 'bn|billion|b$' THEN
            multiplier := 1000000000;
        ELSIF input ~* 'mn|million|m$' THEN
            multiplier := 1000000;
        ELSIF input ~* 'k|thousand' THEN
            multiplier := 1000;
        END IF;

        -- Parse the cleaned number
        BEGIN
            result := cleaned::NUMERIC * multiplier;
            RETURN result;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
    """

    # Function to generate entity document text for search
    generate_firm_doc_sql = """
    CREATE OR REPLACE FUNCTION preqin.generate_firm_doc(
        p_name TEXT,
        p_firm_type TEXT,
        p_institution_type TEXT,
        p_country TEXT,
        p_region TEXT,
        p_description TEXT,
        p_aum NUMERIC
    )
    RETURNS TEXT AS $$
    BEGIN
        RETURN COALESCE(p_name, '') || ' ' ||
               COALESCE(p_firm_type, '') || ' ' ||
               COALESCE(p_institution_type, '') || ' ' ||
               COALESCE(p_country, '') || ' ' ||
               COALESCE(p_region, '') || ' ' ||
               COALESCE(p_description, '') || ' ' ||
               CASE WHEN p_aum IS NOT NULL
                    THEN 'AUM ' || ROUND(p_aum / 1000000000, 2)::TEXT || ' billion'
                    ELSE ''
               END;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
    """

    for sql in [normalize_name_sql, parse_currency_sql, generate_firm_doc_sql]:
        try:
            connection.execute(text(sql))
            logger.info("Created helper function")
        except Exception as e:
            logger.warning(f"Could not create function: {e}")

    connection.commit()


def init_preqin_database() -> None:
    """
    Full initialization of Preqin database.
    Call this on application startup or as a setup script.
    """
    logger.info(f"Initializing Preqin database (PostgreSQL: {IS_POSTGRES})")

    with engine.connect() as connection:
        # Create schemas
        init_preqin_schemas(connection)

        # Create extensions
        init_preqin_extensions(connection)

        # Create helper functions
        create_helper_functions(connection)

    # Create tables from models
    from preqin.models import (
        PreqinFirm, PreqinFund, PreqinPerson, PreqinCompany, PreqinDeal,
        PreqinFirmManagesFund, PreqinPersonEmployment, PreqinDealInvestorFirm,
        PreqinDealInvestorFund, PreqinDealTargetCompany,
        PreqinFirmAlias, PreqinFundAlias, PreqinCoInvestmentEdge, PreqinEntityDoc,
        PreqinBronzeDeals, PreqinBronzeGP, PreqinBronzeLP, PreqinBronzeFunds
    )
    from database.db import Base

    # Import Preqin models into Base.metadata
    Base.metadata.create_all(bind=engine)
    logger.info("Created all Preqin tables")


def create_vector_index(connection, table_name: str = "preqin_entity_doc") -> None:
    """
    Create HNSW vector index for semantic search.
    Run this after embeddings are populated.
    """
    if not IS_POSTGRES:
        logger.info("Skipping vector index creation (not PostgreSQL)")
        return

    # First, alter the column to proper vector type if needed
    alter_sql = f"""
    ALTER TABLE preqin.{table_name}
    ALTER COLUMN embedding TYPE vector(1536)
    USING embedding::vector(1536);
    """

    index_sql = f"""
    CREATE INDEX IF NOT EXISTS idx_{table_name}_embedding_hnsw
    ON preqin.{table_name}
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    """

    try:
        connection.execute(text(alter_sql))
        connection.execute(text(index_sql))
        connection.commit()
        logger.info(f"Created HNSW vector index on {table_name}")
    except Exception as e:
        logger.warning(f"Could not create vector index: {e}")


def create_fts_indexes(connection) -> None:
    """
    Create full-text search indexes on entity_doc table.
    """
    if not IS_POSTGRES:
        return

    # Add generated tsvector column and GIN index
    fts_sql = """
    -- Add search vector column if not exists
    ALTER TABLE preqin.preqin_entity_doc
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(doc_text, ''))
    ) STORED;

    -- Create GIN index for FTS
    CREATE INDEX IF NOT EXISTS idx_entity_doc_fts
    ON preqin.preqin_entity_doc
    USING gin(search_vector);
    """

    try:
        connection.execute(text(fts_sql))
        connection.commit()
        logger.info("Created FTS indexes")
    except Exception as e:
        logger.warning(f"Could not create FTS index: {e}")


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    command = sys.argv[1] if len(sys.argv) > 1 else "init"

    if command == "init":
        init_preqin_database()
        print("Preqin database initialized successfully!")

    elif command == "create-vector-index":
        with engine.connect() as conn:
            create_vector_index(conn)
        print("Vector index created successfully!")

    elif command == "create-fts-index":
        with engine.connect() as conn:
            create_fts_indexes(conn)
        print("FTS indexes created successfully!")

    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m preqin.database [init|create-vector-index|create-fts-index]")
        sys.exit(1)
