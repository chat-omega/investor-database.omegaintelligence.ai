"""
Preqin Data Pipelines

Batch processing pipelines for ingesting and transforming Preqin Excel exports.
These pipelines run on the dev instance (t3.2xlarge) and write to RDS PostgreSQL.
"""

from .excel_ingestion import (
    ingest_deals,
    ingest_gp_firms,
    ingest_lp_firms,
    ingest_funds,
    ingest_all_files,
)

from .batch_transforms import (
    run_all_transforms,
    transform_gp_firms,
    transform_lp_firms,
    transform_funds,
    transform_deals,
    transform_contacts,
    create_silver_tables,
)

from .gold_extraction import (
    run_gold_extraction,
    extract_firms,
    extract_funds,
    extract_persons,
    extract_companies,
    extract_deals,
    link_funds_to_managers,
    link_persons_to_firms,
    link_deals_to_companies,
    parse_deal_investors,
)

__all__ = [
    # Ingestion
    "ingest_deals",
    "ingest_gp_firms",
    "ingest_lp_firms",
    "ingest_funds",
    "ingest_all_files",
    # Silver Transforms
    "run_all_transforms",
    "transform_gp_firms",
    "transform_lp_firms",
    "transform_funds",
    "transform_deals",
    "transform_contacts",
    "create_silver_tables",
    # Gold Extraction
    "run_gold_extraction",
    "extract_firms",
    "extract_funds",
    "extract_persons",
    "extract_companies",
    "extract_deals",
    "link_funds_to_managers",
    "link_persons_to_firms",
    "link_deals_to_companies",
    "parse_deal_investors",
]
