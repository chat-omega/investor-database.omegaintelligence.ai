"""Pydantic schemas for secondary funds endpoints."""
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from enum import Enum


class FundStatusEnum(str, Enum):
    CLOSED = "CLOSED"
    CLOSED_ENDED_IN_MARKET = "CLOSED_ENDED_IN_MARKET"
    OPEN_ENDED_IN_MARKET = "OPEN_ENDED_IN_MARKET"


class StrategyEnum(str, Enum):
    LP_STAKES = "LP_STAKES"
    GP_LED = "GP_LED"
    DIRECT_SECONDARIES = "DIRECT_SECONDARIES"
    PREFERRED_EQUITY = "PREFERRED_EQUITY"


class SectorEnum(str, Enum):
    PRIVATE_EQUITY = "PRIVATE_EQUITY"
    VENTURE_CAPITAL = "VENTURE_CAPITAL"
    REAL_ESTATE = "REAL_ESTATE"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    PRIVATE_DEBT = "PRIVATE_DEBT"
    AGRICULTURE = "AGRICULTURE"


# GP Schemas
class SecondaryGPResponse(BaseModel):
    id: int
    institution_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    institution_type: Optional[str] = None
    aum_usd: Optional[float] = None
    aum_raw: Optional[str] = None
    fund_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SecondaryGPListResponse(BaseModel):
    items: List[SecondaryGPResponse]
    total: int
    page: int
    page_size: int
    pages: int


# LP Schemas
class SecondaryLPResponse(BaseModel):
    id: int
    institution_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    institution_type: Optional[str] = None
    aum_usd: Optional[float] = None
    aum_raw: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SecondaryLPListResponse(BaseModel):
    items: List[SecondaryLPResponse]
    total: int
    page: int
    page_size: int
    pages: int


# Fund Schemas
class SecondaryFundResponse(BaseModel):
    id: int
    fund_name: str
    gp_id: Optional[int] = None
    fund_manager_name: Optional[str] = None
    status: Optional[str] = None
    vintage_year: Optional[int] = None
    fund_close_year: Optional[int] = None
    launch_year: Optional[int] = None
    fund_size_raw: Optional[str] = None
    fund_size_usd: Optional[float] = None
    target_size_raw: Optional[str] = None
    target_size_usd: Optional[float] = None
    dpi: Optional[float] = None
    tvpi: Optional[float] = None
    irr: Optional[float] = None
    strategies: List[str] = []
    sectors: List[str] = []
    data_source: Optional[str] = None
    last_reporting_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SecondaryFundListResponse(BaseModel):
    items: List[SecondaryFundResponse]
    total: int
    page: int
    page_size: int
    pages: int


# Statistics Schemas
class SecondaryStatsResponse(BaseModel):
    total_funds: int
    total_gps: int
    total_lps: int
    total_aum_gps: Optional[float] = None
    total_aum_lps: Optional[float] = None
    funds_by_status: dict
    funds_by_strategy: dict
    funds_by_sector: dict
    avg_fund_size: Optional[float] = None
    avg_irr: Optional[float] = None
    avg_tvpi: Optional[float] = None


# NLQ Schemas
class NLQRequest(BaseModel):
    question: str


class NLQResponse(BaseModel):
    question: str
    sql: str
    results: List[dict]
    execution_time: float
    error: Optional[str] = None
