"""
FastAPI routes for Clean Data Layer
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
import json
import logging

from clean_data.database import get_clean_data_db
from clean_data.models import (
    TABLE_REGISTRY, ColumnMetadata,
    GPFirm, GPContact, LPInvestor, LPContact, Deal, Fund, FundContact
)
from clean_data.schemas import (
    DatasetInfo, SheetInfo, SheetDataResponse, ColumnMetadataResponse,
    DatasetListResponse, DATASET_CONFIG, DEFAULT_VISIBLE_COLUMNS
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clean-data", tags=["clean-data"])


# =============================================================================
# Datasets Endpoints
# =============================================================================

@router.get("/datasets", response_model=DatasetListResponse)
def list_datasets(db: Session = Depends(get_clean_data_db)):
    """
    List all available datasets with their sheet information.
    Returns actual row counts from the database.
    """
    datasets = []

    for dataset_id, config in DATASET_CONFIG.items():
        # Get actual row counts from database
        sheets_with_counts = []
        for sheet in config.sheets:
            model = TABLE_REGISTRY.get(dataset_id, {}).get(sheet.id)
            if model:
                try:
                    count = db.query(func.count(model.id)).scalar() or 0
                except Exception:
                    count = sheet.row_count  # Fallback to config

                # Get column count from metadata
                col_count = db.query(func.count(ColumnMetadata.id)).filter(
                    ColumnMetadata.table_name == f"{dataset_id}_{sheet.id}"
                ).scalar() or sheet.column_count
            else:
                count = sheet.row_count
                col_count = sheet.column_count

            sheets_with_counts.append(SheetInfo(
                id=sheet.id,
                name=sheet.name,
                display_name=sheet.display_name,
                row_count=count,
                column_count=col_count
            ))

        datasets.append(DatasetInfo(
            id=config.id,
            name=config.name,
            description=config.description,
            icon=config.icon,
            sheets=sheets_with_counts
        ))

    return DatasetListResponse(datasets=datasets)


@router.get("/datasets/{dataset_id}", response_model=DatasetInfo)
def get_dataset(dataset_id: str, db: Session = Depends(get_clean_data_db)):
    """Get information about a specific dataset."""
    if dataset_id not in DATASET_CONFIG:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")

    config = DATASET_CONFIG[dataset_id]

    # Get actual row counts
    sheets_with_counts = []
    for sheet in config.sheets:
        model = TABLE_REGISTRY.get(dataset_id, {}).get(sheet.id)
        if model:
            try:
                count = db.query(func.count(model.id)).scalar() or 0
            except Exception:
                count = sheet.row_count
        else:
            count = sheet.row_count

        sheets_with_counts.append(SheetInfo(
            id=sheet.id,
            name=sheet.name,
            display_name=sheet.display_name,
            row_count=count,
            column_count=sheet.column_count
        ))

    return DatasetInfo(
        id=config.id,
        name=config.name,
        description=config.description,
        icon=config.icon,
        sheets=sheets_with_counts
    )


# =============================================================================
# Sheet Data Endpoints
# =============================================================================

@router.get("/datasets/{dataset_id}/sheets/{sheet_id}")
def get_sheet_data(
    dataset_id: str,
    sheet_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_direction: str = Query("asc", pattern="^(asc|desc)$"),
    filters: Optional[str] = None,
    db: Session = Depends(get_clean_data_db)
) -> SheetDataResponse:
    """
    Get paginated data from a specific sheet.

    - **page**: Page number (1-indexed)
    - **page_size**: Number of rows per page (max 100)
    - **search**: Full-text search across all columns
    - **sort_by**: Column key to sort by
    - **sort_direction**: asc or desc
    - **filters**: JSON-encoded filter object (e.g., {"country": "United States"})
    """
    # Validate dataset and sheet
    if dataset_id not in TABLE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")

    if sheet_id not in TABLE_REGISTRY[dataset_id]:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_id}' not found in dataset '{dataset_id}'")

    model = TABLE_REGISTRY[dataset_id][sheet_id]

    # Build query
    query = db.query(model)

    # Apply search filter (search in JSONB data)
    if search:
        search_term = f"%{search}%"
        # Search in the JSONB data column - PostgreSQL specific
        query = query.filter(
            text("data::text ILIKE :search_term").bindparams(search_term=search_term)
        )

    # Apply filters
    if filters:
        try:
            filter_dict = json.loads(filters)
            for key, value in filter_dict.items():
                if value:
                    # Filter on JSONB key
                    query = query.filter(
                        text(f"data->>'{key}' = :value_{key}").bindparams(**{f"value_{key}": str(value)})
                    )
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid filters format")

    # Get total count before pagination
    total = query.count()

    # Apply sorting
    if sort_by:
        # Sort by JSONB key
        if sort_direction == "desc":
            query = query.order_by(text(f"data->>'{sort_by}' DESC NULLS LAST"))
        else:
            query = query.order_by(text(f"data->>'{sort_by}' ASC NULLS LAST"))
    else:
        # Default sort by row_number
        query = query.order_by(model.row_number)

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    rows = query.all()

    # Transform rows to flat dictionaries
    items = []
    for row in rows:
        item = {"_id": str(row.id), "_row_number": row.row_number}
        if row.data:
            item.update(row.data)
        items.append(item)

    # Get column metadata
    columns = _get_columns_for_sheet(dataset_id, sheet_id, db)

    # Calculate pages
    pages = (total + page_size - 1) // page_size if total > 0 else 0

    return SheetDataResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        columns=columns
    )


@router.get("/datasets/{dataset_id}/sheets/{sheet_id}/columns")
def get_sheet_columns(
    dataset_id: str,
    sheet_id: str,
    db: Session = Depends(get_clean_data_db)
) -> List[ColumnMetadataResponse]:
    """Get column definitions for a sheet."""
    return _get_columns_for_sheet(dataset_id, sheet_id, db)


def _get_columns_for_sheet(
    dataset_id: str,
    sheet_id: str,
    db: Session
) -> List[ColumnMetadataResponse]:
    """Helper to get column metadata for a sheet."""
    table_name = f"{dataset_id}_{sheet_id}"

    # Try to get from database
    columns = db.query(ColumnMetadata).filter(
        ColumnMetadata.table_name == table_name
    ).order_by(ColumnMetadata.column_index).all()

    if columns:
        # Get default visible columns for this sheet
        default_visible = DEFAULT_VISIBLE_COLUMNS.get(dataset_id, {}).get(sheet_id)

        return [
            ColumnMetadataResponse(
                key=col.column_key,
                name=col.column_name,
                index=col.column_index,
                data_type=col.data_type or "string",
                is_visible=col.is_visible_default if default_visible is None else (col.column_key in default_visible),
                width=col.width_hint
            )
            for col in columns
        ]

    # If no metadata in database, return empty list
    # (columns will be populated during import)
    return []


# =============================================================================
# Stats Endpoint
# =============================================================================

@router.get("/stats")
def get_clean_data_stats(db: Session = Depends(get_clean_data_db)) -> Dict[str, Any]:
    """Get aggregate statistics for all clean data tables."""
    stats = {}

    for dataset_id, sheets in TABLE_REGISTRY.items():
        dataset_stats = {}
        for sheet_id, model in sheets.items():
            try:
                count = db.query(func.count(model.id)).scalar() or 0
                dataset_stats[sheet_id] = count
            except Exception as e:
                logger.warning(f"Could not get count for {dataset_id}/{sheet_id}: {e}")
                dataset_stats[sheet_id] = 0
        stats[dataset_id] = dataset_stats

    # Total counts
    total_rows = sum(
        sum(sheets.values())
        for sheets in stats.values()
    )

    return {
        "total_rows": total_rows,
        "by_dataset": stats
    }
