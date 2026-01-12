"""
Batch Transformations for Preqin Data Layer

Transforms bronze layer JSONB data into structured Silver layer tables.
Runs on dev instance (t3.2xlarge) and writes to RDS PostgreSQL.

Usage:
    python -m preqin.pipelines.batch_transforms [--run-id RUN_ID]
"""

import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal, InvalidOperation

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import engine, SessionLocal

logger = logging.getLogger(__name__)


# =============================================================================
# Column Mapping Configuration
# =============================================================================

# Map common column name variations to canonical names
COLUMN_MAPPINGS = {
    # Firm identifiers
    "firm id": "firm_id",
    "firm_id": "firm_id",
    "preqin firm id": "preqin_firm_id",
    "investor id": "investor_id",
    "gp id": "gp_id",
    "lp id": "lp_id",
    
    # Firm names
    "firm name": "firm_name",
    "firm": "firm_name",
    "investor name": "firm_name",
    "investor": "firm_name",
    "gp name": "firm_name",
    "lp name": "firm_name",
    "manager name": "manager_name",
    "manager": "manager_name",
    
    # Firm types
    "firm type": "firm_type",
    "investor type": "investor_type",
    "institution type": "institution_type",
    
    # Location
    "headquarters": "headquarters",
    "headquarters city": "headquarters_city",
    "headquarters country": "headquarters_country",
    "headquarters region": "headquarters_region",
    "hq city": "headquarters_city",
    "hq country": "headquarters_country",
    "hq region": "headquarters_region",
    "city": "city",
    "country": "country",
    "region": "region",
    "location": "location",
    
    # Financial
    "aum": "aum",
    "aum (mn)": "aum_mn",
    "aum (bn)": "aum_bn",
    "aum (usd mn)": "aum_usd_mn",
    "assets under management": "aum",
    "dry powder": "dry_powder",
    "dry powder (mn)": "dry_powder_mn",
    
    # Fund fields
    "fund id": "fund_id",
    "fund_id": "fund_id",
    "preqin fund id": "preqin_fund_id",
    "fund name": "fund_name",
    "fund": "fund_name",
    "vintage": "vintage_year",
    "vintage year": "vintage_year",
    "fund size": "fund_size",
    "fund size (mn)": "fund_size_mn",
    "target size": "target_size",
    "target size (mn)": "target_size_mn",
    "strategy": "strategy",
    "sub-strategy": "sub_strategy",
    "substrategy": "sub_strategy",
    "asset class": "asset_class",
    "status": "status",
    "fund status": "fund_status",
    
    # Performance
    "irr": "irr",
    "net irr": "net_irr",
    "tvpi": "tvpi",
    "dpi": "dpi",
    "rvpi": "rvpi",
    
    # Contact fields
    "contact name": "contact_name",
    "full name": "full_name",
    "first name": "first_name",
    "last name": "last_name",
    "name": "name",
    "title": "title",
    "job title": "job_title",
    "email": "email",
    "phone": "phone",
    "telephone": "phone",
    "linkedin": "linkedin_url",
    "linkedin url": "linkedin_url",
    
    # Deal fields
    "deal id": "deal_id",
    "deal_id": "deal_id",
    "preqin deal id": "preqin_deal_id",
    "deal type": "deal_type",
    "deal date": "deal_date",
    "deal value": "deal_value",
    "deal value (mn)": "deal_value_mn",
    "deal size": "deal_size",
    "deal size (mn)": "deal_size_mn",
    "stage": "stage",
    "deal stage": "deal_stage",
    "industry": "industry",
    "sector": "sector",
    "primary industry": "primary_industry",
    "secondary industry": "secondary_industry",
    
    # Company fields
    "company": "company_name",
    "company name": "company_name",
    "portfolio company": "company_name",
    "target company": "company_name",
    "company id": "company_id",
    "website": "website",
    "description": "description",
}


