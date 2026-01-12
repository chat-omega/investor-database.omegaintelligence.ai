"""
Simple Search for Preqin Data Layer

Uses pg_trgm for fuzzy text matching on entity names.
Fast, simple search for basic lookups.

Usage:
    from preqin.search import simple_firm_search
    
    results = simple_firm_search("blackrock", limit=10)
"""

import logging
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import SessionLocal

logger = logging.getLogger(__name__)


def simple_firm_search(
    query: str,
    firm_type: Optional[str] = None,
    country: Optional[str] = None,
    min_aum: Optional[float] = None,
    limit: int = 20,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Search firms using pg_trgm fuzzy matching.
    
    Args:
        query: Search query string
        firm_type: Optional filter (GP, LP, BOTH)
        country: Optional country filter
        min_aum: Optional minimum AUM filter
        limit: Maximum results
        
    Returns:
        List of matching firm dictionaries with similarity scores
    """
    if not query or len(query.strip()) < 2:
        return []
    
    # Build WHERE clauses
    where_clauses = ["1=1"]
    params = {"query": query.lower(), "limit": limit}
    
    if firm_type:
        where_clauses.append("firm_type = :firm_type")
        params["firm_type"] = firm_type
    
    if country:
        where_clauses.append("headquarters_country ILIKE :country")
        params["country"] = f"%{country}%"
    
    if min_aum:
        where_clauses.append("aum_usd >= :min_aum")
        params["min_aum"] = min_aum
    
    where_sql = " AND ".join(where_clauses)
    
    sql = text(f"""
        SELECT 
            id,
            name,
            name_normalized,
            firm_type,
            institution_type,
            headquarters_country,
            headquarters_city,
            aum_usd,
            similarity(name_normalized, :query) as score
        FROM preqin.preqin_firms
        WHERE {where_sql}
          AND (
              name_normalized % :query
              OR name_normalized ILIKE '%' || :query || '%'
          )
        ORDER BY score DESC, aum_usd DESC NULLS LAST
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, params)
        
        firms = []
        for row in result:
            firms.append({
                "id": str(row[0]),
                "name": row[1],
                "name_normalized": row[2],
                "firm_type": row[3],
                "institution_type": row[4],
                "headquarters_country": row[5],
                "headquarters_city": row[6],
                "aum_usd": float(row[7]) if row[7] else None,
                "score": float(row[8]) if row[8] else 0,
            })
        
        return firms
    finally:
        if close_session:
            session.close()


def simple_fund_search(
    query: str,
    strategy: Optional[str] = None,
    vintage_year: Optional[int] = None,
    min_size: Optional[float] = None,
    limit: int = 20,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Search funds using pg_trgm fuzzy matching.
    
    Args:
        query: Search query string
        strategy: Optional strategy filter
        vintage_year: Optional vintage year filter
        min_size: Optional minimum fund size filter
        limit: Maximum results
        
    Returns:
        List of matching fund dictionaries with similarity scores
    """
    if not query or len(query.strip()) < 2:
        return []
    
    # Build WHERE clauses
    where_clauses = ["1=1"]
    params = {"query": query.lower(), "limit": limit}
    
    if strategy:
        where_clauses.append("strategy ILIKE :strategy")
        params["strategy"] = f"%{strategy}%"
    
    if vintage_year:
        where_clauses.append("vintage_year = :vintage_year")
        params["vintage_year"] = vintage_year
    
    if min_size:
        where_clauses.append("fund_size_usd >= :min_size")
        params["min_size"] = min_size
    
    where_sql = " AND ".join(where_clauses)
    
    sql = text(f"""
        SELECT 
            f.id,
            f.name,
            f.name_normalized,
            f.vintage_year,
            f.strategy,
            f.fund_size_usd,
            f.status,
            fm.name as manager_name,
            similarity(f.name_normalized, :query) as score
        FROM preqin.preqin_funds f
        LEFT JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
        LEFT JOIN preqin.preqin_firms fm ON fm.id = fmf.firm_id
        WHERE {where_sql}
          AND (
              f.name_normalized % :query
              OR f.name_normalized ILIKE '%' || :query || '%'
          )
        ORDER BY score DESC, f.fund_size_usd DESC NULLS LAST
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, params)
        
        funds = []
        for row in result:
            funds.append({
                "id": str(row[0]),
                "name": row[1],
                "name_normalized": row[2],
                "vintage_year": row[3],
                "strategy": row[4],
                "fund_size_usd": float(row[5]) if row[5] else None,
                "status": row[6],
                "manager_name": row[7],
                "score": float(row[8]) if row[8] else 0,
            })
        
        return funds
    finally:
        if close_session:
            session.close()


