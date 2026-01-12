"""
Co-Investment Analysis for Preqin Data Layer

Generates co-investment edge table and provides network query functions.
Implements bounded hop queries using recursive CTEs.

Usage:
    python -m preqin.analysis.co_investment [--regenerate]
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import engine, SessionLocal

logger = logging.getLogger(__name__)

# High-degree deal filter threshold
# Deals with more investors than this are likely data quality issues
MAX_INVESTORS_PER_DEAL = 50


def generate_co_investment_edges(
    batch_size: int = 100000,
    max_investors_per_deal: int = MAX_INVESTORS_PER_DEAL
) -> Dict[str, Any]:
    """
    Generate the co-investment edge table from deal investor relationships.

    This pre-computes firm co-investment pairs for fast network queries.
    Only stores aggregated metrics (no deal_ids array to avoid scaling issues).

    Args:
        batch_size: Number of edges to process per batch
        max_investors_per_deal: Skip deals with more investors than this threshold

    Returns:
        Statistics about generated edges
    """
    logger.info(f"Generating co-investment edge table (max_investors_per_deal={max_investors_per_deal})")

    with SessionLocal() as session:
        # First, identify and log high-degree deals that will be skipped
        high_degree_sql = text("""
            SELECT d.id, d.deal_type, d.deal_date, COUNT(*) as investor_count
            FROM preqin.preqin_deal_investor_firm dif
            JOIN preqin.preqin_deals d ON d.id = dif.deal_id
            WHERE dif.investor_firm_id IS NOT NULL
            GROUP BY d.id, d.deal_type, d.deal_date
            HAVING COUNT(*) > :max_investors
            ORDER BY investor_count DESC
        """)

        high_degree_result = session.execute(high_degree_sql, {"max_investors": max_investors_per_deal})
        skipped_deals = high_degree_result.fetchall()

        if skipped_deals:
            logger.warning(f"Skipping {len(skipped_deals)} high-degree deals (>{max_investors_per_deal} investors)")
            for deal in skipped_deals[:10]:  # Log first 10
                logger.warning(f"  Skipped deal {deal[0]}: type={deal[1]}, date={deal[2]}, investors={deal[3]}")
            if len(skipped_deals) > 10:
                logger.warning(f"  ... and {len(skipped_deals) - 10} more high-degree deals")

        # Clear existing edges
        session.execute(text("TRUNCATE TABLE preqin.preqin_co_investment_edge"))
        
        # Generate edges from deal investor relationships
        # Note: Uses LEAST/GREATEST to ensure firm_a_id < firm_b_id (canonical ordering)
        # Uses CTE to filter out high-degree deals (data quality guardrail)
        sql = text("""
            WITH deal_investor_counts AS (
                SELECT deal_id, COUNT(*) as investor_count
                FROM preqin.preqin_deal_investor_firm
                WHERE investor_firm_id IS NOT NULL
                GROUP BY deal_id
            ),
            valid_deals AS (
                SELECT deal_id FROM deal_investor_counts
                WHERE investor_count <= :max_investors
            )
            INSERT INTO preqin.preqin_co_investment_edge (
                firm_a_id, firm_b_id,
                deal_count, total_value_usd,
                first_deal_date, last_deal_date,
                top_industries
            )
            SELECT
                LEAST(a.investor_firm_id, b.investor_firm_id) as firm_a_id,
                GREATEST(a.investor_firm_id, b.investor_firm_id) as firm_b_id,
                COUNT(DISTINCT a.deal_id) as deal_count,
                SUM(d.deal_value_usd) as total_value_usd,
                MIN(d.deal_date) as first_deal_date,
                MAX(d.deal_date) as last_deal_date,
                NULL as top_industries
            FROM preqin.preqin_deal_investor_firm a
            JOIN preqin.preqin_deal_investor_firm b
                ON a.deal_id = b.deal_id
                AND a.investor_firm_id < b.investor_firm_id
            JOIN preqin.preqin_deals d ON d.id = a.deal_id
            JOIN valid_deals vd ON vd.deal_id = a.deal_id
            WHERE a.investor_firm_id IS NOT NULL
              AND b.investor_firm_id IS NOT NULL
            GROUP BY
                LEAST(a.investor_firm_id, b.investor_firm_id),
                GREATEST(a.investor_firm_id, b.investor_firm_id)
            ON CONFLICT (firm_a_id, firm_b_id) DO UPDATE SET
                deal_count = EXCLUDED.deal_count,
                total_value_usd = EXCLUDED.total_value_usd,
                first_deal_date = EXCLUDED.first_deal_date,
                last_deal_date = EXCLUDED.last_deal_date,
                top_industries = EXCLUDED.top_industries,
                updated_at = NOW()
        """)

        result = session.execute(sql, {"max_investors": max_investors_per_deal})
        edge_count = result.rowcount
        session.commit()

        # Get statistics
        stats_sql = text("""
            SELECT
                COUNT(*) as total_edges,
                SUM(deal_count) as total_deals,
                AVG(deal_count) as avg_deals_per_edge,
                MAX(deal_count) as max_deals_per_edge
            FROM preqin.preqin_co_investment_edge
        """)

        stats = session.execute(stats_sql).fetchone()

    result = {
        "edges_created": edge_count,
        "total_edges": stats[0] if stats else 0,
        "total_deal_connections": stats[1] if stats else 0,
        "avg_deals_per_edge": float(stats[2]) if stats and stats[2] else 0,
        "max_deals_per_edge": stats[3] if stats else 0,
        "high_degree_deals_skipped": len(skipped_deals),
        "max_investors_threshold": max_investors_per_deal,
    }

    logger.info(f"Generated {edge_count} co-investment edges (skipped {len(skipped_deals)} high-degree deals)")
    return result


def get_co_investors(
    firm_id: UUID,
    min_deals: int = 1,
    limit: int = 50,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Get direct co-investors for a firm.
    
    Args:
        firm_id: UUID of the firm
        min_deals: Minimum number of co-invested deals
        limit: Maximum number of results
        session: Optional database session
        
    Returns:
        List of co-investor dictionaries
    """
    sql = text("""
        SELECT 
            CASE WHEN e.firm_a_id = :firm_id THEN e.firm_b_id ELSE e.firm_a_id END as co_investor_id,
            f.name as co_investor_name,
            f.firm_type,
            f.headquarters_country,
            e.deal_count,
            e.total_value_usd,
            e.first_deal_date,
            e.last_deal_date,
            e.top_industries
        FROM preqin.preqin_co_investment_edge e
        JOIN preqin.preqin_firms f ON f.id = CASE 
            WHEN e.firm_a_id = :firm_id THEN e.firm_b_id 
            ELSE e.firm_a_id 
        END
        WHERE (e.firm_a_id = :firm_id OR e.firm_b_id = :firm_id)
          AND e.deal_count >= :min_deals
        ORDER BY e.deal_count DESC, e.total_value_usd DESC NULLS LAST
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, {
            "firm_id": str(firm_id),
            "min_deals": min_deals,
            "limit": limit
        })
        
        co_investors = []
        for row in result:
            co_investors.append({
                "firm_id": row[0],
                "firm_name": row[1],
                "firm_type": row[2],
                "headquarters_country": row[3],
                "deal_count": row[4],
                "total_value_usd": float(row[5]) if row[5] else None,
                "first_deal_date": row[6].isoformat() if row[6] else None,
                "last_deal_date": row[7].isoformat() if row[7] else None,
                "top_industries": row[8],
            })
        
        return co_investors
    finally:
        if close_session:
            session.close()


def get_network_hops(
    firm_id: UUID,
    max_hops: int = 2,
    min_deals: int = 1,
    limit_per_hop: int = 20,
    session: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Get firms within N hops of a given firm in the co-investment network.
    Uses recursive CTE for bounded traversal.
    
    Args:
        firm_id: UUID of the starting firm
        max_hops: Maximum number of hops (1 or 2 recommended)
        min_deals: Minimum deals to consider a connection
        limit_per_hop: Max firms per hop level
        
    Returns:
        Dictionary with network structure by hop distance
    """
    if max_hops > 3:
        max_hops = 3  # Safety limit
    
    sql = text("""
        WITH RECURSIVE network AS (
            -- Base: direct co-investors (hop 1)
            SELECT
                CASE WHEN e.firm_a_id = :firm_id THEN e.firm_b_id ELSE e.firm_a_id END as firm_id,
                1 as hop,
                ARRAY[:firm_id]::UUID[] as path,
                e.deal_count,
                e.total_value_usd
            FROM preqin.preqin_co_investment_edge e
            WHERE (e.firm_a_id = :firm_id OR e.firm_b_id = :firm_id)
              AND e.deal_count >= :min_deals

            UNION ALL

            -- Recursive: further hops
            SELECT
                CASE WHEN e.firm_a_id = n.firm_id THEN e.firm_b_id ELSE e.firm_a_id END,
                n.hop + 1,
                n.path || n.firm_id,
                e.deal_count,
                e.total_value_usd
            FROM network n
            JOIN preqin.preqin_co_investment_edge e
                ON (e.firm_a_id = n.firm_id OR e.firm_b_id = n.firm_id)
            WHERE n.hop < :max_hops
              AND e.deal_count >= :min_deals
              AND NOT (CASE WHEN e.firm_a_id = n.firm_id THEN e.firm_b_id ELSE e.firm_a_id END = ANY(n.path))
              AND CASE WHEN e.firm_a_id = n.firm_id THEN e.firm_b_id ELSE e.firm_a_id END != :firm_id
        )
        SELECT 
            f.id,
            f.name,
            f.firm_type,
            f.headquarters_country,
            f.aum_usd,
            MIN(n.hop) as distance,
            SUM(n.deal_count) as total_connections,
            SUM(n.total_value_usd) as total_connection_value
        FROM network n
        JOIN preqin.preqin_firms f ON f.id = n.firm_id
        GROUP BY f.id, f.name, f.firm_type, f.headquarters_country, f.aum_usd
        ORDER BY distance, total_connections DESC
        LIMIT :total_limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, {
            "firm_id": str(firm_id),
            "max_hops": max_hops,
            "min_deals": min_deals,
            "total_limit": limit_per_hop * max_hops
        })
        
        # Organize by hop distance
        network = {f"hop_{i}": [] for i in range(1, max_hops + 1)}
        
        for row in result:
            hop_key = f"hop_{row[5]}"
            if hop_key in network and len(network[hop_key]) < limit_per_hop:
                network[hop_key].append({
                    "firm_id": str(row[0]),
                    "firm_name": row[1],
                    "firm_type": row[2],
                    "headquarters_country": row[3],
                    "aum_usd": float(row[4]) if row[4] else None,
                    "distance": row[5],
                    "total_connections": row[6],
                    "total_connection_value": float(row[7]) if row[7] else None,
                })
        
        # Add counts
        summary = {
            "firm_id": str(firm_id),
            "max_hops": max_hops,
            "counts": {k: len(v) for k, v in network.items()},
            "total_firms": sum(len(v) for v in network.values())
        }
        
        return {"summary": summary, "network": network}
    finally:
        if close_session:
            session.close()


def get_co_investment_drilldown(
    firm_a_id: UUID,
    firm_b_id: UUID,
    limit: int = 50,
    session: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Get the specific deals where two firms co-invested.
    Use this for drilldown after finding co-investment edges.
    
    Args:
        firm_a_id: First firm UUID
        firm_b_id: Second firm UUID
        limit: Maximum deals to return
        
    Returns:
        List of deal dictionaries
    """
    sql = text("""
        SELECT DISTINCT
            d.id,
            d.deal_type,
            d.deal_date,
            d.deal_value_usd,
            d.stage,
            d.primary_industry,
            c.name as target_company_name,
            d.country
        FROM preqin.preqin_deals d
        JOIN preqin.preqin_deal_investor_firm a ON a.deal_id = d.id
        JOIN preqin.preqin_deal_investor_firm b ON b.deal_id = d.id
        LEFT JOIN preqin.preqin_deal_target_company dtc ON dtc.deal_id = d.id
        LEFT JOIN preqin.preqin_companies c ON c.id = dtc.company_id
        WHERE a.investor_firm_id = :firm_a_id 
          AND b.investor_firm_id = :firm_b_id
        ORDER BY d.deal_date DESC NULLS LAST
        LIMIT :limit
    """)
    
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        result = session.execute(sql, {
            "firm_a_id": str(firm_a_id),
            "firm_b_id": str(firm_b_id),
            "limit": limit
        })
        
        deals = []
        for row in result:
            deals.append({
                "deal_id": str(row[0]),
                "deal_type": row[1],
                "deal_date": row[2].isoformat() if row[2] else None,
                "deal_value_usd": float(row[3]) if row[3] else None,
                "stage": row[4],
                "primary_industry": row[5],
                "target_company_name": row[6],
                "country": row[7],
            })
        
        return deals
    finally:
        if close_session:
            session.close()


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Generate co-investment edge table")
    parser.add_argument("--regenerate", action="store_true",
                       help="Regenerate the edge table from scratch")
    parser.add_argument("--max-investors", type=int, default=MAX_INVESTORS_PER_DEAL,
                       help=f"Max investors per deal threshold (default: {MAX_INVESTORS_PER_DEAL})")

    args = parser.parse_args()

    result = generate_co_investment_edges(max_investors_per_deal=args.max_investors)
    print(json.dumps(result, indent=2))
