"""
Pydantic schemas for Fund API endpoints
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FundBase(BaseModel):
    """Base fund schema with common fields"""
    name: str = Field(..., description="Fund name")
    description: Optional[str] = Field(None, description="Fund description")

    # Fund details
    founded_year: Optional[int] = Field(None, description="Year the fund was founded")
    aum_raw: Optional[str] = Field(None, description="AUM as display string (e.g., '$500M')")
    aum: Optional[float] = Field(None, description="AUM as float (e.g., 500000000.0)")
    strategy: Optional[str] = Field(None, description="Investment strategy (e.g., 'Growth Equity', 'Venture Capital')")

    # Contact & location
    website: Optional[str] = Field(None, description="Fund website URL")
    headquarters: Optional[str] = Field(None, description="Fund headquarters location")


class FundCreate(FundBase):
    """Schema for creating a new fund"""
    pass


class FundUpdate(BaseModel):
    """Schema for updating a fund (all fields optional)"""
    name: Optional[str] = None
    description: Optional[str] = None
    founded_year: Optional[int] = None
    aum_raw: Optional[str] = None
    aum: Optional[float] = None
    strategy: Optional[str] = None
    website: Optional[str] = None
    headquarters: Optional[str] = None


class FundResponse(FundBase):
    """Schema for fund responses (includes ID and timestamps)"""
    id: str = Field(..., description="Unique fund ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True  # Enable ORM mode for SQLAlchemy models


class FundListResponse(BaseModel):
    """Schema for paginated list of funds"""
    funds: List[FundResponse] = Field(..., description="List of funds")
    total: int = Field(..., description="Total number of funds matching query")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")

    class Config:
        from_attributes = True


class FundSearchFilters(BaseModel):
    """Schema for fund search and filter parameters"""
    search: Optional[str] = Field(None, description="Search query for fund name")
    strategy: Optional[str] = Field(None, description="Filter by investment strategy")
    min_aum: Optional[float] = Field(None, description="Minimum AUM filter")
    max_aum: Optional[float] = Field(None, description="Maximum AUM filter")
    min_founded_year: Optional[int] = Field(None, description="Minimum founding year")
    max_founded_year: Optional[int] = Field(None, description="Maximum founding year")
    headquarters: Optional[str] = Field(None, description="Filter by headquarters location")

    # Pagination
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(20, ge=1, le=100, description="Items per page (max 100)")

    # Sorting
    sort_by: Optional[str] = Field("name", description="Field to sort by")
    sort_order: Optional[str] = Field("asc", description="Sort order: 'asc' or 'desc'")
