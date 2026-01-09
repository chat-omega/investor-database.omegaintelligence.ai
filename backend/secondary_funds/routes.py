"""API routes for secondary funds database."""
import os
import time
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List

from .database import get_secondary_db
from .models import SecondaryFund, SecondaryGP, SecondaryLP, FundStrategy, FundSector, FundStatus, Strategy, Sector
from .schemas import (
    SecondaryFundResponse, SecondaryFundListResponse,
    SecondaryGPResponse, SecondaryGPListResponse,
    SecondaryLPResponse, SecondaryLPListResponse,
    SecondaryStatsResponse, NLQRequest, NLQResponse,
    FundStatusEnum, StrategyEnum, SectorEnum
)

router = APIRouter(prefix="/api/secondary-funds", tags=["Secondary Funds"])


def fund_to_response(fund) -> dict:
    """Convert Fund model to response dict."""
    strategies = [fs.strategy.code for fs in fund.strategies] if fund.strategies else []
    sectors = [fs.sector.code for fs in fund.sectors] if fund.sectors else []

    return {
        "id": fund.id,
        "fund_name": fund.fund_name,
        "gp_id": fund.gp_id,
        "fund_manager_name": fund.gp.institution_name if fund.gp else None,
        "status": fund.status.name if fund.status else None,
        "vintage_year": fund.vintage_year,
        "fund_close_year": fund.fund_close_year,
        "launch_year": fund.launch_year,
        "fund_size_raw": fund.fund_size_raw,
        "fund_size_usd": float(fund.fund_size_usd) if fund.fund_size_usd else None,
        "target_size_raw": fund.target_size_raw,
        "target_size_usd": float(fund.target_size_usd) if fund.target_size_usd else None,
        "dpi": float(fund.dpi) if fund.dpi else None,
        "tvpi": float(fund.tvpi) if fund.tvpi else None,
        "irr": float(fund.irr) if fund.irr else None,
        "strategies": strategies,
        "sectors": sectors,
        "data_source": fund.data_source,
        "last_reporting_date": fund.last_reporting_date,
        "created_at": fund.created_at,
        "updated_at": fund.updated_at,
    }


def gp_to_response(gp, fund_count: int = None) -> dict:
    """Convert GP model to response dict."""
    return {
        "id": gp.id,
        "institution_name": gp.institution_name,
        "city": gp.city,
        "country": gp.country,
        "institution_type": gp.institution_type.name if gp.institution_type else None,
        "aum_usd": float(gp.aum_usd) if gp.aum_usd else None,
        "aum_raw": gp.aum_raw,
        "fund_count": fund_count,
        "created_at": gp.created_at,
        "updated_at": gp.updated_at,
    }


def lp_to_response(lp) -> dict:
    """Convert LP model to response dict."""
    return {
        "id": lp.id,
        "institution_name": lp.institution_name,
        "city": lp.city,
        "country": lp.country,
        "institution_type": lp.institution_type.name if lp.institution_type else None,
        "aum_usd": float(lp.aum_usd) if lp.aum_usd else None,
        "aum_raw": lp.aum_raw,
        "created_at": lp.created_at,
        "updated_at": lp.updated_at,
    }


# ============================================================================
# Fund Endpoints
# ============================================================================

