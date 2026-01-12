"""
SQLAlchemy models for the Preqin Data Layer

Core entities: Firm, Fund, Person, Company, Deal
Relationships: firm_manages_fund, person_employment, deal_investor_firm, etc.
Entity resolution: firm_alias, fund_alias
Derived: co_investment_edge
Search: entity_doc with pgvector embeddings
"""

from sqlalchemy import (
    Column, String, Text, Float, Integer, DateTime, Date, Boolean,
    Numeric, Index, ForeignKey, CheckConstraint, UniqueConstraint,
    ARRAY, JSON, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from database.db import Base


# =============================================================================
# Helper Mixins
# =============================================================================

class ProvenanceMixin:
    """Mixin for provenance tracking (source file/sheet/row)"""
    source_file = Column(String(255), nullable=False)
    source_sheet = Column(String(100), nullable=True)
    source_row_number = Column(Integer, nullable=True)
    run_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TimestampMixin:
    """Mixin for timestamp tracking only"""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# =============================================================================
# Core Entity Tables (Gold Layer)
# =============================================================================

class PreqinFirm(Base, ProvenanceMixin):
    """
    Firm entity representing GPs, LPs, Fund Managers, etc.

    Unified table for all firm types from GP and LP exports.
    """
    __tablename__ = "preqin_firms"
    __table_args__ = (
        UniqueConstraint('source_system', 'source_id', name='uq_firm_source'),
        {"schema": "preqin"}
    )

    # Primary key (internal UUID)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source system tracking (preserve original IDs)
    source_system = Column(String(50), nullable=False, default="preqin")
    source_id = Column(String(100), nullable=True, index=True)  # Original Preqin FIRM ID
    preqin_id = Column(String(50), nullable=True, index=True)  # Alias for backwards compat

    # Core fields
    name = Column(String(500), nullable=False, index=True)
    name_normalized = Column(String(500), nullable=True, index=True)

    # Classification
    firm_type = Column(String(50), nullable=True, index=True)  # GP, LP, BOTH
    institution_type = Column(String(100), nullable=True, index=True)

    # Geography
    headquarters_city = Column(String(200), nullable=True)
    headquarters_state = Column(String(100), nullable=True)
    headquarters_country = Column(String(100), nullable=True, index=True)
    headquarters_region = Column(String(100), nullable=True, index=True)

    # Financials
    aum_usd = Column(Numeric(20, 2), nullable=True, index=True)
    aum_raw = Column(String(500), nullable=True)  # Expanded from 100
    dry_powder_usd = Column(Numeric(20, 2), nullable=True)
    dry_powder_raw = Column(String(500), nullable=True)  # Expanded from 100

    # Additional details
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    year_founded = Column(Integer, nullable=True)

    # Ownership
    ownership_type = Column(String(50), nullable=True)
    is_listed = Column(Boolean, nullable=True)
    ticker = Column(String(20), nullable=True)

    # Entity resolution
    confidence_score = Column(Numeric(3, 2), default=1.0)

    # Relationships
    managed_funds = relationship("PreqinFund", back_populates="managing_firm",
                                  foreign_keys="PreqinFund.managing_firm_id")
    employments = relationship("PreqinPersonEmployment", back_populates="firm")
    deal_investments = relationship("PreqinDealInvestorFirm", back_populates="firm")
    aliases = relationship("PreqinFirmAlias", back_populates="canonical_firm")

    def __repr__(self):
        return f"<PreqinFirm(id={self.id}, name={self.name}, type={self.firm_type})>"


class PreqinFund(Base, ProvenanceMixin):
    """
    Fund entity representing private market funds.
    """
    __tablename__ = "preqin_funds"
    __table_args__ = (
        UniqueConstraint('source_system', 'source_id', name='uq_fund_source'),
        {"schema": "preqin"}
    )

    # Primary key (internal UUID)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source system tracking (preserve original IDs)
    source_system = Column(String(50), nullable=False, default="preqin")
    source_id = Column(String(100), nullable=True, index=True)  # Original Preqin FUND ID
    preqin_id = Column(String(50), nullable=True, index=True)  # Alias
    fund_series_id = Column(String(50), nullable=True)

    # Core fields
    name = Column(String(500), nullable=False, index=True)
    name_normalized = Column(String(500), nullable=True, index=True)

    # Manager relationship
    managing_firm_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                              nullable=True, index=True)

    # Fund details
    vintage_year = Column(Integer, nullable=True, index=True)
    fund_size_usd = Column(Numeric(20, 2), nullable=True, index=True)
    fund_size_raw = Column(String(500), nullable=True)  # Expanded from 100
    target_size_usd = Column(Numeric(20, 2), nullable=True)
    currency = Column(String(10), nullable=True)

    # Strategy
    strategy = Column(String(100), nullable=True, index=True)
    sub_strategy = Column(String(200), nullable=True)

    # Status and geography
    status = Column(String(50), nullable=True, index=True)
    domicile_country = Column(String(100), nullable=True)
    geography_focus = Column(String(200), nullable=True)
    sector_focus = Column(String(2000), nullable=True)  # Expanded from 500

    # Dates
    first_close_date = Column(Date, nullable=True)
    final_close_date = Column(Date, nullable=True)

    # Performance metrics
    irr = Column(Numeric(8, 4), nullable=True)
    tvpi = Column(Numeric(8, 4), nullable=True)
    dpi = Column(Numeric(8, 4), nullable=True)
    pme = Column(Numeric(8, 4), nullable=True)

    # Relationships
    managing_firm = relationship("PreqinFirm", back_populates="managed_funds",
                                  foreign_keys=[managing_firm_id])
    deal_investments = relationship("PreqinDealInvestorFund", back_populates="fund")
    aliases = relationship("PreqinFundAlias", back_populates="canonical_fund")

    def __repr__(self):
        return f"<PreqinFund(id={self.id}, name={self.name}, vintage={self.vintage_year})>"