def normalize_column_name(name: str) -> str:
    """
    Normalize column name to snake_case.
    """
    if not name:
        return "unknown"
    
    # Check mapping first
    name_lower = name.lower().strip()
    if name_lower in COLUMN_MAPPINGS:
        return COLUMN_MAPPINGS[name_lower]
    
    # Convert to snake_case
    # Replace special characters and whitespace with underscore
    normalized = re.sub(r'[^a-zA-Z0-9]', '_', name_lower)
    # Remove consecutive underscores
    normalized = re.sub(r'_+', '_', normalized)
    # Remove leading/trailing underscores
    normalized = normalized.strip('_')
    
    return normalized or "unknown"


def parse_currency(value: Any) -> Optional[Decimal]:
    """
    Parse currency string to decimal value in USD.
    Handles various formats: $1.5B, 1,500M, 1.5 billion, etc.
    """
    if value is None:
        return None
    
    value_str = str(value).strip()
    if not value_str or value_str.lower() in ('n/a', 'na', '-', 'undisclosed'):
        return None
    
    # Remove currency symbols and commas
    cleaned = re.sub(r'[$€£¥,]', '', value_str)
    
    # Detect multiplier
    multiplier = Decimal('1')
    if re.search(r'bn|billion|b$', cleaned, re.IGNORECASE):
        multiplier = Decimal('1000000000')
        cleaned = re.sub(r'bn|billion|b$', '', cleaned, flags=re.IGNORECASE)
    elif re.search(r'mn|million|m$', cleaned, re.IGNORECASE):
        multiplier = Decimal('1000000')
        cleaned = re.sub(r'mn|million|m$', '', cleaned, flags=re.IGNORECASE)
    elif re.search(r'k|thousand', cleaned, re.IGNORECASE):
        multiplier = Decimal('1000')
        cleaned = re.sub(r'k|thousand', '', cleaned, flags=re.IGNORECASE)
    
    # Extract numeric part
    cleaned = cleaned.strip()
    try:
        base_value = Decimal(cleaned)
        return base_value * multiplier
    except (InvalidOperation, ValueError):
        return None


def parse_date(value: Any) -> Optional[str]:
    """
    Parse date value to ISO format string.
    """
    if value is None:
        return None
    
    # Already a datetime string
    if isinstance(value, str):
        value = value.strip()
        if not value or value.lower() in ('n/a', 'na', '-'):
            return None
        
        # Try common formats
        formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%m-%d-%Y",
            "%d %b %Y",
            "%d %B %Y",
            "%b %d, %Y",
            "%B %d, %Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
        
        # ISO format already
        if re.match(r'^\d{4}-\d{2}-\d{2}', value):
            return value[:10]
        
        return None
    
    # datetime object
    if hasattr(value, 'isoformat'):
        return value.date().isoformat() if hasattr(value, 'date') else value.isoformat()[:10]
    
    return None


def parse_year(value: Any) -> Optional[int]:
    """
    Parse year from various formats.
    """
    if value is None:
        return None
    
    if isinstance(value, (int, float)):
        year = int(value)
        if 1900 <= year <= 2100:
            return year
        return None
    
    value_str = str(value).strip()
    
    # Extract 4-digit year
    match = re.search(r'\b(19|20)\d{2}\b', value_str)
    if match:
        return int(match.group())
    
    return None


def parse_percentage(value: Any) -> Optional[float]:
    """
    Parse percentage value (returns as decimal, e.g., 15% -> 0.15).
    """
    if value is None:
        return None
    
    if isinstance(value, (int, float)):
        # Assume already decimal if small, percentage if large
        if -1 <= value <= 1:
            return float(value)
        elif -100 <= value <= 100:
            return float(value) / 100
        return None
    
    value_str = str(value).strip()
    if not value_str or value_str.lower() in ('n/a', 'na', '-'):
        return None
    
    # Remove percentage sign
    cleaned = value_str.replace('%', '').strip()
    
    try:
        num = float(cleaned)
        # Convert to decimal
        if -100 <= num <= 200:  # Likely percentage
            return num / 100
        return num
    except ValueError:
        return None


# =============================================================================
# Silver Layer Transform Functions
# =============================================================================

