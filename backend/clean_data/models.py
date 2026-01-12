"""
SQLAlchemy models for Clean Data Layer

Each model stores Excel sheet data with:
- JSONB for flexible column storage (preserves all original columns)
- Extracted key columns for efficient indexing/filtering
- Source provenance tracking
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Numeric, DateTime, Boolean, Text,
    Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from clean_data.database import CleanDataBase


# =============================================================================
# GP Dataset Models
# =============================================================================

class GPFirm(CleanDataBase):
    """
    GP Dataset - Preqin_Export sheet
    Source: GP Dataset Prequin.xlsx, Sheet: Preqin_Export
    ~43,744 rows, 131 columns
    """
    __tablename__ = "gp_firms"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    firm_id = Column(String(100), index=True)
    firm_name = Column(String(500), index=True)
    firm_type = Column(String(100))
    headquarters_country = Column(String(100), index=True)
    headquarters_city = Column(String(200))
    aum_usd = Column(Numeric(20, 2), index=True)
    year_founded = Column(Integer)

    # Provenance
    source_file = Column(String(255), nullable=False, default="GP Dataset Prequin.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Preqin_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GPContact(CleanDataBase):
    """
    GP Dataset - Contacts_Export sheet
    Source: GP Dataset Prequin.xlsx, Sheet: Contacts_Export
    ~291,386 rows, 18 columns
    """
    __tablename__ = "gp_contacts"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    contact_id = Column(String(100), index=True)
    firm_id = Column(String(100), index=True)
    name = Column(String(300), index=True)
    email = Column(String(255))
    title = Column(String(300))

    # Provenance
    source_file = Column(String(255), nullable=False, default="GP Dataset Prequin.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Contacts_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# LP Dataset Models
# =============================================================================

class LPInvestor(CleanDataBase):
    """
    LP Dataset - Preqin_Export sheet
    Source: LP Dataset Prequin.xlsx, Sheet: Preqin_Export
    ~32,065 rows, 215 columns
    """
    __tablename__ = "lp_investors"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    firm_id = Column(String(100), index=True)
    firm_name = Column(String(500), index=True)
    institution_type = Column(String(200))
    headquarters_country = Column(String(100), index=True)
    headquarters_city = Column(String(200))
    total_aum_usd = Column(Numeric(20, 2), index=True)
    year_founded = Column(Integer)

    # Provenance
    source_file = Column(String(255), nullable=False, default="LP Dataset Prequin.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Preqin_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LPContact(CleanDataBase):
    """
    LP Dataset - Contacts_Export sheet
    Source: LP Dataset Prequin.xlsx, Sheet: Contacts_Export
    ~239,796 rows, 18 columns
    """
    __tablename__ = "lp_contacts"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    contact_id = Column(String(100), index=True)
    firm_id = Column(String(100), index=True)
    name = Column(String(300), index=True)
    email = Column(String(255))
    title = Column(String(300))

    # Provenance
    source_file = Column(String(255), nullable=False, default="LP Dataset Prequin.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Contacts_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Deals Dataset Model
# =============================================================================

class Deal(CleanDataBase):
    """
    Deals Export - Preqin_Export sheet
    Source: Preqin_deals_export.xlsx, Sheet: Preqin_Export
    ~834,321 rows, 40 columns
    """
    __tablename__ = "deals"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    deal_id = Column(String(100), index=True)
    portfolio_company = Column(String(500), index=True)
    deal_date = Column(String(50), index=True)
    deal_type = Column(String(100))
    deal_value_usd = Column(Numeric(20, 2), index=True)
    country = Column(String(100), index=True)
    industry = Column(String(200))

    # Provenance
    source_file = Column(String(255), nullable=False, default="Preqin_deals_export.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Preqin_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Private Market Funds Models
# =============================================================================

class Fund(CleanDataBase):
    """
    Private Market Funds - Preqin_Export sheet
    Source: Private Market Funds.xlsx, Sheet: Preqin_Export
    ~82,962 rows, 133 columns
    """
    __tablename__ = "funds"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    fund_id = Column(String(100), index=True)
    fund_name = Column(String(500), index=True)
    firm_id = Column(String(100), index=True)
    firm_name = Column(String(500))
    vintage_year = Column(Integer, index=True)
    fund_size_usd = Column(Numeric(20, 2), index=True)
    strategy = Column(String(200))
    status = Column(String(100))

    # Provenance
    source_file = Column(String(255), nullable=False, default="Private Market Funds.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Preqin_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FundContact(CleanDataBase):
    """
    Private Market Funds - Contacts_Export sheet
    Source: Private Market Funds.xlsx, Sheet: Contacts_Export
    ~186,163 rows, 17 columns
    """
    __tablename__ = "fund_contacts"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    row_number = Column(Integer, nullable=False)

    # All columns stored as JSONB
    data = Column(JSONB, nullable=False)

    # Extracted key columns for indexing
    contact_id = Column(String(100), index=True)
    firm_id = Column(String(100), index=True)
    name = Column(String(300), index=True)
    email = Column(String(255))
    title = Column(String(300))

    # Provenance
    source_file = Column(String(255), nullable=False, default="Private Market Funds.xlsx")
    source_sheet = Column(String(100), nullable=False, default="Contacts_Export")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Column Metadata Model
# =============================================================================

class ColumnMetadata(CleanDataBase):
    """
    Stores column metadata for each table/sheet for display configuration.
    """
    __tablename__ = "column_metadata"
    __table_args__ = (
        UniqueConstraint('table_name', 'column_key', name='uq_table_column'),
        {"schema": "clean_data"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_name = Column(String(100), nullable=False, index=True)
    column_key = Column(String(255), nullable=False)      # snake_case key in JSONB
    column_name = Column(String(255), nullable=False)     # Original Excel column name
    column_index = Column(Integer, nullable=False)        # Order in Excel
    data_type = Column(String(50), default="string")      # string, number, date, boolean
    is_visible_default = Column(Boolean, default=True)    # Show by default
    width_hint = Column(Integer)                          # Suggested column width

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Table Registry
# =============================================================================

# Maps dataset/sheet identifiers to model classes
TABLE_REGISTRY = {
    "gp-dataset": {
        "firms": GPFirm,
        "contacts": GPContact,
    },
    "lp-dataset": {
        "investors": LPInvestor,
        "contacts": LPContact,
    },
    "deals-dataset": {
        "deals": Deal,
    },
    "funds-dataset": {
        "funds": Fund,
        "contacts": FundContact,
    },
}

# Maps model classes to their key column extraction functions
KEY_COLUMN_EXTRACTORS = {
    GPFirm: lambda row: {
        "firm_id": row.get("FIRM ID") or row.get("firm_id"),
        "firm_name": row.get("FIRM NAME") or row.get("firm_name"),
        "firm_type": row.get("FIRM TYPE") or row.get("firm_type"),
        "headquarters_country": row.get("COUNTRY") or row.get("country") or row.get("HQ COUNTRY"),
        "headquarters_city": row.get("CITY") or row.get("city") or row.get("HQ CITY"),
        "aum_usd": _parse_numeric(row.get("AUM (USD MN)") or row.get("aum_usd_mn")),
        "year_founded": _parse_int(row.get("YEAR EST.") or row.get("year_est")),
    },
    GPContact: lambda row: {
        "contact_id": row.get("CONTACT_ID") or row.get("contact_id"),
        "firm_id": row.get("FIRM_ID") or row.get("firm_id"),
        "name": row.get("NAME") or row.get("name"),
        "email": row.get("EMAIL") or row.get("email"),
        "title": row.get("JOB TITLE") or row.get("job_title") or row.get("TITLE"),
    },
    LPInvestor: lambda row: {
        "firm_id": row.get("FIRM ID") or row.get("firm_id"),
        "firm_name": row.get("FIRM NAME") or row.get("firm_name"),
        "institution_type": row.get("INSTITUTION TYPE") or row.get("institution_type"),
        "headquarters_country": row.get("COUNTRY") or row.get("country") or row.get("HQ COUNTRY"),
        "headquarters_city": row.get("CITY") or row.get("city") or row.get("HQ CITY"),
        "total_aum_usd": _parse_numeric(row.get("AUM (USD MN)") or row.get("aum_usd_mn")),
        "year_founded": _parse_int(row.get("YEAR EST.") or row.get("year_est")),
    },
    LPContact: lambda row: {
        "contact_id": row.get("CONTACT_ID") or row.get("contact_id"),
        "firm_id": row.get("FIRM_ID") or row.get("firm_id"),
        "name": row.get("NAME") or row.get("name"),
        "email": row.get("EMAIL") or row.get("email"),
        "title": row.get("JOB TITLE") or row.get("job_title") or row.get("TITLE"),
    },
    Deal: lambda row: {
        "deal_id": row.get("DEAL ID") or row.get("deal_id"),
        "portfolio_company": row.get("PORTFOLIO COMPANY") or row.get("portfolio_company"),
        "deal_date": row.get("DEAL DATE") or row.get("deal_date"),
        "deal_type": row.get("DEAL TYPE") or row.get("deal_type") or row.get("STAGE"),
        "deal_value_usd": _parse_numeric(row.get("DEAL SIZE (USD MN)") or row.get("deal_size_usd_mn")),
        "country": row.get("COUNTRY") or row.get("country"),
        "industry": row.get("PRIMARY INDUSTRY") or row.get("primary_industry"),
    },
    Fund: lambda row: {
        "fund_id": row.get("FUND ID") or row.get("fund_id"),
        "fund_name": row.get("NAME") or row.get("name") or row.get("FUND NAME"),
        "firm_id": row.get("FIRM ID") or row.get("firm_id"),
        "firm_name": row.get("FIRM NAME") or row.get("firm_name"),
        "vintage_year": _parse_int(row.get("VINTAGE/INCEPTION YEAR") or row.get("vintage_inception_year")),
        "fund_size_usd": _parse_numeric(row.get("FUND SIZE (USD MN)") or row.get("fund_size_usd_mn")),
        "strategy": row.get("STRATEGY") or row.get("strategy"),
        "status": row.get("STATUS") or row.get("status"),
    },
    FundContact: lambda row: {
        "contact_id": row.get("CONTACT_ID") or row.get("contact_id"),
        "firm_id": row.get("FIRM_ID") or row.get("firm_id"),
        "name": row.get("NAME") or row.get("name"),
        "email": row.get("EMAIL") or row.get("email"),
        "title": row.get("JOB TITLE") or row.get("job_title") or row.get("TITLE"),
    },
}


def _parse_numeric(value) -> float | None:
    """Parse a numeric value, handling None and strings."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) * 1_000_000  # Convert from millions
    try:
        return float(str(value).replace(",", "")) * 1_000_000
    except (ValueError, TypeError):
        return None


def _parse_int(value) -> int | None:
    """Parse an integer value."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None