class PreqinPerson(Base, ProvenanceMixin):
    """
    Person/Contact entity from GP and LP contact exports.
    """
    __tablename__ = "preqin_persons"
    __table_args__ = (
        UniqueConstraint('source_system', 'source_id', name='uq_person_source'),
        {"schema": "preqin"}
    )

    # Primary key (internal UUID)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source system tracking (preserve original IDs)
    source_system = Column(String(50), nullable=False, default="preqin")
    source_id = Column(String(100), nullable=True, index=True)  # Original Preqin CONTACT ID
    preqin_id = Column(String(50), nullable=True, index=True)  # Alias

    # Name fields
    full_name = Column(String(300), nullable=False, index=True)
    name_normalized = Column(String(300), nullable=True, index=True)
    first_name = Column(String(150), nullable=True)
    last_name = Column(String(150), nullable=True)

    # Contact info
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    linkedin_url = Column(String(500), nullable=True)

    # Role
    title = Column(String(200), nullable=True)
    seniority_level = Column(String(50), nullable=True)

    # Location
    location_city = Column(String(200), nullable=True)
    location_country = Column(String(100), nullable=True)
    location_region = Column(String(100), nullable=True)

    # Relationships
    employments = relationship("PreqinPersonEmployment", back_populates="person")

    def __repr__(self):
        return f"<PreqinPerson(id={self.id}, name={self.full_name})>"


class PreqinCompany(Base, ProvenanceMixin):
    """
    Portfolio company entity from deals export.
    """
    __tablename__ = "preqin_companies"
    __table_args__ = (
        UniqueConstraint('source_system', 'source_id', name='uq_company_source'),
        {"schema": "preqin"}
    )

    # Primary key (internal UUID)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source system tracking (preserve original IDs)
    source_system = Column(String(50), nullable=False, default="preqin")
    source_id = Column(String(100), nullable=True, index=True)  # Original Preqin PORTFOLIO COMPANY ID
    preqin_id = Column(String(50), nullable=True, index=True)  # Alias

    # Core fields
    name = Column(String(500), nullable=False, index=True)
    name_normalized = Column(String(500), nullable=True, index=True)

    # Details
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # Location
    city = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True, index=True)
    region = Column(String(100), nullable=True, index=True)

    # Industry
    primary_industry = Column(String(200), nullable=True, index=True)
    secondary_industry = Column(String(200), nullable=True)

    # Status
    status = Column(String(50), nullable=True)  # Active, Exited, Bankrupt

    # Relationships
    deals = relationship("PreqinDeal", back_populates="target_company")

    def __repr__(self):
        return f"<PreqinCompany(id={self.id}, name={self.name})>"


