"""
Pydantic schemas for Portfolio Company API
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PortfolioCompanyBase(BaseModel):
    """Base schema for portfolio company data"""
    name: str = Field(..., description="Company name")
    sector: Optional[str] = Field(None, description="Industry sector")
    stage: Optional[str] = Field(None, description="Investment stage (Series A, Series B, Growth, etc.)")
    location: Optional[str] = Field(None, description="Company headquarters location")
    description: Optional[str] = Field(None, description="Company description")
    website: Optional[str] = Field(None, description="Company website URL")
    logo_url: Optional[str] = Field(None, description="Company logo URL")
    investment_date: Optional[datetime] = Field(None, description="Date of investment")
    valuation_raw: Optional[str] = Field(None, description="Valuation as string (e.g., '$2.5B')")
    valuation: Optional[float] = Field(None, description="Valuation as numeric value")
    status: Optional[str] = Field("Active", description="Investment status: Active, Exited, IPO")


class PortfolioCompanyCreate(PortfolioCompanyBase):
    """Schema for creating a portfolio company"""
    fund_id: str = Field(..., description="Fund ID that made the investment")
    fund_name: Optional[str] = Field(None, description="Fund name (denormalized)")


class PortfolioCompanyUpdate(BaseModel):
    """Schema for updating a portfolio company"""
    name: Optional[str] = None
    sector: Optional[str] = None
    stage: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    investment_date: Optional[datetime] = None
    valuation_raw: Optional[str] = None
    valuation: Optional[float] = None
    status: Optional[str] = None


class PortfolioCompanyResponse(PortfolioCompanyBase):
    """Schema for portfolio company response"""
    id: str
    fund_id: str
    fund_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PortfolioCompanyListResponse(BaseModel):
    """Schema for paginated portfolio company list response"""
    companies: List[PortfolioCompanyResponse]
    total: int
    page: int = 1
    page_size: int = 50
    total_pages: int = 1
