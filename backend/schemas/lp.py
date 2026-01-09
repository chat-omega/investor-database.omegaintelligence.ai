"""
Pydantic schemas for LP (Limited Partner) API endpoints
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class LPBase(BaseModel):
    """Base LP schema with common fields"""
    name: str = Field(..., description="LP name")

    # Organization details
    type: Optional[str] = Field(None, description="LP type (Individual, Family Office, Institution, Corporate, Foundation, Government, Other)")
    description: Optional[str] = Field(None, description="LP description")
    website: Optional[str] = Field(None, description="LP website URL")

    # Contact information
    primary_contact_name: Optional[str] = Field(None, description="Primary contact person name")
    primary_contact_email: Optional[str] = Field(None, description="Primary contact email")
    primary_contact_phone: Optional[str] = Field(None, description="Primary contact phone")
    location: Optional[str] = Field(None, description="LP location (City, Country)")

    # Investment details
    total_committed_capital_raw: Optional[str] = Field(None, description="Total committed capital as display string (e.g., '$50M')")
    total_committed_capital: Optional[float] = Field(None, description="Total committed capital as float (e.g., 50000000.0)")
    investment_focus: Optional[str] = Field(None, description="Investment focus areas (e.g., 'Technology, Healthcare')")
    first_investment_year: Optional[int] = Field(None, description="Year of first investment")

    # Relationship tracking
    relationship_status: Optional[str] = Field(None, description="Relationship status (Active, Prospective, Inactive, Former)")
    tier: Optional[str] = Field(None, description="Investment tier (Tier 1, Tier 2, Tier 3)")


class LPCreate(LPBase):
    """Schema for creating a new LP"""
    pass


class LPUpdate(BaseModel):
    """Schema for updating an LP (all fields optional)"""
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    location: Optional[str] = None
    total_committed_capital_raw: Optional[str] = None
    total_committed_capital: Optional[float] = None
    investment_focus: Optional[str] = None
    first_investment_year: Optional[int] = None
    relationship_status: Optional[str] = None
    tier: Optional[str] = None


class LPResponse(LPBase):
    """Schema for LP responses (includes ID and timestamps)"""
    id: str = Field(..., description="Unique LP ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True  # Enable ORM mode for SQLAlchemy models


class LPListResponse(BaseModel):
    """Schema for paginated list of LPs"""
    lps: List[LPResponse] = Field(..., description="List of LPs")
    total: int = Field(..., description="Total number of LPs matching query")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")

    class Config:
        from_attributes = True


class LPSearchFilters(BaseModel):
    """Schema for LP search and filter parameters"""
    search: Optional[str] = Field(None, description="Search query for LP name")
    type: Optional[str] = Field(None, description="Filter by LP type")
    location: Optional[str] = Field(None, description="Filter by location")
    relationship_status: Optional[str] = Field(None, description="Filter by relationship status")
    tier: Optional[str] = Field(None, description="Filter by tier")
    min_commitment: Optional[float] = Field(None, description="Minimum commitment filter")
    max_commitment: Optional[float] = Field(None, description="Maximum commitment filter")
    min_investment_year: Optional[int] = Field(None, description="Minimum first investment year")
    max_investment_year: Optional[int] = Field(None, description="Maximum first investment year")

    # Pagination
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(20, ge=1, le=100, description="Items per page (max 100)")

    # Sorting
    sort_by: Optional[str] = Field("name", description="Field to sort by (name, total_committed_capital, first_investment_year, created_at)")
    sort_order: Optional[str] = Field("asc", description="Sort order: 'asc' or 'desc'")


class LPFundCommitmentBase(BaseModel):
    """Base LP-Fund commitment schema"""
    lp_id: str = Field(..., description="LP ID")
    fund_id: str = Field(..., description="Fund ID")
    commitment_amount_raw: Optional[str] = Field(None, description="Commitment amount as display string (e.g., '$10M')")
    commitment_amount: Optional[float] = Field(None, description="Commitment amount as float (e.g., 10000000.0)")
    commitment_date: Optional[datetime] = Field(None, description="Date of commitment")
    capital_called_raw: Optional[str] = Field(None, description="Capital called as display string (e.g., '$7M')")
    capital_called: Optional[float] = Field(None, description="Capital called as float (e.g., 7000000.0)")
    notes: Optional[str] = Field(None, description="Additional notes")


class LPFundCommitmentCreate(LPFundCommitmentBase):
    """Schema for creating a new LP-Fund commitment"""
    pass


class LPFundCommitmentUpdate(BaseModel):
    """Schema for updating an LP-Fund commitment (all fields optional)"""
    commitment_amount_raw: Optional[str] = None
    commitment_amount: Optional[float] = None
    commitment_date: Optional[datetime] = None
    capital_called_raw: Optional[str] = None
    capital_called: Optional[float] = None
    notes: Optional[str] = None


class LPFundCommitmentResponse(LPFundCommitmentBase):
    """Schema for LP-Fund commitment responses (includes ID and timestamps)"""
    id: str = Field(..., description="Unique commitment ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class LPTypesResponse(BaseModel):
    """Schema for LP types metadata"""
    types: List[str] = Field(..., description="List of available LP types")


class LPStatistics(BaseModel):
    """Schema for LP statistics"""
    total_lps: int = Field(..., description="Total number of LPs")
    total_committed_capital: float = Field(..., description="Total committed capital across all LPs")
    avg_commitment: float = Field(..., description="Average commitment per LP")
    type_breakdown: List[dict] = Field(..., description="Breakdown by LP type")
    tier_breakdown: List[dict] = Field(..., description="Breakdown by tier")
    status_breakdown: List[dict] = Field(..., description="Breakdown by relationship status")