def simple_deal_search(
    query: str,
    deal_type: Optional[str] = None,
    industry: Optional[str] = None,
    country: Optional[str] = None,
    min_value: Optional[float] = None,
    limit: int = 20,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Search deals by company name using pg_trgm fuzzy matching.
    
    Args:
        query: Search query string (matches company name)
        deal_type: Optional deal type filter
        industry: Optional industry filter
        country: Optional country filter
        min_value: Optional minimum deal value filter
        limit: Maximum results
        
    Returns:
        List of matching deal dictionaries with similarity scores
    """
    if not query or len(query.strip()) < 2:
        return []
    
    # Build WHERE clauses
    where_clauses = ["1=1"]
    params = {"query": query.lower(), "limit": limit}
    
    if deal_type:
        where_clauses.append("d.deal_type ILIKE :deal_type")
        params["deal_type"] = f"%{deal_type}%"
    
    if industry:
        where_clauses.append("d.primary_industry ILIKE :industry")
        params["industry"] = f"%{industry}%"
    
    if country:
        where_clauses.append("d.country ILIKE :country")
        params["country"] = f"%{country}%"
    
    if min_value:
        where_clauses.append("d.deal_value_usd >= :min_value")
        params["min_value"] = min_value
    
    where_sql = " AND ".join(where_clauses)
    
    sql = text(f"""
        SELECT 
            d.id,
            d.deal_type,
            d.deal_date,
            d.deal_value_usd,
            d.stage,
            d.primary_industry,
            d.country,
            c.name as company_name,
            similarity(c.name_normalized, :query) as score
        FROM preqin.preqin_deals d
        JOIN preqin.preqin_deal_target_company dtc ON dtc.deal_id = d.id
        JOIN preqin.preqin_companies c ON c.id = dtc.company_id
        WHERE {where_sql}
          AND (
              c.name_normalized % :query
              OR c.name_normalized ILIKE '%' || :query || '%'
          )
        ORDER BY score DESC, d.deal_date DESC NULLS LAST
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, params)
        
        deals = []
        for row in result:
            deals.append({
                "id": str(row[0]),
                "deal_type": row[1],
                "deal_date": row[2].isoformat() if row[2] else None,
                "deal_value_usd": float(row[3]) if row[3] else None,
                "stage": row[4],
                "primary_industry": row[5],
                "country": row[6],
                "company_name": row[7],
                "score": float(row[8]) if row[8] else 0,
            })
        
        return deals
    finally:
        if close_session:
            session.close()


def simple_person_search(
    query: str,
    title: Optional[str] = None,
    firm_id: Optional[UUID] = None,
    limit: int = 20,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Search persons using pg_trgm fuzzy matching.
    
    Args:
        query: Search query string (matches name)
        title: Optional title filter
        firm_id: Optional firm ID filter
        limit: Maximum results
        
    Returns:
        List of matching person dictionaries with similarity scores
    """
    if not query or len(query.strip()) < 2:
        return []
    
    # Build WHERE clauses
    where_clauses = ["1=1"]
    params = {"query": query.lower(), "limit": limit}
    
    if title:
        where_clauses.append("p.title ILIKE :title")
        params["title"] = f"%{title}%"
    
    if firm_id:
        where_clauses.append("pe.firm_id = :firm_id")
        params["firm_id"] = str(firm_id)
    
    where_sql = " AND ".join(where_clauses)
    
    sql = text(f"""
        SELECT 
            p.id,
            p.full_name,
            p.title,
            p.email,
            p.location_city,
            p.location_country,
            f.name as firm_name,
            similarity(LOWER(p.full_name), :query) as score
        FROM preqin.preqin_persons p
        LEFT JOIN preqin.preqin_person_employment pe ON pe.person_id = p.id AND pe.is_current = TRUE
        LEFT JOIN preqin.preqin_firms f ON f.id = pe.firm_id
        WHERE {where_sql}
          AND (
              LOWER(p.full_name) % :query
              OR p.full_name ILIKE '%' || :query || '%'
          )
        ORDER BY score DESC
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, params)
        
        persons = []
        for row in result:
            persons.append({
                "id": str(row[0]),
                "full_name": row[1],
                "title": row[2],
                "email": row[3],
                "location_city": row[4],
                "location_country": row[5],
                "firm_name": row[6],
                "score": float(row[7]) if row[7] else 0,
            })
        
        return persons
    finally:
        if close_session:
            session.close()