def transform_bronze_to_silver(
    session: Session,
    bronze_table: str,
    silver_table: str,
    column_transforms: Dict[str, str],
    run_id: Optional[str] = None
) -> int:
    """
    Generic transform from bronze JSONB to structured silver table.
    
    Args:
        session: Database session
        bronze_table: Source bronze table name
        silver_table: Target silver table name
        column_transforms: Mapping of {silver_column: bronze_jsonb_path}
        run_id: Optional filter by run_id
        
    Returns:
        Number of rows transformed
    """
    # Build column extraction expressions
    select_parts = []
    for silver_col, bronze_path in column_transforms.items():
        select_parts.append(f"raw_data->>'{bronze_path}' as {silver_col}")
    
    select_clause = ", ".join(select_parts)
    
    # Build query
    where_clause = f"WHERE run_id = '{run_id}'" if run_id else ""
    
    sql = text(f"""
        INSERT INTO preqin_silver.{silver_table}
        SELECT 
            gen_random_uuid() as id,
            {select_clause},
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW() as created_at
        FROM preqin_bronze.{bronze_table}
        {where_clause}
        ON CONFLICT DO NOTHING
    """)
    
    result = session.execute(sql)
    session.commit()
    
    return result.rowcount


def create_silver_tables(session: Session) -> None:
    """
    Create silver layer tables with normalized schemas.
    """
    # Silver firms table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS preqin_silver.firms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Source tracking
            source_firm_id TEXT,
            preqin_firm_id TEXT,
            source_type TEXT,  -- 'gp' or 'lp'
            
            -- Core fields
            firm_name TEXT NOT NULL,
            firm_name_normalized TEXT,
            firm_type TEXT,
            institution_type TEXT,
            
            -- Location
            headquarters_city TEXT,
            headquarters_country TEXT,
            headquarters_region TEXT,
            
            -- Financials
            aum_usd NUMERIC(20, 2),
            aum_raw TEXT,
            dry_powder_usd NUMERIC(20, 2),
            
            -- Details
            website TEXT,
            description TEXT,
            year_founded INTEGER,
            is_listed BOOLEAN,
            ticker TEXT,
            
            -- Provenance
            source_file TEXT,
            source_sheet TEXT,
            source_row_number INTEGER,
            run_id TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Unique constraint on source
            UNIQUE (source_type, source_firm_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_silver_firms_name 
        ON preqin_silver.firms (firm_name_normalized);
        
        CREATE INDEX IF NOT EXISTS idx_silver_firms_country 
        ON preqin_silver.firms (headquarters_country);
    """))
    
    # Silver funds table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS preqin_silver.funds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Source tracking
            source_fund_id TEXT,
            preqin_fund_id TEXT,
            
            -- Core fields
            fund_name TEXT NOT NULL,
            fund_name_normalized TEXT,
            vintage_year INTEGER,
            
            -- Manager
            manager_firm_name TEXT,
            manager_firm_id TEXT,
            
            -- Size
            fund_size_usd NUMERIC(20, 2),
            fund_size_raw TEXT,
            target_size_usd NUMERIC(20, 2),
            currency TEXT,
            
            -- Strategy
            strategy TEXT,
            sub_strategy TEXT,
            asset_class TEXT,
            
            -- Status
            status TEXT,
            
            -- Focus
            geography_focus TEXT,
            sector_focus TEXT,
            domicile_country TEXT,
            
            -- Performance
            irr NUMERIC(10, 4),
            tvpi NUMERIC(10, 4),
            dpi NUMERIC(10, 4),
            
            -- Dates
            first_close_date DATE,
            final_close_date DATE,
            
            -- Provenance
            source_file TEXT,
            source_sheet TEXT,
            source_row_number INTEGER,
            run_id TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE (source_fund_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_silver_funds_name 
        ON preqin_silver.funds (fund_name_normalized);
        
        CREATE INDEX IF NOT EXISTS idx_silver_funds_vintage 
        ON preqin_silver.funds (vintage_year);
        
        CREATE INDEX IF NOT EXISTS idx_silver_funds_strategy 
        ON preqin_silver.funds (strategy);
    """))
    
    # Silver contacts table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS preqin_silver.contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Source tracking
            source_contact_id TEXT,
            source_firm_id TEXT,
            source_type TEXT,  -- 'gp' or 'lp'
            
            -- Core fields
            full_name TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            title TEXT,
            seniority_level TEXT,
            
            -- Contact info
            email TEXT,
            phone TEXT,
            linkedin_url TEXT,
            
            -- Location
            location_city TEXT,
            location_country TEXT,
            
            -- Firm
            firm_name TEXT,
            
            -- Provenance
            source_file TEXT,
            source_sheet TEXT,
            source_row_number INTEGER,
            run_id TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_silver_contacts_name 
        ON preqin_silver.contacts (full_name);
        
        CREATE INDEX IF NOT EXISTS idx_silver_contacts_firm 
        ON preqin_silver.contacts (source_firm_id);
    """))
    
    # Silver deals table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS preqin_silver.deals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Source tracking
            source_deal_id TEXT,
            preqin_deal_id TEXT,
            
            -- Core fields
            deal_type TEXT,
            deal_date DATE,
            deal_value_usd NUMERIC(20, 2),
            deal_value_raw TEXT,
            stage TEXT,
            deal_status TEXT,
            
            -- Target company
            target_company_name TEXT,
            target_company_id TEXT,
            
            -- Location
            country TEXT,
            region TEXT,
            
            -- Industry
            primary_industry TEXT,
            secondary_industry TEXT,
            
            -- Investors (raw text for later parsing)
            investor_names_raw TEXT,
            fund_names_raw TEXT,
            
            -- Provenance
            source_file TEXT,
            source_sheet TEXT,
            source_row_number INTEGER,
            run_id TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE (source_deal_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_silver_deals_date 
        ON preqin_silver.deals (deal_date);
        
        CREATE INDEX IF NOT EXISTS idx_silver_deals_type 
        ON preqin_silver.deals (deal_type);
        
        CREATE INDEX IF NOT EXISTS idx_silver_deals_industry 
        ON preqin_silver.deals (primary_industry);
    """))
    
    session.commit()
    logger.info("Created silver layer tables")