class PreqinDeal(Base, ProvenanceMixin):
    """
    Deal/Transaction entity from deals export.
    """
    __tablename__ = "preqin_deals"
    __table_args__ = (
        UniqueConstraint('source_system', 'source_id', name='uq_deal_source'),
        {"schema": "preqin"}
    )

    # Primary key (internal UUID)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source system tracking (preserve original IDs)
    source_system = Column(String(50), nullable=False, default="preqin")
    source_id = Column(String(100), nullable=True, index=True)  # Original Preqin DEAL ID
    preqin_id = Column(String(50), nullable=True, index=True)  # Alias

    # Target company
    target_company_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_companies.id"),
                               nullable=True, index=True)

    # Deal details
    deal_type = Column(String(100), nullable=True, index=True)
    deal_date = Column(Date, nullable=True, index=True)
    announced_date = Column(Date, nullable=True)
    closed_date = Column(Date, nullable=True)

    # Value
    deal_value_usd = Column(Numeric(20, 2), nullable=True, index=True)
    deal_value_raw = Column(String(500), nullable=True)  # Expanded from 100
    equity_value_usd = Column(Numeric(20, 2), nullable=True)
    enterprise_value_usd = Column(Numeric(20, 2), nullable=True)

    # Classification
    stage = Column(String(100), nullable=True, index=True)
    deal_status = Column(String(50), nullable=True)

    # Industry and geography
    primary_industry = Column(String(200), nullable=True, index=True)
    secondary_industry = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True, index=True)
    region = Column(String(100), nullable=True)

    # Relationships
    target_company = relationship("PreqinCompany", back_populates="deals")
    investor_firms = relationship("PreqinDealInvestorFirm", back_populates="deal")
    investor_funds = relationship("PreqinDealInvestorFund", back_populates="deal")

    def __repr__(self):
        return f"<PreqinDeal(id={self.id}, type={self.deal_type}, date={self.deal_date})>"


# =============================================================================
# Relationship Tables
# =============================================================================

class PreqinFirmManagesFund(Base, TimestampMixin):
    """
    Relationship: Firm manages Fund
    """
    __tablename__ = "preqin_firm_manages_fund"
    __table_args__ = (
        UniqueConstraint('firm_id', 'fund_id', name='uq_firm_fund'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                     nullable=False, index=True)
    fund_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_funds.id"),
                     nullable=False, index=True)

    role = Column(String(50), default="Manager")
    confidence_score = Column(Numeric(3, 2), default=1.0)
    source_file = Column(String(255), nullable=True)


