"""
FastAPI Routes for Preqin Data Layer

Provides REST API endpoints for:
- Entity lookups (Firms, Funds, Deals, People, Companies)
- Relationship queries
- Hybrid search
- Co-investment network analysis
"""

import logging
from typing import Optional, List
from uuid import UUID
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from preqin.database import get_preqin_db
from preqin.schemas import (
    FirmResponse, FirmListResponse, FirmDetail,
    FundResponse, FundListResponse, FundSummary,
    PersonResponse, PersonListResponse, PersonSummary,
    CompanyResponse, CompanyListResponse,
    DealResponse, DealListResponse, DealSummary,
    CoInvestorSummary, CoInvestmentNetworkResponse, CoInvestmentDrilldown,
    SearchRequest, SearchResponse, SearchResult,
    PreqinStats, EntityType,
)
from preqin.search import simple_firm_search, simple_fund_search, simple_deal_search, hybrid_search
from preqin.analysis import get_co_investors, get_network_hops, get_co_investment_drilldown

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/preqin", tags=["preqin"])


# =============================================================================
# Firm Endpoints
# =============================================================================

@router.get("/firms", response_model=FirmListResponse)
def list_firms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    firm_type: Optional[str] = None,
    country: Optional[str] = None,
    min_aum: Optional[float] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_preqin_db)
):
    """
    List firms with pagination and filtering.
    """
    # Build query
    where_clauses = ["1=1"]
    params = {}
    
    if firm_type:
        where_clauses.append("firm_type = :firm_type")
        params["firm_type"] = firm_type
    
    if country:
        where_clauses.append("headquarters_country ILIKE :country")
        params["country"] = f"%{country}%"
    
    if min_aum:
        where_clauses.append("aum_usd >= :min_aum")
        params["min_aum"] = min_aum
    
    if search:
        where_clauses.append("(name_normalized % :search OR name ILIKE :search_like)")
        params["search"] = search.lower()
        params["search_like"] = f"%{search}%"
    
    where_sql = " AND ".join(where_clauses)
    
    # Count total
    count_sql = text(f"SELECT COUNT(*) FROM preqin.preqin_firms WHERE {where_sql}")
    total = db.execute(count_sql, params).scalar()
    
    # Get page
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset
    
    sql = text(f"""
        SELECT 
            id, source_system, source_id, preqin_id,
            name, name_normalized, firm_type, institution_type,
            headquarters_city, headquarters_country, headquarters_region,
            aum_usd, aum_raw, dry_powder_usd,
            website, description, year_founded, is_listed, ticker,
            created_at, updated_at
        FROM preqin.preqin_firms
        WHERE {where_sql}
        ORDER BY aum_usd DESC NULLS LAST, name
        LIMIT :limit OFFSET :offset
    """)
    
    result = db.execute(sql, params)
    
    items = []
    for row in result:
        items.append(FirmResponse(
            id=row[0],
            source_system=row[1],
            source_id=row[2],
            preqin_id=row[3],
            name=row[4],
            name_normalized=row[5],
            firm_type=row[6],
            institution_type=row[7],
            headquarters_city=row[8],
            headquarters_country=row[9],
            headquarters_region=row[10],
            aum_usd=float(row[11]) if row[11] else None,
            aum_raw=row[12],
            dry_powder_usd=float(row[13]) if row[13] else None,
            website=row[14],
            description=row[15],
            year_founded=row[16],
            is_listed=row[17],
            ticker=row[18],
            created_at=row[19],
            updated_at=row[20],
        ))
    
    return FirmListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0
    )