@router.get("/funds", response_model=SecondaryFundListResponse)
def list_secondary_funds(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    fund_manager_name: Optional[str] = None,
    status: Optional[FundStatusEnum] = None,
    strategy: Optional[StrategyEnum] = None,
    sector: Optional[SectorEnum] = None,
    vintage_year_min: Optional[int] = None,
    vintage_year_max: Optional[int] = None,
    fund_size_min: Optional[float] = None,
    fund_size_max: Optional[float] = None,
    irr_min: Optional[float] = None,
    irr_max: Optional[float] = None,
    sort_by: Optional[str] = Query("fund_name", description="Sort by: fund_name, vintage_year, fund_size_usd, irr, tvpi, dpi"),
    sort_direction: Optional[str] = Query("asc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_secondary_db)
):
    """List secondary funds with filters."""
    query = db.query(SecondaryFund)

    # Apply filters
    if search:
        query = query.filter(SecondaryFund.fund_name.ilike(f"%{search}%"))

    if fund_manager_name:
        query = query.join(SecondaryGP).filter(SecondaryGP.institution_name.ilike(f"%{fund_manager_name}%"))

    if status:
        query = query.join(FundStatus).filter(FundStatus.code == status.value)

    if strategy:
        query = query.join(FundStrategy).join(Strategy).filter(Strategy.code == strategy.value)

    if sector:
        query = query.join(FundSector).join(Sector).filter(Sector.code == sector.value)

    if vintage_year_min:
        query = query.filter(SecondaryFund.vintage_year >= vintage_year_min)
    if vintage_year_max:
        query = query.filter(SecondaryFund.vintage_year <= vintage_year_max)

    if fund_size_min:
        query = query.filter(SecondaryFund.fund_size_usd >= fund_size_min)
    if fund_size_max:
        query = query.filter(SecondaryFund.fund_size_usd <= fund_size_max)

    if irr_min:
        query = query.filter(SecondaryFund.irr >= irr_min)
    if irr_max:
        query = query.filter(SecondaryFund.irr <= irr_max)

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = getattr(SecondaryFund, sort_by, SecondaryFund.fund_name)
    if sort_direction == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * page_size
    funds = query.offset(offset).limit(page_size).all()

    pages = (total + page_size - 1) // page_size

    return SecondaryFundListResponse(
        items=[SecondaryFundResponse(**fund_to_response(f)) for f in funds],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/funds/{fund_id}", response_model=SecondaryFundResponse)
def get_secondary_fund(fund_id: int, db: Session = Depends(get_secondary_db)):
    """Get a specific secondary fund by ID."""
    fund = db.query(SecondaryFund).filter(SecondaryFund.id == fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    return SecondaryFundResponse(**fund_to_response(fund))


# ============================================================================
# GP Endpoints
# ============================================================================

@router.get("/gps", response_model=SecondaryGPListResponse)
def list_secondary_gps(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    country: Optional[str] = None,
    aum_min: Optional[float] = None,
    aum_max: Optional[float] = None,
    sort_by: Optional[str] = Query("institution_name", description="Sort by: institution_name, aum_usd, country"),
    sort_direction: Optional[str] = Query("asc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_secondary_db)
):
    """List secondary fund GPs with filters."""
    query = db.query(SecondaryGP)

    if search:
        query = query.filter(SecondaryGP.institution_name.ilike(f"%{search}%"))

    if country:
        query = query.filter(SecondaryGP.country.ilike(f"%{country}%"))

    if aum_min:
        query = query.filter(SecondaryGP.aum_usd >= aum_min)
    if aum_max:
        query = query.filter(SecondaryGP.aum_usd <= aum_max)

    total = query.count()

    sort_column = getattr(SecondaryGP, sort_by, SecondaryGP.institution_name)
    if sort_direction == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    offset = (page - 1) * page_size
    gps = query.offset(offset).limit(page_size).all()

    # Get fund counts for each GP
    gp_ids = [gp.id for gp in gps]
    fund_counts = dict(
        db.query(SecondaryFund.gp_id, func.count(SecondaryFund.id))
        .filter(SecondaryFund.gp_id.in_(gp_ids))
        .group_by(SecondaryFund.gp_id)
        .all()
    )

    pages = (total + page_size - 1) // page_size

    return SecondaryGPListResponse(
        items=[SecondaryGPResponse(**gp_to_response(gp, fund_counts.get(gp.id, 0))) for gp in gps],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/gps/{gp_id}", response_model=SecondaryGPResponse)
def get_secondary_gp(gp_id: int, db: Session = Depends(get_secondary_db)):
    """Get a specific GP by ID."""
    gp = db.query(SecondaryGP).filter(SecondaryGP.id == gp_id).first()
    if not gp:
        raise HTTPException(status_code=404, detail="GP not found")
    fund_count = db.query(func.count(SecondaryFund.id)).filter(SecondaryFund.gp_id == gp_id).scalar()
    return SecondaryGPResponse(**gp_to_response(gp, fund_count))


@router.get("/gps/{gp_id}/funds", response_model=SecondaryFundListResponse)
def get_gp_funds(
    gp_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_secondary_db)
):
    """Get funds managed by a specific GP."""
    gp = db.query(SecondaryGP).filter(SecondaryGP.id == gp_id).first()
    if not gp:
        raise HTTPException(status_code=404, detail="GP not found")

    query = db.query(SecondaryFund).filter(SecondaryFund.gp_id == gp_id)
    total = query.count()

    offset = (page - 1) * page_size
    funds = query.offset(offset).limit(page_size).all()
    pages = (total + page_size - 1) // page_size

    return SecondaryFundListResponse(
        items=[SecondaryFundResponse(**fund_to_response(f)) for f in funds],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


# ============================================================================
# LP Endpoints
# ============================================================================

@router.get("/lps", response_model=SecondaryLPListResponse)
def list_secondary_lps(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    country: Optional[str] = None,
    aum_min: Optional[float] = None,
    aum_max: Optional[float] = None,
    sort_by: Optional[str] = Query("institution_name", description="Sort by: institution_name, aum_usd, country"),
    sort_direction: Optional[str] = Query("asc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_secondary_db)
):
    """List secondary fund LPs with filters."""
    query = db.query(SecondaryLP)

    if search:
        query = query.filter(SecondaryLP.institution_name.ilike(f"%{search}%"))

    if country:
        query = query.filter(SecondaryLP.country.ilike(f"%{country}%"))

    if aum_min:
        query = query.filter(SecondaryLP.aum_usd >= aum_min)
    if aum_max:
        query = query.filter(SecondaryLP.aum_usd <= aum_max)

    total = query.count()

    sort_column = getattr(SecondaryLP, sort_by, SecondaryLP.institution_name)
    if sort_direction == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    offset = (page - 1) * page_size
    lps = query.offset(offset).limit(page_size).all()

    pages = (total + page_size - 1) // page_size

    return SecondaryLPListResponse(
        items=[SecondaryLPResponse(**lp_to_response(lp)) for lp in lps],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/lps/{lp_id}", response_model=SecondaryLPResponse)
def get_secondary_lp(lp_id: int, db: Session = Depends(get_secondary_db)):
    """Get a specific LP by ID."""
    lp = db.query(SecondaryLP).filter(SecondaryLP.id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")
    return SecondaryLPResponse(**lp_to_response(lp))


# ============================================================================
# Statistics Endpoint
# ============================================================================

@router.get("/stats", response_model=SecondaryStatsResponse)
def get_secondary_stats(db: Session = Depends(get_secondary_db)):
    """Get aggregate statistics for secondary funds database."""
    total_funds = db.query(func.count(SecondaryFund.id)).scalar()
    total_gps = db.query(func.count(SecondaryGP.id)).scalar()
    total_lps = db.query(func.count(SecondaryLP.id)).scalar()

    total_aum_gps = db.query(func.sum(SecondaryGP.aum_usd)).scalar()
    total_aum_lps = db.query(func.sum(SecondaryLP.aum_usd)).scalar()

    # Funds by status
    status_counts = db.query(FundStatus.name, func.count(SecondaryFund.id))\
        .join(SecondaryFund)\
        .group_by(FundStatus.name)\
        .all()
    funds_by_status = {s[0]: s[1] for s in status_counts}

    # Funds by strategy
    strategy_counts = db.query(Strategy.code, func.count(FundStrategy.fund_id))\
        .join(FundStrategy)\
        .group_by(Strategy.code)\
        .all()
    funds_by_strategy = {s[0]: s[1] for s in strategy_counts}

    # Funds by sector
    sector_counts = db.query(Sector.code, func.count(FundSector.fund_id))\
        .join(FundSector)\
        .group_by(Sector.code)\
        .all()
    funds_by_sector = {s[0]: s[1] for s in sector_counts}

    # Performance averages
    avg_fund_size = db.query(func.avg(SecondaryFund.fund_size_usd))\
        .filter(SecondaryFund.fund_size_usd.isnot(None)).scalar()
    avg_irr = db.query(func.avg(SecondaryFund.irr))\
        .filter(SecondaryFund.irr.isnot(None)).scalar()
    avg_tvpi = db.query(func.avg(SecondaryFund.tvpi))\
        .filter(SecondaryFund.tvpi.isnot(None)).scalar()

    return SecondaryStatsResponse(
        total_funds=total_funds,
        total_gps=total_gps,
        total_lps=total_lps,
        total_aum_gps=float(total_aum_gps) if total_aum_gps else None,
        total_aum_lps=float(total_aum_lps) if total_aum_lps else None,
        funds_by_status=funds_by_status,
        funds_by_strategy=funds_by_strategy,
        funds_by_sector=funds_by_sector,
        avg_fund_size=float(avg_fund_size) if avg_fund_size else None,
        avg_irr=float(avg_irr) if avg_irr else None,
        avg_tvpi=float(avg_tvpi) if avg_tvpi else None,
    )


# ============================================================================
# Meta Endpoints
# ============================================================================

@router.get("/meta/statuses")
def get_fund_statuses(db: Session = Depends(get_secondary_db)):
    """Get all fund statuses."""
    statuses = db.query(FundStatus).all()
    return {"statuses": [{"code": s.code, "name": s.name} for s in statuses]}


@router.get("/meta/strategies")
def get_strategies(db: Session = Depends(get_secondary_db)):
    """Get all investment strategies."""
    strategies = db.query(Strategy).all()
    return {"strategies": [{"code": s.code, "name": s.name} for s in strategies]}


@router.get("/meta/sectors")
def get_sectors(db: Session = Depends(get_secondary_db)):
    """Get all investment sectors."""
    sectors = db.query(Sector).all()
    return {"sectors": [{"code": s.code, "name": s.name} for s in sectors]}


# ============================================================================
# NLQ Endpoint
# ============================================================================

@router.post("/nlq", response_model=NLQResponse)
def natural_language_query(request: NLQRequest, db: Session = Depends(get_secondary_db)):
    """Execute a natural language query against the secondary funds database."""
    try:
        import openai

        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")

        # Get database schema for context
        schema_info = """
        Tables:
        - fund: id, fund_name, gp_id, status_id, vintage_year, fund_close_year, fund_size_usd, dpi, tvpi, irr
        - gp: id, institution_name, city, country, aum_usd
        - lp: id, institution_name, city, country, aum_usd
        - fund_status: id, code (CLOSED, CLOSED_ENDED_IN_MARKET, OPEN_ENDED_IN_MARKET), name
        - strategy: id, code (LP_STAKES, GP_LED, DIRECT_SECONDARIES, PREFERRED_EQUITY), name
        - sector: id, code (PRIVATE_EQUITY, VENTURE_CAPITAL, REAL_ESTATE, INFRASTRUCTURE, PRIVATE_DEBT, AGRICULTURE), name
        - fund_strategy: fund_id, strategy_id
        - fund_sector: fund_id, sector_id

        Performance metrics:
        - IRR: Internal Rate of Return (percentage)
        - TVPI: Total Value to Paid-In (multiple)
        - DPI: Distributed to Paid-In (multiple)
        - AUM: Assets Under Management (in USD millions)
        """

        client = openai.OpenAI(api_key=openai_api_key)

        start_time = time.time()

        response = client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a SQL expert. Convert natural language questions to SQLite SQL queries.

Database schema:
{schema_info}

Rules:
- Return ONLY the SQL query, no explanations
- Use SQLite syntax
- Limit results to 100 rows
- Use proper JOINs when querying across tables
- For fund performance queries, filter for non-null values"""
                },
                {"role": "user", "content": request.question}
            ],
            temperature=0
        )

        sql = response.choices[0].message.content.strip()

        # Clean up SQL if wrapped in code blocks
        if sql.startswith("```"):
            sql = sql.split("```")[1]
            if sql.startswith("sql"):
                sql = sql[3:]
            sql = sql.strip()

        # Execute the query
        result = db.execute(sql)
        columns = result.keys()
        rows = result.fetchall()

        execution_time = time.time() - start_time

        results = [dict(zip(columns, row)) for row in rows]

        return NLQResponse(
            question=request.question,
            sql=sql,
            results=results,
            execution_time=execution_time
        )

    except Exception as e:
        return NLQResponse(
            question=request.question,
            sql="",
            results=[],
            execution_time=0,
            error=str(e)
        )