class PreqinPersonEmployment(Base, TimestampMixin):
    """
    Relationship: Person employed at Firm
    """
    __tablename__ = "preqin_person_employment"
    __table_args__ = (
        UniqueConstraint('person_id', 'firm_id', 'title', name='uq_person_firm_title'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_persons.id"),
                       nullable=False, index=True)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                     nullable=False, index=True)

    title = Column(String(200), nullable=True)
    department = Column(String(100), nullable=True)
    is_current = Column(Boolean, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    confidence_score = Column(Numeric(3, 2), default=1.0)
    source_file = Column(String(255), nullable=True)

    # Relationships
    person = relationship("PreqinPerson", back_populates="employments")
    firm = relationship("PreqinFirm", back_populates="employments")


class PreqinDealInvestorFirm(Base, TimestampMixin):
    """
    Relationship: Firm invested in Deal

    Includes entity resolution fields for unresolved investor names.
    """
    __tablename__ = "preqin_deal_investor_firm"
    __table_args__ = (
        # Note: Partial unique constraint created via Index below
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_deals.id"),
                     nullable=False, index=True)

    # Resolved firm (nullable if unresolved)
    investor_firm_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                              nullable=True, index=True)

    # Raw name for audit and resolution
    investor_firm_name_raw = Column(String(500), nullable=False)
    investor_type = Column(String(100), nullable=True, index=True)
    role_in_deal = Column(String(50), nullable=True)  # Lead, Co-investor, etc.
    investment_amount_usd = Column(Numeric(20, 2), nullable=True)

    # Entity resolution tracking
    resolution_method = Column(String(50), nullable=True)  # id, exact, fuzzy, manual, unresolved
    confidence_score = Column(Numeric(3, 2), default=0.0)

    source_file = Column(String(255), nullable=True)

    # Relationships
    deal = relationship("PreqinDeal", back_populates="investor_firms")
    firm = relationship("PreqinFirm", back_populates="deal_investments")


class PreqinDealInvestorFund(Base, TimestampMixin):
    """
    Relationship: Fund invested in Deal
    """
    __tablename__ = "preqin_deal_investor_fund"
    __table_args__ = (
        UniqueConstraint('deal_id', 'investor_fund_name_raw', name='uq_deal_investor_fund_raw'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_deals.id"),
                     nullable=False, index=True)

    # Resolved fund (nullable if unresolved)
    investor_fund_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_funds.id"),
                              nullable=True, index=True)

    # Raw name for audit and resolution
    investor_fund_name_raw = Column(String(500), nullable=False)
    role_in_deal = Column(String(50), nullable=True)
    investment_amount_usd = Column(Numeric(20, 2), nullable=True)

    # Entity resolution tracking
    resolution_method = Column(String(50), nullable=True)
    confidence_score = Column(Numeric(3, 2), default=0.0)

    source_file = Column(String(255), nullable=True)

    # Relationships
    deal = relationship("PreqinDeal", back_populates="investor_funds")
    fund = relationship("PreqinFund", back_populates="deal_investments")


