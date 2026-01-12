"""
Gold Entity Extraction for Preqin Data Layer

Extracts canonical entities from Silver layer into Gold tables.
Creates relationships between entities and prepares data for entity resolution.

Usage:
    python -m preqin.pipelines.gold_extraction [--run-id RUN_ID]
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import engine, SessionLocal

logger = logging.getLogger(__name__)


# =============================================================================
# Quarantine Functions
# =============================================================================

def quarantine_unresolved_investors(
    session: Session,
    run_id: Optional[str] = None
) -> int:
    """
    Quarantine deal investor references that couldn't be resolved to firms.

    Instead of leaving null foreign keys, move unresolved records to quarantine
    table for later manual resolution or automated reprocessing.
    """
    logger.info("Quarantining unresolved investor references")

    sql = text("""
        INSERT INTO preqin.preqin_quarantine (
            id, source_table, source_record_id, error_type, error_details,
            raw_data, run_id, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'deal_investor_firm',
            dif.id::TEXT,
            'unresolved_investor_firm',
            'Could not resolve investor name to existing firm: ' || dif.investor_firm_name_raw,
            jsonb_build_object(
                'deal_id', dif.deal_id,
                'investor_name_raw', dif.investor_firm_name_raw,
                'investor_type', dif.investor_type,
                'role_in_deal', dif.role_in_deal,
                'source_file', dif.source_file
            ),
            :run_id,
            NOW(),
            NOW()
        FROM preqin.preqin_deal_investor_firm dif
        WHERE dif.investor_firm_id IS NULL
          AND (dif.resolution_method IS NULL OR dif.resolution_method = 'unresolved')
        ON CONFLICT DO NOTHING
    """)

    try:
        result = session.execute(sql, {"run_id": run_id})
        count = result.rowcount
        session.commit()
        logger.info(f"Quarantined {count} unresolved investor references")
        return count
    except Exception as e:
        logger.error(f"Error quarantining investors: {e}")
        session.rollback()
        return 0


def quarantine_unresolved_fund_managers(
    session: Session,
    run_id: Optional[str] = None
) -> int:
    """
    Quarantine fund records with unresolved manager firm references.
    """
    logger.info("Quarantining funds with unresolved manager references")

    sql = text("""
        INSERT INTO preqin.preqin_quarantine (
            id, source_table, source_record_id, error_type, error_details,
            raw_data, run_id, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'fund_manager_link',
            fu.id::TEXT,
            'unresolved_manager_firm',
            'Could not resolve manager firm for fund: ' || fu.name,
            jsonb_build_object(
                'fund_id', fu.id,
                'fund_name', fu.name,
                'fund_source_id', fu.source_id,
                'manager_firm_name_searched', sf.manager_firm_name
            ),
            :run_id,
            NOW(),
            NOW()
        FROM preqin.preqin_funds fu
        JOIN preqin_silver.funds sf ON sf.source_fund_id = fu.source_id
        WHERE fu.managing_firm_id IS NULL
          AND sf.manager_firm_name IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM preqin.preqin_firm_manages_fund fmf
              WHERE fmf.fund_id = fu.id
          )
        ON CONFLICT DO NOTHING
    """)

    try:
        result = session.execute(sql, {"run_id": run_id})
        count = result.rowcount
        session.commit()
        logger.info(f"Quarantined {count} funds with unresolved manager references")
        return count
    except Exception as e:
        logger.error(f"Error quarantining fund managers: {e}")
        session.rollback()
        return 0


def quarantine_unresolved_person_employments(
    session: Session,
    run_id: Optional[str] = None
) -> int:
    """
    Quarantine person records with unresolved firm references.
    """
    logger.info("Quarantining persons with unresolved firm references")

    sql = text("""
        INSERT INTO preqin.preqin_quarantine (
            id, source_table, source_record_id, error_type, error_details,
            raw_data, run_id, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'person_employment',
            p.id::TEXT,
            'unresolved_employment_firm',
            'Could not resolve firm for person: ' || p.full_name,
            jsonb_build_object(
                'person_id', p.id,
                'person_name', p.full_name,
                'person_source_id', p.source_id,
                'firm_source_id_searched', sc.source_firm_id
            ),
            :run_id,
            NOW(),
            NOW()
        FROM preqin.preqin_persons p
        JOIN preqin_silver.contacts sc ON sc.source_contact_id = p.source_id
        WHERE sc.source_firm_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM preqin.preqin_person_employment pe
              WHERE pe.person_id = p.id
          )
        ON CONFLICT DO NOTHING
    """)

    try:
        result = session.execute(sql, {"run_id": run_id})
        count = result.rowcount
        session.commit()
        logger.info(f"Quarantined {count} persons with unresolved firm references")
        return count
    except Exception as e:
        logger.error(f"Error quarantining person employments: {e}")
        session.rollback()
        return 0


def get_quarantine_summary(session: Session) -> Dict[str, Any]:
    """
    Get summary of quarantined records by error type.
    """
    sql = text("""
        SELECT
            source_table,
            error_type,
            COUNT(*) as count,
            MIN(created_at) as oldest,
            MAX(created_at) as newest
        FROM preqin.preqin_quarantine
        WHERE resolved = FALSE
        GROUP BY source_table, error_type
        ORDER BY count DESC
    """)

    result = session.execute(sql)
    summary = []
    total = 0
    for row in result:
        summary.append({
            "source_table": row[0],
            "error_type": row[1],
            "count": row[2],
            "oldest": row[3].isoformat() if row[3] else None,
            "newest": row[4].isoformat() if row[4] else None,
        })
        total += row[2]

    return {"total_unresolved": total, "by_type": summary}


# =============================================================================
# Firm Extraction
# =============================================================================

def extract_firms(session: Session, run_id: Optional[str] = None) -> int:
    """
    Extract canonical firm records from silver layer to gold.
    Combines GP and LP firms, preserving source IDs.
    """
    logger.info("Extracting firms to gold layer")
    
    sql = text("""
        INSERT INTO preqin.preqin_firms (
            id, source_system, source_id, preqin_id,
            name, name_normalized, firm_type, institution_type,
            headquarters_city, headquarters_country, headquarters_region,
            aum_usd, aum_raw, dry_powder_usd,
            website, description, year_founded,
            source_file, source_sheet, source_row_number, run_id,
            created_at, updated_at
        )
        SELECT DISTINCT ON (COALESCE(source_firm_id, preqin_firm_id))
            gen_random_uuid(),
            'preqin',
            COALESCE(source_firm_id, preqin_firm_id),
            preqin_firm_id,
            firm_name,
            firm_name_normalized,
            CASE source_type WHEN 'gp' THEN 'GP' WHEN 'lp' THEN 'LP' ELSE firm_type END,
            institution_type,
            headquarters_city,
            headquarters_country,
            headquarters_region,
            aum_usd,
            aum_raw,
            dry_powder_usd,
            website,
            description,
            year_founded,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW(),
            NOW()
        FROM preqin_silver.firms
        WHERE firm_name IS NOT NULL
          AND COALESCE(source_firm_id, preqin_firm_id) IS NOT NULL
        ORDER BY COALESCE(source_firm_id, preqin_firm_id), source_row_number
        ON CONFLICT (source_system, source_id) DO UPDATE SET
            name = EXCLUDED.name,
            name_normalized = EXCLUDED.name_normalized,
            aum_usd = COALESCE(EXCLUDED.aum_usd, preqin.preqin_firms.aum_usd),
            dry_powder_usd = COALESCE(EXCLUDED.dry_powder_usd, preqin.preqin_firms.dry_powder_usd),
            updated_at = NOW()
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Extracted {count} firms to gold layer")
        return count
    except Exception as e:
        logger.error(f"Error extracting firms: {e}")
        session.rollback()
        return 0


def extract_funds(session: Session, run_id: Optional[str] = None) -> int:
    """
    Extract canonical fund records from silver layer to gold.
    Links to managing firm where possible.
    """
    logger.info("Extracting funds to gold layer")
    
    sql = text("""
        INSERT INTO preqin.preqin_funds (
            id, source_system, source_id, preqin_id,
            name, name_normalized, vintage_year,
            fund_size_usd, fund_size_raw, target_size_usd, currency,
            strategy, sub_strategy, status,
            geography_focus, sector_focus, domicile_country,
            irr, tvpi, dpi,
            source_file, source_sheet, source_row_number, run_id,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'preqin',
            COALESCE(source_fund_id, preqin_fund_id),
            preqin_fund_id,
            fund_name,
            fund_name_normalized,
            vintage_year,
            fund_size_usd,
            fund_size_raw,
            target_size_usd,
            currency,
            strategy,
            sub_strategy,
            status,
            geography_focus,
            sector_focus,
            domicile_country,
            irr,
            tvpi,
            dpi,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW(),
            NOW()
        FROM preqin_silver.funds
        WHERE fund_name IS NOT NULL
        ON CONFLICT (source_system, source_id) DO UPDATE SET
            name = EXCLUDED.name,
            name_normalized = EXCLUDED.name_normalized,
            fund_size_usd = COALESCE(EXCLUDED.fund_size_usd, preqin.preqin_funds.fund_size_usd),
            updated_at = NOW()
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Extracted {count} funds to gold layer")
        return count
    except Exception as e:
        logger.error(f"Error extracting funds: {e}")
        session.rollback()
        return 0


def link_funds_to_managers(session: Session) -> int:
    """
    Create firm_manages_fund relationships.
    Links funds to their managing firms based on manager_firm_id or name matching.
    """
    logger.info("Linking funds to managing firms")
    
    # First try direct ID matching
    sql_id_match = text("""
        INSERT INTO preqin.preqin_firm_manages_fund (
            id, firm_id, fund_id, role, created_at
        )
        SELECT
            gen_random_uuid(),
            f.id,
            fu.id,
            'Manager',
            NOW()
        FROM preqin.preqin_funds fu
        JOIN preqin_silver.funds sf ON sf.source_fund_id = fu.source_id
        JOIN preqin.preqin_firms f ON f.source_id = sf.manager_firm_id
        WHERE sf.manager_firm_id IS NOT NULL
        ON CONFLICT (firm_id, fund_id) DO NOTHING
    """)
    
    # Then try name matching for unlinked funds
    sql_name_match = text("""
        INSERT INTO preqin.preqin_firm_manages_fund (
            id, firm_id, fund_id, role, created_at
        )
        SELECT DISTINCT
            gen_random_uuid(),
            f.id,
            fu.id,
            'Manager',
            NOW()
        FROM preqin.preqin_funds fu
        JOIN preqin_silver.funds sf ON sf.source_fund_id = fu.source_id
        JOIN preqin.preqin_firms f ON f.name_normalized = preqin.normalize_name(sf.manager_firm_name)
        WHERE sf.manager_firm_name IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM preqin.preqin_firm_manages_fund fmf
              WHERE fmf.fund_id = fu.id
          )
        ON CONFLICT (firm_id, fund_id) DO NOTHING
    """)
    
    count = 0
    try:
        result = session.execute(sql_id_match)
        count += result.rowcount
        
        result = session.execute(sql_name_match)
        count += result.rowcount
        
        session.commit()
        logger.info(f"Created {count} firm-fund manager relationships")
        return count
    except Exception as e:
        logger.error(f"Error linking funds to managers: {e}")
        session.rollback()
        return 0


def extract_persons(session: Session, run_id: Optional[str] = None) -> int:
    """
    Extract canonical person records from silver layer to gold.
    """
    logger.info("Extracting persons to gold layer")
    
    sql = text("""
        INSERT INTO preqin.preqin_persons (
            id, source_system, source_id,
            full_name, first_name, last_name,
            email, phone, linkedin_url,
            title, seniority_level,
            location_city, location_country,
            source_file, source_sheet, source_row_number, run_id,
            created_at, updated_at
        )
        SELECT DISTINCT ON (COALESCE(source_contact_id, source_row_number::TEXT))
            gen_random_uuid(),
            'preqin',
            COALESCE(source_contact_id, source_row_number::TEXT),
            full_name,
            first_name,
            last_name,
            email,
            phone,
            linkedin_url,
            title,
            seniority_level,
            location_city,
            location_country,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW(),
            NOW()
        FROM preqin_silver.contacts
        WHERE full_name IS NOT NULL
        ORDER BY COALESCE(source_contact_id, source_row_number::TEXT), source_row_number
        ON CONFLICT (source_system, source_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            title = EXCLUDED.title,
            email = COALESCE(EXCLUDED.email, preqin.preqin_persons.email),
            updated_at = NOW()
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Extracted {count} persons to gold layer")
        return count
    except Exception as e:
        logger.error(f"Error extracting persons: {e}")
        session.rollback()
        return 0


def link_persons_to_firms(session: Session) -> int:
    """
    Create person_employment relationships.
    Links persons to their firms based on source_firm_id.
    """
    logger.info("Linking persons to firms")
    
    sql = text("""
        INSERT INTO preqin.preqin_person_employment (
            id, person_id, firm_id, title, is_current, created_at
        )
        SELECT
            gen_random_uuid(),
            p.id,
            f.id,
            sc.title,
            TRUE,
            NOW()
        FROM preqin.preqin_persons p
        JOIN preqin_silver.contacts sc ON sc.source_contact_id = p.source_id
        JOIN preqin.preqin_firms f ON f.source_id = sc.source_firm_id
        WHERE sc.source_firm_id IS NOT NULL
        ON CONFLICT (person_id, firm_id) DO NOTHING
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Created {count} person-firm employment relationships")
        return count
    except Exception as e:
        logger.error(f"Error linking persons to firms: {e}")
        session.rollback()
        return 0


def extract_companies(session: Session, run_id: Optional[str] = None) -> int:
    """
    Extract unique portfolio companies from deals.
    """
    logger.info("Extracting companies from deals")
    
    sql = text("""
        INSERT INTO preqin.preqin_companies (
            id, source_system, source_id,
            name, name_normalized,
            country, region,
            primary_industry, secondary_industry,
            created_at, updated_at
        )
        SELECT DISTINCT ON (preqin.normalize_name(target_company_name))
            gen_random_uuid(),
            'preqin',
            COALESCE(target_company_id, md5(target_company_name)),
            target_company_name,
            preqin.normalize_name(target_company_name),
            country,
            region,
            primary_industry,
            secondary_industry,
            NOW(),
            NOW()
        FROM preqin_silver.deals
        WHERE target_company_name IS NOT NULL
        ON CONFLICT (source_system, source_id) DO UPDATE SET
            name = EXCLUDED.name,
            name_normalized = EXCLUDED.name_normalized,
            updated_at = NOW()
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Extracted {count} companies to gold layer")
        return count
    except Exception as e:
        logger.error(f"Error extracting companies: {e}")
        session.rollback()
        return 0


def extract_deals(session: Session, run_id: Optional[str] = None) -> int:
    """
    Extract canonical deal records from silver layer to gold.
    """
    logger.info("Extracting deals to gold layer")
    
    sql = text("""
        INSERT INTO preqin.preqin_deals (
            id, source_system, source_id, preqin_id,
            deal_type, deal_date, deal_value_usd, deal_value_raw,
            stage, deal_status,
            country, region,
            primary_industry, secondary_industry,
            source_file, source_sheet, source_row_number, run_id,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'preqin',
            COALESCE(source_deal_id, preqin_deal_id),
            preqin_deal_id,
            deal_type,
            deal_date,
            deal_value_usd,
            deal_value_raw,
            stage,
            deal_status,
            country,
            region,
            primary_industry,
            secondary_industry,
            source_file,
            source_sheet,
            source_row_number,
            run_id,
            NOW(),
            NOW()
        FROM preqin_silver.deals
        WHERE source_deal_id IS NOT NULL
        ON CONFLICT (source_system, source_id) DO UPDATE SET
            deal_value_usd = COALESCE(EXCLUDED.deal_value_usd, preqin.preqin_deals.deal_value_usd),
            updated_at = NOW()
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Extracted {count} deals to gold layer")
        return count
    except Exception as e:
        logger.error(f"Error extracting deals: {e}")
        session.rollback()
        return 0


def link_deals_to_companies(session: Session) -> int:
    """
    Create deal_target_company relationships.
    """
    logger.info("Linking deals to target companies")
    
    sql = text("""
        INSERT INTO preqin.preqin_deal_target_company (
            id, deal_id, company_id, confidence_score, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            d.id,
            c.id,
            0.95,
            NOW(),
            NOW()
        FROM preqin.preqin_deals d
        JOIN preqin_silver.deals sd ON sd.source_deal_id = d.source_id
        JOIN preqin.preqin_companies c ON c.name_normalized = preqin.normalize_name(sd.target_company_name)
        WHERE sd.target_company_name IS NOT NULL
        ON CONFLICT (deal_id, company_id) DO NOTHING
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Created {count} deal-company relationships")
        return count
    except Exception as e:
        logger.error(f"Error linking deals to companies: {e}")
        session.rollback()
        return 0


def parse_deal_investors(session: Session) -> int:
    """
    Parse investor names from deals and create deal_investor_firm relationships.
    Handles comma-separated and semicolon-separated investor lists.
    """
    logger.info("Parsing deal investors")
    
    # This is a complex operation - parse investor names and match to firms
    # NOTE: Split on semicolons/pipes/newlines ONLY, NOT commas (to preserve "Carta, Inc." etc.)
    sql = text("""
        WITH parsed_investors AS (
            SELECT
                d.id as deal_id,
                unnest(
                    string_to_array(
                        REPLACE(REPLACE(sd.investor_names_raw, '|', ';'), E'\\n', ';'),
                        ';'
                    )
                ) as investor_name_raw
            FROM preqin.preqin_deals d
            JOIN preqin_silver.deals sd ON sd.source_deal_id = d.source_id
            WHERE sd.investor_names_raw IS NOT NULL
        ),
        cleaned_investors AS (
            SELECT
                deal_id,
                TRIM(investor_name_raw) as investor_name,
                preqin.normalize_name(TRIM(investor_name_raw)) as investor_name_normalized
            FROM parsed_investors
            WHERE TRIM(investor_name_raw) != ''
              AND LOWER(TRIM(investor_name_raw)) NOT IN (
                  'inc', 'inc.', 'llc', 'l.l.c.', 'ltd', 'ltd.', 'limited',
                  'corp', 'corp.', 'co', 'co.', 'plc', 'gmbh', 's.a.',
                  'sarl', 'bv', 'ag', 'kk', 'pte', 'pty', 'lp', 'l.p.',
                  'llp', 'pllc', 'partners', 'undisclosed', 'unknown',
                  'n/a', 'na', '-', 'the', 'a', 'an'
              )
        )
        INSERT INTO preqin.preqin_deal_investor_firm (
            id, deal_id, investor_firm_id, investor_firm_name_raw,
            confidence_score, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            ci.deal_id,
            f.id,
            ci.investor_name,
            CASE
                WHEN f.id IS NOT NULL THEN 0.90
                ELSE 0.00
            END,
            NOW(),
            NOW()
        FROM cleaned_investors ci
        LEFT JOIN preqin.preqin_firms f ON f.name_normalized = ci.investor_name_normalized
        ON CONFLICT (deal_id, investor_firm_name_raw) DO NOTHING
    """)
    
    try:
        result = session.execute(sql)
        session.commit()
        count = result.rowcount
        logger.info(f"Parsed and linked {count} deal-investor relationships")
        return count
    except Exception as e:
        logger.error(f"Error parsing deal investors: {e}")
        session.rollback()
        return 0


def run_gold_extraction(
    run_id: Optional[str] = None,
    quarantine_unresolved: bool = True
) -> Dict[str, Any]:
    """
    Run full gold entity extraction.

    Args:
        run_id: Optional run ID for tracking
        quarantine_unresolved: If True, quarantine records with unresolved references

    Returns:
        Dictionary with extraction results and quarantine summary
    """
    results = {"run_id": run_id, "extractions": {}, "quarantine": {}}

    with SessionLocal() as session:
        # Extract entities in order
        results["extractions"]["firms"] = extract_firms(session, run_id)
        results["extractions"]["funds"] = extract_funds(session, run_id)
        results["extractions"]["fund_manager_links"] = link_funds_to_managers(session)

        results["extractions"]["persons"] = extract_persons(session, run_id)
        results["extractions"]["person_employment_links"] = link_persons_to_firms(session)

        results["extractions"]["companies"] = extract_companies(session, run_id)
        results["extractions"]["deals"] = extract_deals(session, run_id)
        results["extractions"]["deal_company_links"] = link_deals_to_companies(session)
        results["extractions"]["deal_investor_links"] = parse_deal_investors(session)

        # Quarantine unresolved references (instead of leaving null FKs)
        if quarantine_unresolved:
            logger.info("Running quarantine pass for unresolved references")
            results["quarantine"]["unresolved_investors"] = quarantine_unresolved_investors(session, run_id)
            results["quarantine"]["unresolved_fund_managers"] = quarantine_unresolved_fund_managers(session, run_id)
            results["quarantine"]["unresolved_person_employments"] = quarantine_unresolved_person_employments(session, run_id)

            # Get quarantine summary
            results["quarantine"]["summary"] = get_quarantine_summary(session)

    # Summary
    total_extracted = sum(results["extractions"].values())
    total_quarantined = sum(v for k, v in results["quarantine"].items() if isinstance(v, int))

    results["summary"] = {
        "total_records_extracted": total_extracted,
        "total_records_quarantined": total_quarantined
    }

    logger.info(f"Gold extraction complete: {total_extracted} extracted, {total_quarantined} quarantined")
    return results


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    import json
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Extract gold entities from silver layer")
    parser.add_argument("--run-id", help="Filter by specific run_id")
    parser.add_argument("--no-quarantine", action="store_true",
                       help="Skip quarantine step for unresolved references")

    args = parser.parse_args()

    result = run_gold_extraction(
        run_id=args.run_id,
        quarantine_unresolved=not args.no_quarantine
    )
    print(json.dumps(result, indent=2, default=str))