@router.get("/firms/{firm_id}", response_model=FirmDetail)
def get_firm(firm_id: UUID, db: Session = Depends(get_preqin_db)):
    """
    Get detailed firm information including relationships.
    """
    sql = text("""
        SELECT 
            id, source_system, source_id, preqin_id,
            name, name_normalized, firm_type, institution_type,
            headquarters_city, headquarters_country, headquarters_region,
            aum_usd, aum_raw, dry_powder_usd,
            website, description, year_founded, is_listed, ticker,
            created_at, updated_at
        FROM preqin.preqin_firms
        WHERE id = :firm_id
    """)
    
    result = db.execute(sql, {"firm_id": str(firm_id)}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    # Get managed funds
    funds_sql = text("""
        SELECT f.id, f.name, f.vintage_year, f.strategy, f.fund_size_usd
        FROM preqin.preqin_funds f
        JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
        WHERE fmf.firm_id = :firm_id
        ORDER BY f.vintage_year DESC NULLS LAST
        LIMIT 10
    """)
    funds_result = db.execute(funds_sql, {"firm_id": str(firm_id)})
    managed_funds = [
        FundSummary(
            id=row[0], name=row[1], vintage_year=row[2],
            strategy=row[3], fund_size_usd=float(row[4]) if row[4] else None
        )
        for row in funds_result
    ]
    
    # Get top contacts
    contacts_sql = text("""
        SELECT p.id, p.full_name, p.title, p.email
        FROM preqin.preqin_persons p
        JOIN preqin.preqin_person_employment pe ON pe.person_id = p.id
        WHERE pe.firm_id = :firm_id AND pe.is_current = TRUE
        ORDER BY 
            CASE 
                WHEN p.title ILIKE '%ceo%' OR p.title ILIKE '%chief%' THEN 1
                WHEN p.title ILIKE '%partner%' OR p.title ILIKE '%director%' THEN 2
                ELSE 3
            END
        LIMIT 5
    """)
    contacts_result = db.execute(contacts_sql, {"firm_id": str(firm_id)})
    top_contacts = [
        PersonSummary(id=row[0], full_name=row[1], title=row[2], email=row[3])
        for row in contacts_result
    ]
    
    # Get co-investors
    co_investors = get_co_investors(firm_id, min_deals=2, limit=10, session=db)
    co_investor_summaries = [
        CoInvestorSummary(
            firm_id=c["firm_id"],
            firm_name=c["firm_name"],
            firm_type=c["firm_type"],
            deal_count=c["deal_count"],
            total_value_usd=c["total_value_usd"],
            first_deal_date=c["first_deal_date"],
            last_deal_date=c["last_deal_date"],
        )
        for c in co_investors
    ]
    
    return FirmDetail(
        id=result[0],
        source_system=result[1],
        source_id=result[2],
        preqin_id=result[3],
        name=result[4],
        name_normalized=result[5],
        firm_type=result[6],
        institution_type=result[7],
        headquarters_city=result[8],
        headquarters_country=result[9],
        headquarters_region=result[10],
        aum_usd=float(result[11]) if result[11] else None,
        aum_raw=result[12],
        dry_powder_usd=float(result[13]) if result[13] else None,
        website=result[14],
        description=result[15],
        year_founded=result[16],
        is_listed=result[17],
        ticker=result[18],
        created_at=result[19],
        updated_at=result[20],
        managed_funds=managed_funds,
        top_contacts=top_contacts,
        co_investors=co_investor_summaries,
    )


@router.get("/firms/{firm_id}/co-investors", response_model=CoInvestmentNetworkResponse)
def get_firm_co_investors(
    firm_id: UUID,
    min_deals: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_preqin_db)
):
    """
    Get co-investors for a firm.
    """
    # Verify firm exists
    sql = text("SELECT name FROM preqin.preqin_firms WHERE id = :firm_id")
    result = db.execute(sql, {"firm_id": str(firm_id)}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    firm_name = result[0]
    co_investors = get_co_investors(firm_id, min_deals=min_deals, limit=limit, session=db)
    
    return CoInvestmentNetworkResponse(
        firm_id=firm_id,
        firm_name=firm_name,
        co_investors=[
            CoInvestorSummary(
                firm_id=c["firm_id"],
                firm_name=c["firm_name"],
                firm_type=c["firm_type"],
                deal_count=c["deal_count"],
                total_value_usd=c["total_value_usd"],
                first_deal_date=c["first_deal_date"],
                last_deal_date=c["last_deal_date"],
            )
            for c in co_investors
        ],
        total_co_investors=len(co_investors)
    )


@router.get("/firms/{firm_id}/network")
def get_firm_network(
    firm_id: UUID,
    max_hops: int = Query(2, ge=1, le=3),
    min_deals: int = Query(1, ge=1),
    db: Session = Depends(get_preqin_db)
):
    """
    Get co-investment network within N hops of a firm.
    """
    # Verify firm exists
    sql = text("SELECT name FROM preqin.preqin_firms WHERE id = :firm_id")
    result = db.execute(sql, {"firm_id": str(firm_id)}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    network = get_network_hops(firm_id, max_hops=max_hops, min_deals=min_deals, session=db)
    network["firm_name"] = result[0]
    
    return network


@router.get("/firms/{firm_a_id}/co-investments/{firm_b_id}", response_model=CoInvestmentDrilldown)
def get_co_investment_details(
    firm_a_id: UUID,
    firm_b_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_preqin_db)
):
    """
    Get specific deals where two firms co-invested.
    """
    # Get firm names
    sql = text("""
        SELECT id, name FROM preqin.preqin_firms 
        WHERE id IN (:firm_a_id, :firm_b_id)
    """)
    result = db.execute(sql, {
        "firm_a_id": str(firm_a_id),
        "firm_b_id": str(firm_b_id)
    }).fetchall()
    
    if len(result) < 2:
        raise HTTPException(status_code=404, detail="One or both firms not found")
    
    firm_names = {str(row[0]): row[1] for row in result}
    
    deals = get_co_investment_drilldown(firm_a_id, firm_b_id, limit=limit, session=db)
    
    total_value = sum(d["deal_value_usd"] or 0 for d in deals)
    
    return CoInvestmentDrilldown(
        firm_a_id=firm_a_id,
        firm_a_name=firm_names.get(str(firm_a_id), "Unknown"),
        firm_b_id=firm_b_id,
        firm_b_name=firm_names.get(str(firm_b_id), "Unknown"),
        deals=[
            DealSummary(
                id=d["deal_id"],
                deal_type=d["deal_type"],
                deal_date=d["deal_date"],
                deal_value_usd=d["deal_value_usd"],
                target_company_name=d["target_company_name"],
            )
            for d in deals
        ],
        total_deals=len(deals),
        total_value_usd=total_value if total_value > 0 else None,
    )


# =============================================================================
# Fund Endpoints
# =============================================================================

@router.get("/funds", response_model=FundListResponse)
def list_funds(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    strategy: Optional[str] = None,
    vintage_year: Optional[int] = None,
    min_size: Optional[float] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_preqin_db)
):
    """
    List funds with pagination and filtering.
    """
    where_clauses = ["1=1"]
    params = {}
    
    if strategy:
        where_clauses.append("strategy ILIKE :strategy")
        params["strategy"] = f"%{strategy}%"
    
    if vintage_year:
        where_clauses.append("vintage_year = :vintage_year")
        params["vintage_year"] = vintage_year
    
    if min_size:
        where_clauses.append("fund_size_usd >= :min_size")
        params["min_size"] = min_size
    
    if search:
        where_clauses.append("(name_normalized % :search OR name ILIKE :search_like)")
        params["search"] = search.lower()
        params["search_like"] = f"%{search}%"
    
    where_sql = " AND ".join(where_clauses)
    
    # Count total
    count_sql = text(f"SELECT COUNT(*) FROM preqin.preqin_funds WHERE {where_sql}")
    total = db.execute(count_sql, params).scalar()
    
    # Get page
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset
    
    sql = text(f"""
        SELECT 
            f.id, f.source_system, f.source_id, f.preqin_id,
            f.name, f.name_normalized, f.vintage_year,
            f.fund_size_usd, f.fund_size_raw, f.target_size_usd, f.currency,
            f.strategy, f.sub_strategy, f.status,
            f.geography_focus, f.sector_focus, f.domicile_country,
            f.irr, f.tvpi, f.dpi,
            f.first_close_date, f.final_close_date,
            f.created_at, f.updated_at,
            fm.id as manager_id, fm.name as manager_name
        FROM preqin.preqin_funds f
        LEFT JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
        LEFT JOIN preqin.preqin_firms fm ON fm.id = fmf.firm_id
        WHERE {where_sql}
        ORDER BY f.vintage_year DESC NULLS LAST, f.fund_size_usd DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    
    result = db.execute(sql, params)
    
    items = []
    for row in result:
        items.append(FundResponse(
            id=row[0],
            source_system=row[1],
            source_id=row[2],
            preqin_id=row[3],
            name=row[4],
            name_normalized=row[5],
            vintage_year=row[6],
            fund_size_usd=float(row[7]) if row[7] else None,
            fund_size_raw=row[8],
            target_size_usd=float(row[9]) if row[9] else None,
            currency=row[10],
            strategy=row[11],
            sub_strategy=row[12],
            status=row[13],
            geography_focus=row[14],
            sector_focus=row[15],
            domicile_country=row[16],
            irr=float(row[17]) if row[17] else None,
            tvpi=float(row[18]) if row[18] else None,
            dpi=float(row[19]) if row[19] else None,
            first_close_date=row[20],
            final_close_date=row[21],
            created_at=row[22],
            updated_at=row[23],
            managing_firm_id=row[24],
            managing_firm_name=row[25],
        ))
    
    return FundListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0
    )


@router.get("/funds/{fund_id}", response_model=FundResponse)
def get_fund(fund_id: UUID, db: Session = Depends(get_preqin_db)):
    """
    Get fund details.
    """
    sql = text("""
        SELECT 
            f.id, f.source_system, f.source_id, f.preqin_id,
            f.name, f.name_normalized, f.vintage_year,
            f.fund_size_usd, f.fund_size_raw, f.target_size_usd, f.currency,
            f.strategy, f.sub_strategy, f.status,
            f.geography_focus, f.sector_focus, f.domicile_country,
            f.irr, f.tvpi, f.dpi,
            f.first_close_date, f.final_close_date,
            f.created_at, f.updated_at,
            fm.id as manager_id, fm.name as manager_name
        FROM preqin.preqin_funds f
        LEFT JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
        LEFT JOIN preqin.preqin_firms fm ON fm.id = fmf.firm_id
        WHERE f.id = :fund_id
    """)
    
    result = db.execute(sql, {"fund_id": str(fund_id)}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Fund not found")
    
    return FundResponse(
        id=result[0],
        source_system=result[1],
        source_id=result[2],
        preqin_id=result[3],
        name=result[4],
        name_normalized=result[5],
        vintage_year=result[6],
        fund_size_usd=float(result[7]) if result[7] else None,
        fund_size_raw=result[8],
        target_size_usd=float(result[9]) if result[9] else None,
        currency=result[10],
        strategy=result[11],
        sub_strategy=result[12],
        status=result[13],
        geography_focus=result[14],
        sector_focus=result[15],
        domicile_country=result[16],
        irr=float(result[17]) if result[17] else None,
        tvpi=float(result[18]) if result[18] else None,
        dpi=float(result[19]) if result[19] else None,
        first_close_date=result[20],
        final_close_date=result[21],
        created_at=result[22],
        updated_at=result[23],
        managing_firm_id=result[24],
        managing_firm_name=result[25],
    )


# =============================================================================
# Deal Endpoints
# =============================================================================

@router.get("/deals", response_model=DealListResponse)
def list_deals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    deal_type: Optional[str] = None,
    industry: Optional[str] = None,
    country: Optional[str] = None,
    min_value: Optional[float] = None,
    db: Session = Depends(get_preqin_db)
):
    """
    List deals with pagination and filtering.
    """
    where_clauses = ["1=1"]
    params = {}
    
    if deal_type:
        where_clauses.append("deal_type ILIKE :deal_type")
        params["deal_type"] = f"%{deal_type}%"
    
    if industry:
        where_clauses.append("primary_industry ILIKE :industry")
        params["industry"] = f"%{industry}%"
    
    if country:
        where_clauses.append("country ILIKE :country")
        params["country"] = f"%{country}%"
    
    if min_value:
        where_clauses.append("deal_value_usd >= :min_value")
        params["min_value"] = min_value
    
    where_sql = " AND ".join(where_clauses)
    
    # Count total
    count_sql = text(f"SELECT COUNT(*) FROM preqin.preqin_deals WHERE {where_sql}")
    total = db.execute(count_sql, params).scalar()
    
    # Get page
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset
    
    sql = text(f"""
        SELECT 
            d.id, d.source_system, d.source_id, d.preqin_id,
            d.deal_type, d.deal_date, d.deal_value_usd, d.deal_value_raw,
            d.stage, d.deal_status,
            d.country, d.region,
            d.primary_industry, d.secondary_industry,
            d.announced_date, d.closed_date,
            d.created_at, d.updated_at,
            c.id as company_id, c.name as company_name
        FROM preqin.preqin_deals d
        LEFT JOIN preqin.preqin_deal_target_company dtc ON dtc.deal_id = d.id
        LEFT JOIN preqin.preqin_companies c ON c.id = dtc.company_id
        WHERE {where_sql}
        ORDER BY d.deal_date DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    
    result = db.execute(sql, params)
    
    items = []
    for row in result:
        items.append(DealResponse(
            id=row[0],
            source_system=row[1],
            source_id=row[2],
            preqin_id=row[3],
            deal_type=row[4],
            deal_date=row[5],
            deal_value_usd=float(row[6]) if row[6] else None,
            deal_value_raw=row[7],
            stage=row[8],
            deal_status=row[9],
            country=row[10],
            region=row[11],
            primary_industry=row[12],
            secondary_industry=row[13],
            announced_date=row[14],
            closed_date=row[15],
            created_at=row[16],
            updated_at=row[17],
            target_company_id=row[18],
            target_company_name=row[19],
        ))
    
    return DealListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0
    )