class PreqinDealTargetCompany(Base, TimestampMixin):
    """
    Relationship: Deal targets Company (explicit relationship table)
    """
    __tablename__ = "preqin_deal_target_company"
    __table_args__ = (
        UniqueConstraint('deal_id', 'company_id', name='uq_deal_company'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_deals.id"),
                     nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_companies.id"),
                        nullable=False, index=True)

    confidence_score = Column(Numeric(3, 2), default=1.0)
    source_file = Column(String(255), nullable=True)


# =============================================================================
# Entity Resolution Tables
# =============================================================================

class PreqinFirmAlias(Base, TimestampMixin):
    """
    Firm name aliases for entity resolution.
    Maps name variations to canonical firm IDs.
    """
    __tablename__ = "preqin_firm_alias"
    __table_args__ = (
        UniqueConstraint('alias_text_normalized', 'canonical_firm_id', name='uq_firm_alias'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_firm_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                               nullable=False, index=True)

    alias_text = Column(String(500), nullable=False)
    alias_text_normalized = Column(String(500), nullable=False, index=True)

    match_method = Column(String(50), nullable=False)  # exact, splink, manual
    confidence_score = Column(Numeric(3, 2), nullable=False)

    source_file = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="system")

    # Relationship
    canonical_firm = relationship("PreqinFirm", back_populates="aliases")


class PreqinFundAlias(Base, TimestampMixin):
    """
    Fund name aliases for entity resolution.
    """
    __tablename__ = "preqin_fund_alias"
    __table_args__ = (
        UniqueConstraint('alias_text_normalized', 'canonical_fund_id', name='uq_fund_alias'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_fund_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_funds.id"),
                               nullable=False, index=True)

    alias_text = Column(String(500), nullable=False)
    alias_text_normalized = Column(String(500), nullable=False, index=True)

    match_method = Column(String(50), nullable=False)
    confidence_score = Column(Numeric(3, 2), nullable=False)

    source_file = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="system")

    # Relationship
    canonical_fund = relationship("PreqinFund", back_populates="aliases")


# =============================================================================
# Derived Tables
# =============================================================================

class PreqinCoInvestmentEdge(Base, TimestampMixin):
    """
    Pre-computed co-investment edges for network analysis.

    Generated by batch job from deal_investor_firm pairs.
    Enforces firm_a_id < firm_b_id to avoid duplicates.

    Note: deal_ids array removed to avoid scaling issues.
    Use drilldown query to get specific deals for a pair.
    """
    __tablename__ = "preqin_co_investment_edge"
    __table_args__ = (
        CheckConstraint('firm_a_id < firm_b_id', name='ck_firm_ordering'),
        UniqueConstraint('firm_a_id', 'firm_b_id', name='uq_co_investment_pair'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_a_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                       nullable=False, index=True)
    firm_b_id = Column(UUID(as_uuid=True), ForeignKey("preqin.preqin_firms.id"),
                       nullable=False, index=True)

    # Aggregated metrics only (no deal_ids array to avoid bloat)
    deal_count = Column(Integer, default=1)
    total_value_usd = Column(Numeric(20, 2), nullable=True)
    first_deal_date = Column(Date, nullable=True)
    last_deal_date = Column(Date, nullable=True)

    # Industry/strategy breakdown (optional, for quick filtering)
    top_industries = Column(JSONB, nullable=True)  # e.g., {"Technology": 5, "Healthcare": 3}

    run_id = Column(String(50), nullable=True)


# =============================================================================
# Search / Entity Document Table
# =============================================================================

class PreqinEntityDoc(Base, TimestampMixin):
    """
    Entity document table for hybrid search (pg_trgm + pgvector).

    Stores concatenated text and embeddings for semantic search.
    """
    __tablename__ = "preqin_entity_doc"
    __table_args__ = (
        UniqueConstraint('entity_type', 'entity_id', name='uq_entity_doc'),
        {"schema": "preqin"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    entity_type = Column(String(50), nullable=False, index=True)  # firm, fund, deal, company, person
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Searchable content
    title = Column(Text, nullable=False)
    doc_text = Column(Text, nullable=False)

    # Embedding (pgvector) - stored as array, converted to vector type via migration
    # Note: actual vector type created via raw SQL in migration
    embedding = Column(ARRAY(Float), nullable=True)

    # Metadata for filtering (named entity_metadata to avoid SQLAlchemy reserved word)
    entity_metadata = Column(JSONB, nullable=True)

    run_id = Column(String(50), nullable=True)


# =============================================================================
# Data Quality / Quarantine Tables
# =============================================================================

class PreqinQuarantine(Base, TimestampMixin):
    """
    Quarantine table for records with data quality issues.

    Stores records that failed processing due to:
    - Missing/unresolved foreign key references
    - Invalid data formats
    - Constraint violations

    This prevents data quality issues from breaking the ingestion pipeline.
    """
    __tablename__ = "preqin_quarantine"
    __table_args__ = {"schema": "preqin"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source identification
    source_table = Column(String(100), nullable=False, index=True)  # e.g., 'deal_investor_firm'
    source_record_id = Column(String(255), nullable=True, index=True)  # Original record ID if available

    # Error classification
    error_type = Column(String(100), nullable=False, index=True)  # e.g., 'missing_firm_id', 'invalid_date'
    error_details = Column(Text, nullable=True)  # Detailed error message

    # Raw data for debugging and reprocessing
    raw_data = Column(JSONB, nullable=False)

    # Processing metadata
    run_id = Column(String(50), nullable=True, index=True)
    reprocessed_at = Column(DateTime, nullable=True)
    resolved = Column(Boolean, default=False, index=True)
    resolution_notes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<PreqinQuarantine(id={self.id}, table={self.source_table}, error={self.error_type})>"


# Quarantine indexes
Index('idx_quarantine_source_error', PreqinQuarantine.source_table, PreqinQuarantine.error_type)
Index('idx_quarantine_unresolved', PreqinQuarantine.resolved, PreqinQuarantine.created_at)


# =============================================================================
# Bronze Layer Tables (Raw Staging)
# =============================================================================

class PreqinBronzeDeals(Base):
    """Bronze layer: Raw deals data"""
    __tablename__ = "deals_raw"
    __table_args__ = {"schema": "preqin_bronze"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_file = Column(String(255), nullable=False)
    source_sheet = Column(String(100), nullable=True)
    source_row = Column(Integer, nullable=True)
    loaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    run_id = Column(String(50), nullable=True)
    raw_data = Column(JSONB, nullable=False)


class PreqinBronzeGP(Base):
    """Bronze layer: Raw GP data"""
    __tablename__ = "gp_raw"
    __table_args__ = {"schema": "preqin_bronze"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_file = Column(String(255), nullable=False)
    source_sheet = Column(String(100), nullable=True)
    source_row = Column(Integer, nullable=True)
    loaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    run_id = Column(String(50), nullable=True)
    raw_data = Column(JSONB, nullable=False)


class PreqinBronzeLP(Base):
    """Bronze layer: Raw LP data"""
    __tablename__ = "lp_raw"
    __table_args__ = {"schema": "preqin_bronze"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_file = Column(String(255), nullable=False)
    source_sheet = Column(String(100), nullable=True)
    source_row = Column(Integer, nullable=True)
    loaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    run_id = Column(String(50), nullable=True)
    raw_data = Column(JSONB, nullable=False)


class PreqinBronzeFunds(Base):
    """Bronze layer: Raw funds data"""
    __tablename__ = "funds_raw"
    __table_args__ = {"schema": "preqin_bronze"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_file = Column(String(255), nullable=False)
    source_sheet = Column(String(100), nullable=True)
    source_row = Column(Integer, nullable=True)
    loaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    run_id = Column(String(50), nullable=True)
    raw_data = Column(JSONB, nullable=False)


# =============================================================================
# Create indexes for common query patterns
# =============================================================================

# Firm indexes
Index('idx_preqin_firm_name_trgm', PreqinFirm.name_normalized, postgresql_using='gin',
      postgresql_ops={'name_normalized': 'gin_trgm_ops'})
Index('idx_preqin_firm_country_type', PreqinFirm.headquarters_country, PreqinFirm.firm_type)

# Fund indexes
Index('idx_preqin_fund_name_trgm', PreqinFund.name_normalized, postgresql_using='gin',
      postgresql_ops={'name_normalized': 'gin_trgm_ops'})
Index('idx_preqin_fund_strategy_vintage', PreqinFund.strategy, PreqinFund.vintage_year)

# Deal indexes
Index('idx_preqin_deal_date_type', PreqinDeal.deal_date, PreqinDeal.deal_type)
Index('idx_preqin_deal_industry_country', PreqinDeal.primary_industry, PreqinDeal.country)

# Company indexes
Index('idx_preqin_company_name_trgm', PreqinCompany.name_normalized, postgresql_using='gin',
      postgresql_ops={'name_normalized': 'gin_trgm_ops'})

# Person indexes
Index('idx_preqin_person_name_trgm', PreqinPerson.name_normalized, postgresql_using='gin',
      postgresql_ops={'name_normalized': 'gin_trgm_ops'})

# Co-investment edge indexes
Index('idx_preqin_coinvest_a', PreqinCoInvestmentEdge.firm_a_id)
Index('idx_preqin_coinvest_b', PreqinCoInvestmentEdge.firm_b_id)

# Entity doc indexes
Index('idx_preqin_entity_doc_type', PreqinEntityDoc.entity_type)

# Deal investor firm - partial unique index (only when investor_firm_id is not null)
Index('uq_deal_investor_firm_resolved',
      PreqinDealInvestorFirm.deal_id,
      PreqinDealInvestorFirm.investor_firm_id,
      unique=True,
      postgresql_where=PreqinDealInvestorFirm.investor_firm_id.isnot(None))
