"""
Pydantic schemas for the Preqin Data Layer API

Includes request/response models for all entities and search functionality.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
from uuid import UUID


# =============================================================================
# Enums
# =============================================================================

class FirmType(str, Enum):
    GP = "GP"
    LP = "LP"
    BOTH = "BOTH"


class EntityType(str, Enum):
    FIRM = "firm"
    FUND = "fund"
    DEAL = "deal"
    COMPANY = "company"
    PERSON = "person"


# =============================================================================
# Base Schemas with Common Fields
# =============================================================================

class ProvenanceBase(BaseModel):
    """Base schema with provenance fields"""
    source_file: Optional[str] = None
    source_sheet: Optional[str] = None
    source_row_number: Optional[int] = None
    run_id: Optional[str] = None


class SourceIdBase(BaseModel):
    """Base schema with source ID tracking"""
    source_system: str = "preqin"
    source_id: Optional[str] = None


# =============================================================================
# Firm Schemas
# =============================================================================

class FirmBase(BaseModel):
    """Base firm schema"""
    name: str
    firm_type: Optional[str] = None
    institution_type: Optional[str] = None
    headquarters_city: Optional[str] = None
    headquarters_country: Optional[str] = None
    headquarters_region: Optional[str] = None
    aum_usd: Optional[float] = None
    aum_raw: Optional[str] = None
    dry_powder_usd: Optional[float] = None
    website: Optional[str] = None
    description: Optional[str] = None
    year_founded: Optional[int] = None
    is_listed: Optional[bool] = None
    ticker: Optional[str] = None


class FirmCreate(FirmBase, SourceIdBase, ProvenanceBase):
    """Schema for creating a firm"""
    pass


class FirmResponse(FirmBase, SourceIdBase):
    """Schema for firm response"""
    id: UUID
    preqin_id: Optional[str] = None
    name_normalized: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    fund_count: Optional[int] = None
    contact_count: Optional[int] = None
    deal_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class FirmListResponse(BaseModel):
    """Paginated list of firms"""
    items: List[FirmResponse]
    total: int
    page: int
    page_size: int
    pages: int


class FirmDetail(FirmResponse):
    """Detailed firm response with relationships"""
    managed_funds: Optional[List["FundSummary"]] = None
    top_contacts: Optional[List["PersonSummary"]] = None
    recent_deals: Optional[List["DealSummary"]] = None
    co_investors: Optional[List["CoInvestorSummary"]] = None


# =============================================================================
# Fund Schemas
# =============================================================================

class FundBase(BaseModel):
    """Base fund schema"""
    name: str
    vintage_year: Optional[int] = None
    fund_size_usd: Optional[float] = None
    fund_size_raw: Optional[str] = None
    target_size_usd: Optional[float] = None
    currency: Optional[str] = None
    strategy: Optional[str] = None
    sub_strategy: Optional[str] = None
    status: Optional[str] = None
    domicile_country: Optional[str] = None
    geography_focus: Optional[str] = None
    sector_focus: Optional[str] = None
    irr: Optional[float] = None
    tvpi: Optional[float] = None
    dpi: Optional[float] = None


class FundCreate(FundBase, SourceIdBase, ProvenanceBase):
    """Schema for creating a fund"""
    managing_firm_id: Optional[UUID] = None


class FundResponse(FundBase, SourceIdBase):
    """Schema for fund response"""
    id: UUID
    preqin_id: Optional[str] = None
    name_normalized: Optional[str] = None
    managing_firm_id: Optional[UUID] = None
    managing_firm_name: Optional[str] = None
    first_close_date: Optional[date] = None
    final_close_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FundSummary(BaseModel):
    """Summary fund info for embedding in other responses"""
    id: UUID
    name: str
    vintage_year: Optional[int] = None
    strategy: Optional[str] = None
    fund_size_usd: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class FundListResponse(BaseModel):
    """Paginated list of funds"""
    items: List[FundResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# Person Schemas
# =============================================================================

class PersonBase(BaseModel):
    """Base person schema"""
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    title: Optional[str] = None
    seniority_level: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None


class PersonCreate(PersonBase, SourceIdBase, ProvenanceBase):
    """Schema for creating a person"""
    pass


class PersonResponse(PersonBase, SourceIdBase):
    """Schema for person response"""
    id: UUID
    preqin_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Employment info
    current_firm_id: Optional[UUID] = None
    current_firm_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PersonSummary(BaseModel):
    """Summary person info"""
    id: UUID
    full_name: str
    title: Optional[str] = None
    email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PersonListResponse(BaseModel):
    """Paginated list of persons"""
    items: List[PersonResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# Company Schemas
# =============================================================================

class CompanyBase(BaseModel):
    """Base company schema"""
    name: str
    website: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    primary_industry: Optional[str] = None
    secondary_industry: Optional[str] = None
    status: Optional[str] = None


class CompanyCreate(CompanyBase, SourceIdBase, ProvenanceBase):
    """Schema for creating a company"""
    pass


class CompanyResponse(CompanyBase, SourceIdBase):
    """Schema for company response"""
    id: UUID
    preqin_id: Optional[str] = None
    name_normalized: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Computed
    deal_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CompanyListResponse(BaseModel):
    """Paginated list of companies"""
    items: List[CompanyResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# Deal Schemas
# =============================================================================

class DealBase(BaseModel):
    """Base deal schema"""
    deal_type: Optional[str] = None
    deal_date: Optional[date] = None
    deal_value_usd: Optional[float] = None
    deal_value_raw: Optional[str] = None
    stage: Optional[str] = None
    deal_status: Optional[str] = None
    primary_industry: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None


class DealCreate(DealBase, SourceIdBase, ProvenanceBase):
    """Schema for creating a deal"""
    target_company_id: Optional[UUID] = None


class DealResponse(DealBase, SourceIdBase):
    """Schema for deal response"""
    id: UUID
    preqin_id: Optional[str] = None
    target_company_id: Optional[UUID] = None
    target_company_name: Optional[str] = None
    announced_date: Optional[date] = None
    closed_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    # Investors
    investor_firms: Optional[List[str]] = None
    investor_funds: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class DealSummary(BaseModel):
    """Summary deal info"""
    id: UUID
    deal_type: Optional[str] = None
    deal_date: Optional[date] = None
    deal_value_usd: Optional[float] = None
    target_company_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DealListResponse(BaseModel):
    """Paginated list of deals"""
    items: List[DealResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# Co-Investment Schemas
# =============================================================================

class CoInvestorSummary(BaseModel):
    """Summary of a co-investor relationship"""
    firm_id: UUID
    firm_name: str
    firm_type: Optional[str] = None
    deal_count: int
    total_value_usd: Optional[float] = None
    first_deal_date: Optional[date] = None
    last_deal_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class CoInvestmentNetworkResponse(BaseModel):
    """Response for co-investment network query"""
    firm_id: UUID
    firm_name: str
    co_investors: List[CoInvestorSummary]
    total_co_investors: int


class CoInvestmentDrilldown(BaseModel):
    """Drilldown into specific co-investments between two firms"""
    firm_a_id: UUID
    firm_a_name: str
    firm_b_id: UUID
    firm_b_name: str
    deals: List[DealSummary]
    total_deals: int
    total_value_usd: Optional[float] = None


# =============================================================================
# Search Schemas
# =============================================================================

class SearchFilters(BaseModel):
    """Filters for search queries"""
    min_aum: Optional[float] = None
    max_aum: Optional[float] = None
    country: Optional[str] = None
    countries: Optional[List[str]] = None
    firm_type: Optional[str] = None
    strategy: Optional[str] = None
    vintage_year_min: Optional[int] = None
    vintage_year_max: Optional[int] = None
    industry: Optional[str] = None
    deal_type: Optional[str] = None


class SearchRequest(BaseModel):
    """Request for hybrid search"""
    query: str = Field(..., min_length=1, description="Search query text")
    entity_types: Optional[List[EntityType]] = None
    filters: Optional[SearchFilters] = None
    limit: int = Field(default=20, ge=1, le=100)
    use_semantic: bool = Field(default=True, description="Use semantic search if embeddings available")


class SearchResult(BaseModel):
    """Individual search result"""
    entity_type: EntityType
    entity_id: UUID
    score: float
    title: str
    snippet: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    """Response for search query"""
    query: str
    results: List[SearchResult]
    total: int
    search_type: str = "hybrid"  # hybrid, fts_only, semantic_only


# =============================================================================
# Statistics Schemas
# =============================================================================

class PreqinStats(BaseModel):
    """Aggregate statistics for Preqin database"""
    total_firms: int
    total_gps: int
    total_lps: int
    total_funds: int
    total_deals: int
    total_persons: int
    total_companies: int
    total_aum_usd: Optional[float] = None

    # Distributions
    deals_by_year: Optional[Dict[int, int]] = None
    funds_by_strategy: Optional[Dict[str, int]] = None
    firms_by_country: Optional[Dict[str, int]] = None


class DataQualityStats(BaseModel):
    """Data quality statistics"""
    entity_type: str
    total_records: int
    resolved_count: int
    unresolved_count: int
    resolution_rate: float
    top_unresolved: Optional[List[str]] = None


# =============================================================================
# Forward References
# =============================================================================

# Update forward references for nested models
FirmDetail.model_rebuild()