@router.get("/deals/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: UUID, db: Session = Depends(get_preqin_db)):
    """
    Get deal details.
    """
    sql = text("""
        SELECT 
            d.id, d.source_system, d.source_id, d.preqin_id,
            d.deal_type, d.deal_date, d.deal_value_usd, d.deal_value_raw,
            d.stage, d.deal_status,
            d.country, d.region,
            d.primary_industry, d.secondary_industry,
            d.announced_date, d.closed_date,
            d.created_at, d.updated_at,
            c.id as company_id, c.name as company_name
        FROM preqin.preqin_deals d
        LEFT JOIN preqin.preqin_deal_target_company dtc ON dtc.deal_id = d.id
        LEFT JOIN preqin.preqin_companies c ON c.id = dtc.company_id
        WHERE d.id = :deal_id
    """)
    
    result = db.execute(sql, {"deal_id": str(deal_id)}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Get investors
    investors_sql = text("""
        SELECT f.name
        FROM preqin.preqin_deal_investor_firm dif
        JOIN preqin.preqin_firms f ON f.id = dif.investor_firm_id
        WHERE dif.deal_id = :deal_id
    """)
    investor_result = db.execute(investors_sql, {"deal_id": str(deal_id)})
    investor_firms = [row[0] for row in investor_result]
    
    return DealResponse(
        id=result[0],
        source_system=result[1],
        source_id=result[2],
        preqin_id=result[3],
        deal_type=result[4],
        deal_date=result[5],
        deal_value_usd=float(result[6]) if result[6] else None,
        deal_value_raw=result[7],
        stage=result[8],
        deal_status=result[9],
        country=result[10],
        region=result[11],
        primary_industry=result[12],
        secondary_industry=result[13],
        announced_date=result[14],
        closed_date=result[15],
        created_at=result[16],
        updated_at=result[17],
        target_company_id=result[18],
        target_company_name=result[19],
        investor_firms=investor_firms,
    )


# =============================================================================
# Search Endpoint
# =============================================================================

@router.post("/search", response_model=SearchResponse)
def search_entities(
    request: SearchRequest,
    db: Session = Depends(get_preqin_db)
):
    """
    Hybrid search across entities.
    
    Combines full-text search, pg_trgm fuzzy matching, and semantic search.
    """
    entity_types = [e.value for e in request.entity_types] if request.entity_types else None
    
    filters = {}
    if request.filters:
        if request.filters.min_aum:
            filters["min_aum"] = request.filters.min_aum
        if request.filters.country:
            filters["country"] = request.filters.country
        if request.filters.strategy:
            filters["strategy"] = request.filters.strategy
        if request.filters.firm_type:
            filters["firm_type"] = request.filters.firm_type
    
    result = hybrid_search(
        query=request.query,
        entity_types=entity_types,
        filters=filters if filters else None,
        use_semantic=request.use_semantic,
        limit=request.limit,
        session=db
    )
    
    return SearchResponse(
        query=result["query"],
        results=[
            SearchResult(
                entity_type=EntityType(r["entity_type"]),
                entity_id=r["entity_id"],
                score=r["score"],
                title=r["title"],
                snippet=r["snippet"],
                metadata=r["entity_metadata"],
            )
            for r in result["results"]
        ],
        total=result["total"],
        search_type=result["search_type"],
    )


# =============================================================================
# Statistics Endpoint
# =============================================================================

@router.get("/stats", response_model=PreqinStats)
def get_stats(db: Session = Depends(get_preqin_db)):
    """
    Get aggregate statistics for the Preqin database.
    """
    sql = text("""
        SELECT
            (SELECT COUNT(*) FROM preqin.preqin_firms) as total_firms,
            (SELECT COUNT(*) FROM preqin.preqin_firms WHERE firm_type = 'GP') as total_gps,
            (SELECT COUNT(*) FROM preqin.preqin_firms WHERE firm_type = 'LP') as total_lps,
            (SELECT COUNT(*) FROM preqin.preqin_funds) as total_funds,
            (SELECT COUNT(*) FROM preqin.preqin_deals) as total_deals,
            (SELECT COUNT(*) FROM preqin.preqin_persons) as total_persons,
            (SELECT COUNT(*) FROM preqin.preqin_companies) as total_companies,
            (SELECT SUM(aum_usd) FROM preqin.preqin_firms) as total_aum_usd
    """)
    
    result = db.execute(sql).fetchone()
    
    # Get strategy distribution
    strategy_sql = text("""
        SELECT strategy, COUNT(*) as count
        FROM preqin.preqin_funds
        WHERE strategy IS NOT NULL
        GROUP BY strategy
        ORDER BY count DESC
        LIMIT 10
    """)
    strategy_result = db.execute(strategy_sql)
    funds_by_strategy = {row[0]: row[1] for row in strategy_result}
    
    # Get country distribution
    country_sql = text("""
        SELECT headquarters_country, COUNT(*) as count
        FROM preqin.preqin_firms
        WHERE headquarters_country IS NOT NULL
        GROUP BY headquarters_country
        ORDER BY count DESC
        LIMIT 10
    """)
    country_result = db.execute(country_sql)
    firms_by_country = {row[0]: row[1] for row in country_result}
    
    return PreqinStats(
        total_firms=result[0] or 0,
        total_gps=result[1] or 0,
        total_lps=result[2] or 0,
        total_funds=result[3] or 0,
        total_deals=result[4] or 0,
        total_persons=result[5] or 0,
        total_companies=result[6] or 0,
        total_aum_usd=float(result[7]) if result[7] else None,
        funds_by_strategy=funds_by_strategy,
        firms_by_country=firms_by_country,
    )