def transform_gp_firms(session: Session, run_id: Optional[str] = None) -> int:
    """
    Transform GP firm profiles from bronze to silver.
    """
    logger.info("Transforming GP firms to silver layer")
    
    # Get the bronze table that contains firm profiles
    # Usually from "Firm Profile" sheet in GP Dataset
    sql = text("""
        INSERT INTO preqin_silver.firms (
            id, source_firm_id, preqin_firm_id, source_type,
            firm_name, firm_name_normalized, firm_type, institution_type,
            headquarters_city, headquarters_country, headquarters_region,
            aum_usd, aum_raw, dry_powder_usd,
            website, description, year_founded,
            source_file, source_sheet, source_row_number, run_id, created_at
        )
        SELECT
            gen_random_uuid(),
            raw_data->>'FIRM ID',
            raw_data->>'FIRM ID',
            'gp',
            COALESCE(raw_data->>'FIRM NAME', raw_data->>'Firm Name'),
            preqin.normalize_name(COALESCE(raw_data->>'FIRM NAME', raw_data->>'Firm Name')),
            raw_data->>'FIRM TYPE',
            raw_data->>'INSTITUTION TYPE',
            raw_data->>'CITY',
            raw_data->>'COUNTRY',
            raw_data->>'REGION',
            preqin.parse_currency(COALESCE(raw_data->>'PE: ASSETS UNDER MANAGEMENT (USD MN)', raw_data->>'AUM (mn)')) * 1000000,
            COALESCE(raw_data->>'PE: ASSETS UNDER MANAGEMENT (USD MN)', raw_data->>'AUM (mn)'),
            preqin.parse_currency(raw_data->>'PE: ESTIMATED DRY POWDER (USD MN)') * 1000000,
            raw_data->>'WEBSITE',
            raw_data->>'BACKGROUND',
            NULL,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW()
        FROM preqin_bronze.gp_preqin_export_raw
        WHERE raw_data->>'FIRM NAME' IS NOT NULL
        ON CONFLICT (source_type, source_firm_id) DO UPDATE SET
            firm_name = EXCLUDED.firm_name,
            firm_name_normalized = EXCLUDED.firm_name_normalized,
            aum_usd = EXCLUDED.aum_usd,
            run_id = EXCLUDED.run_id
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Transformed {count} GP firms")
        return count
    except Exception as e:
        logger.error(f"Error transforming GP firms: {e}")
        session.rollback()
        return 0


def transform_lp_firms(session: Session, run_id: Optional[str] = None) -> int:
    """
    Transform LP firm profiles from bronze to silver.
    """
    logger.info("Transforming LP firms to silver layer")
    
    sql = text("""
        INSERT INTO preqin_silver.firms (
            id, source_firm_id, preqin_firm_id, source_type,
            firm_name, firm_name_normalized, firm_type, institution_type,
            headquarters_city, headquarters_country, headquarters_region,
            aum_usd, aum_raw,
            website, description,
            source_file, source_sheet, source_row_number, run_id, created_at
        )
        SELECT
            gen_random_uuid(),
            raw_data->>'FIRM ID',
            raw_data->>'FIRM ID',
            'lp',
            COALESCE(raw_data->>'FIRM NAME', raw_data->>'Firm Name'),
            preqin.normalize_name(COALESCE(raw_data->>'FIRM NAME', raw_data->>'Firm Name')),
            'LP',
            raw_data->>'FIRM TYPE',
            raw_data->>'CITY',
            raw_data->>'COUNTRY',
            NULL,
            preqin.parse_currency(COALESCE(raw_data->>'AUM (USD MN)', raw_data->>'AUM (mn)')) * 1000000,
            COALESCE(raw_data->>'AUM (USD MN)', raw_data->>'AUM (mn)'),
            raw_data->>'WEBSITE',
            raw_data->>'BACKGROUND',
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW()
        FROM preqin_bronze.lp_preqin_export_raw
        WHERE raw_data->>'FIRM NAME' IS NOT NULL
        ON CONFLICT (source_type, source_firm_id) DO UPDATE SET
            firm_name = EXCLUDED.firm_name,
            firm_name_normalized = EXCLUDED.firm_name_normalized,
            aum_usd = EXCLUDED.aum_usd,
            run_id = EXCLUDED.run_id
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Transformed {count} LP firms")
        return count
    except Exception as e:
        logger.error(f"Error transforming LP firms: {e}")
        session.rollback()
        return 0


def transform_funds(session: Session, run_id: Optional[str] = None) -> int:
    """
    Transform funds from bronze to silver.
    """
    logger.info("Transforming funds to silver layer")

    # Log duplicate FUND IDs before DISTINCT ON drops them
    dup_sql = text("""
        SELECT raw_data->>'FUND ID' as fund_id, COUNT(*) as cnt
        FROM preqin_bronze.funds_preqin_export_raw
        WHERE raw_data->>'FUND ID' IS NOT NULL
        GROUP BY raw_data->>'FUND ID'
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 10
    """)
    try:
        dup_result = session.execute(dup_sql)
        dups = dup_result.fetchall()
        if dups:
            total_dups = sum(row[1] - 1 for row in dups)  # Count extra records
            logger.warning(f"Dropping ~{total_dups}+ duplicate FUND ID records (keeping first by source_row_number)")
            for fund_id, cnt in dups[:5]:  # Log first 5
                logger.warning(f"  Fund ID {fund_id}: {cnt} duplicates")
    except Exception as e:
        logger.debug(f"Could not count duplicates: {e}")

    # Try from funds file first - use subquery with DISTINCT ON to handle duplicate FUND IDs
    sql = text("""
        INSERT INTO preqin_silver.funds (
            id, source_fund_id, preqin_fund_id,
            fund_name, fund_name_normalized, vintage_year,
            manager_firm_name, manager_firm_id,
            fund_size_usd, fund_size_raw, target_size_usd, currency,
            strategy, sub_strategy, asset_class, status,
            geography_focus, sector_focus, domicile_country,
            irr, tvpi, dpi,
            source_file, source_sheet, source_row_number, run_id, created_at
        )
        SELECT
            gen_random_uuid(),
            fund_id,
            fund_id,
            fund_name,
            preqin.normalize_name(fund_name),
            vintage_year,
            fund_manager,
            firm_id,
            preqin.parse_currency(fund_size_raw) * 1000000,
            fund_size_raw,
            preqin.parse_currency(hard_cap_raw) * 1000000,
            fund_currency,
            strategy,
            sub_strategy,
            asset_class,
            status,
            geographic_focus,
            core_industries,
            domicile,
            NULL,
            NULL,
            NULL,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW()
        FROM (
            SELECT DISTINCT ON (raw_data->>'FUND ID')
                raw_data->>'FUND ID' as fund_id,
                COALESCE(raw_data->>'FUND SERIES NAME', raw_data->>'FUND NAME') as fund_name,
                (raw_data->>'VINTAGE / INCEPTION YEAR')::INTEGER as vintage_year,
                raw_data->>'FUND MANAGER' as fund_manager,
                raw_data->>'FIRM ID' as firm_id,
                raw_data->>'FUND SIZE (USD MN)' as fund_size_raw,
                raw_data->>'HARD CAP (USD MN)' as hard_cap_raw,
                raw_data->>'FUND CURRENCY' as fund_currency,
                raw_data->>'STRATEGY' as strategy,
                raw_data->>'SUB-STRATEGY' as sub_strategy,
                raw_data->>'ASSET CLASS' as asset_class,
                raw_data->>'STATUS' as status,
                raw_data->>'GEOGRAPHIC FOCUS' as geographic_focus,
                raw_data->>'CORE INDUSTRIES' as core_industries,
                raw_data->>'DOMICILE' as domicile,
                source_file,
                source_sheet,
                source_row_number,
                run_id
            FROM preqin_bronze.funds_preqin_export_raw
            WHERE raw_data->>'FUND ID' IS NOT NULL
              AND COALESCE(raw_data->>'FUND SERIES NAME', raw_data->>'FUND NAME') IS NOT NULL
            ORDER BY raw_data->>'FUND ID', source_row_number
        ) AS deduped
        ON CONFLICT (source_fund_id) DO UPDATE SET
            fund_name = EXCLUDED.fund_name,
            fund_name_normalized = EXCLUDED.fund_name_normalized,
            fund_size_usd = COALESCE(EXCLUDED.fund_size_usd, preqin_silver.funds.fund_size_usd),
            run_id = EXCLUDED.run_id
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Transformed {count} funds from funds file")
        return count
    except Exception as e:
        logger.error(f"Error transforming funds: {e}")
        session.rollback()
        return 0


def transform_deals(session: Session, run_id: Optional[str] = None) -> int:
    """
    Transform deals from bronze to silver.
    """
    logger.info("Transforming deals to silver layer")

    # Log duplicate DEAL IDs before DISTINCT ON drops them
    dup_sql = text("""
        SELECT raw_data->>'DEAL ID' as deal_id, COUNT(*) as cnt
        FROM preqin_bronze.deals_raw
        WHERE raw_data->>'DEAL ID' IS NOT NULL
        GROUP BY raw_data->>'DEAL ID'
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 10
    """)
    try:
        dup_result = session.execute(dup_sql)
        dups = dup_result.fetchall()
        if dups:
            total_dups = sum(row[1] - 1 for row in dups)
            logger.warning(f"Dropping ~{total_dups}+ duplicate DEAL ID records (keeping first by source_row_number)")
            for deal_id, cnt in dups[:5]:
                logger.warning(f"  Deal ID {deal_id}: {cnt} duplicates")
    except Exception as e:
        logger.debug(f"Could not count duplicates: {e}")

    sql = text("""
        INSERT INTO preqin_silver.deals (
            id, source_deal_id, preqin_deal_id,
            deal_type, deal_date, deal_value_usd, deal_value_raw,
            stage, deal_status,
            target_company_name, target_company_id,
            country, region,
            primary_industry, secondary_industry,
            investor_names_raw, fund_names_raw,
            source_file, source_sheet, source_row_number, run_id, created_at
        )
        SELECT DISTINCT ON (raw_data->>'DEAL ID')
            gen_random_uuid(),
            raw_data->>'DEAL ID',
            raw_data->>'DEAL ID',
            raw_data->>'DEAL TYPE',
            (raw_data->>'DEAL DATE')::DATE,
            preqin.parse_currency(COALESCE(raw_data->>'DEAL SIZE (USD MN)', raw_data->>'DEAL SIZE (CURR. MN)')) * 1000000,
            COALESCE(raw_data->>'DEAL SIZE (USD MN)', raw_data->>'DEAL SIZE (CURR. MN)'),
            raw_data->>'STAGE',
            raw_data->>'DEAL STATUS',
            raw_data->>'PORTFOLIO COMPANY',
            raw_data->>'PORTFOLIO COMPANY ID',
            raw_data->>'PORTFOLIO COMPANY COUNTRY',
            raw_data->>'PORTFOLIO COMPANY REGION',
            raw_data->>'PRIMARY INDUSTRY',
            raw_data->>'INDUSTRY VERTICALS',
            raw_data->>'INVESTORS / BUYERS (FIRMS)',
            raw_data->>'INVESTORS / BUYERS (FUNDS)',
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW()
        FROM preqin_bronze.deals_raw
        WHERE raw_data->>'DEAL ID' IS NOT NULL
        ORDER BY raw_data->>'DEAL ID', source_row_number
        ON CONFLICT (source_deal_id) DO UPDATE SET
            deal_value_usd = COALESCE(EXCLUDED.deal_value_usd, preqin_silver.deals.deal_value_usd),
            run_id = EXCLUDED.run_id
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Transformed {count} deals")
        return count
    except Exception as e:
        logger.error(f"Error transforming deals: {e}")
        session.rollback()
        return 0


def transform_contacts(session: Session, source_type: str, run_id: Optional[str] = None) -> int:
    """
    Transform contacts from bronze to silver.
    
    Args:
        source_type: 'gp' or 'lp'
    """
    logger.info(f"Transforming {source_type.upper()} contacts to silver layer")
    
    bronze_table = f"{source_type}_contacts_export_raw"
    
    sql = text(f"""
        INSERT INTO preqin_silver.contacts (
            id, source_contact_id, source_firm_id, source_type,
            full_name, first_name, last_name, title, seniority_level,
            email, phone, linkedin_url,
            location_city, location_country,
            firm_name,
            source_file, source_sheet, source_row_number, run_id, created_at
        )
        SELECT
            gen_random_uuid(),
            raw_data->>'CONTACT_ID',
            raw_data->>'FIRM_ID',
            '{source_type}',
            raw_data->>'NAME',
            NULL,
            NULL,
            COALESCE(raw_data->>'JOB TITLE', raw_data->>'TITLE'),
            raw_data->>'ROLE',
            raw_data->>'EMAIL',
            raw_data->>'TEL',
            raw_data->>'LINKEDIN',
            raw_data->>'CITY',
            COALESCE(raw_data->>'COUNTRY/TERRITORY', raw_data->>'COUNTRY'),
            raw_data->>'FUND MANAGER',
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW()
        FROM preqin_bronze.{bronze_table}
        WHERE raw_data->>'NAME' IS NOT NULL
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Transformed {count} {source_type.upper()} contacts")
        return count
    except Exception as e:
        logger.error(f"Error transforming {source_type} contacts: {e}")
        session.rollback()
        return 0


def run_all_transforms(run_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Run all bronze to silver transformations.
    """
    results = {"run_id": run_id, "transforms": {}}
    
    with SessionLocal() as session:
        # Ensure silver tables exist
        create_silver_tables(session)
        
        # Transform each entity type
        results["transforms"]["gp_firms"] = transform_gp_firms(session, run_id)
        results["transforms"]["lp_firms"] = transform_lp_firms(session, run_id)
        results["transforms"]["funds"] = transform_funds(session, run_id)
        results["transforms"]["deals"] = transform_deals(session, run_id)
        results["transforms"]["gp_contacts"] = transform_contacts(session, "gp", run_id)
        results["transforms"]["lp_contacts"] = transform_contacts(session, "lp", run_id)
    
    # Summary
    total = sum(results["transforms"].values())
    results["summary"] = {"total_rows_transformed": total}
    
    logger.info(f"All transforms complete: {total} total rows")
    return results


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    import json
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Run bronze to silver transformations")
    parser.add_argument("--run-id", help="Filter by specific run_id from ingestion")
    
    args = parser.parse_args()
    
    result = run_all_transforms(run_id=args.run_id)
    print(json.dumps(result, indent=2, default=str))
