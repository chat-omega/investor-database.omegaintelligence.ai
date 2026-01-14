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
    TABLE_REGISTRY, ColumnMetadata, ExportSession,
    GPFirm, GPContact, LPInvestor, LPContact, Deal, Fund, FundContact
)
from clean_data.schemas import (
    DatasetInfo, SheetInfo, SheetDataResponse, ColumnMetadataResponse,
    DatasetListResponse, DATASET_CONFIG, DEFAULT_VISIBLE_COLUMNS,
    CustomColumnCreate, CustomColumnUpdate, CustomColumnResponse, ColumnConfigResponse
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
# Column Values Endpoint (for filters)
# =============================================================================

@router.get("/datasets/{dataset_id}/sheets/{sheet_id}/columns/{column_key}/values")
def get_column_distinct_values(
    dataset_id: str,
    sheet_id: str,
    column_key: str,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_clean_data_db)
) -> List[str]:
    """
    Get distinct values for a column (for filter dropdowns).

    - **column_key**: The column key to get distinct values for
    - **limit**: Maximum number of distinct values to return (default 100, max 500)

    Returns a sorted list of unique non-null values.
    """
    # Validate dataset and sheet
    if dataset_id not in TABLE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")

    if sheet_id not in TABLE_REGISTRY[dataset_id]:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_id}' not found in dataset '{dataset_id}'")

    model = TABLE_REGISTRY[dataset_id][sheet_id]

    try:
        # Query distinct values from JSONB column
        # Use raw SQL for PostgreSQL JSONB distinct values
        # Get the full table name with schema
        table_args = getattr(model, '__table_args__', {})
        schema = table_args.get('schema', 'clean_data') if isinstance(table_args, dict) else 'clean_data'
        full_table_name = f"{schema}.{model.__tablename__}"

        result = db.execute(
            text(f"""
                SELECT DISTINCT data->>:column_key as value
                FROM {full_table_name}
                WHERE data->>:column_key IS NOT NULL
                AND data->>:column_key != ''
                ORDER BY value
                LIMIT :limit
            """),
            {"column_key": column_key, "limit": limit}
        )

        values = [row[0] for row in result if row[0]]
        return values

    except Exception as e:
        logger.warning(f"Error getting distinct values for {dataset_id}/{sheet_id}/{column_key}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get distinct values")


# =============================================================================
# Export Session Endpoints
# =============================================================================

@router.get("/exports")
def list_export_sessions(
    db: Session = Depends(get_clean_data_db)
) -> List[Dict[str, Any]]:
    """
    List all export sessions, ordered by most recent first.
    """
    sessions = db.query(ExportSession).order_by(ExportSession.created_at.desc()).all()

    return [
        {
            "id": str(session.id),
            "name": session.name,
            "source_dataset": session.source_dataset,
            "source_sheet": session.source_sheet,
            "row_count": session.row_count,
            "filters": session.filters,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        }
        for session in sessions
    ]


@router.post("/exports")
def create_export_session(
    name: str = Query(..., min_length=1, max_length=255),
    source_dataset: str = Query(...),
    source_sheet: str = Query(...),
    filters: Optional[str] = None,
    visible_columns: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_direction: Optional[str] = None,
    search_query: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1, description="Current page number to export (1-indexed)"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Rows per page to export"),
    db: Session = Depends(get_clean_data_db)
) -> Dict[str, Any]:
    """
    Create a new export session with the current view configuration.
    If page and page_size are provided, only exports that specific page's rows.
    """
    # Validate dataset and sheet
    if source_dataset not in TABLE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Dataset '{source_dataset}' not found")
    if source_sheet not in TABLE_REGISTRY[source_dataset]:
        raise HTTPException(status_code=404, detail=f"Sheet '{source_sheet}' not found")

    # Parse filters and visible_columns
    parsed_filters = None
    parsed_columns = None
    if filters:
        try:
            parsed_filters = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid filters format")
    if visible_columns:
        try:
            parsed_columns = json.loads(visible_columns)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid visible_columns format")

    # Get total row count for this configuration
    model = TABLE_REGISTRY[source_dataset][source_sheet]
    count_query = db.query(func.count(model.id))

    if search_query:
        search_term = f"%{search_query}%"
        count_query = count_query.filter(text("data::text ILIKE :search_term").bindparams(search_term=search_term))

    if parsed_filters:
        for key, value in parsed_filters.items():
            if value:
                count_query = count_query.filter(text(f"data->>'{key}' = :value_{key}").bindparams(**{f"value_{key}": str(value)}))

    total_rows = count_query.scalar() or 0

    # Calculate actual row count for export
    # If page and page_size provided, export only that page's rows
    if page and page_size:
        offset = (page - 1) * page_size
        # Row count is the minimum of page_size and remaining rows after offset
        remaining_rows = max(0, total_rows - offset)
        row_count = min(page_size, remaining_rows)
    else:
        # Export all matching rows
        row_count = total_rows
        page = None
        page_size = None

    # Create export session
    session = ExportSession(
        name=name,
        source_dataset=source_dataset,
        source_sheet=source_sheet,
        filters=parsed_filters,
        visible_columns=parsed_columns,
        sort_by=sort_by,
        sort_direction=sort_direction,
        search_query=search_query,
        export_page=page,
        export_page_size=page_size,
        row_count=row_count,
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "id": str(session.id),
        "name": session.name,
        "source_dataset": session.source_dataset,
        "source_sheet": session.source_sheet,
        "row_count": session.row_count,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/exports/{export_id}")
def get_export_session(
    export_id: str,
    db: Session = Depends(get_clean_data_db)
) -> Dict[str, Any]:
    """
    Get details of a specific export session.
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    return {
        "id": str(session.id),
        "name": session.name,
        "source_dataset": session.source_dataset,
        "source_sheet": session.source_sheet,
        "filters": session.filters,
        "visible_columns": session.visible_columns,
        "sort_by": session.sort_by,
        "sort_direction": session.sort_direction,
        "search_query": session.search_query,
        "custom_columns": session.custom_columns,
        "row_count": session.row_count,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.delete("/exports/{export_id}")
def delete_export_session(
    export_id: str,
    db: Session = Depends(get_clean_data_db)
) -> Dict[str, str]:
    """
    Delete an export session.
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    db.delete(session)
    db.commit()

    return {"message": "Export session deleted successfully"}


@router.get("/exports/{export_id}/data")
def get_export_data(
    export_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    sort_by: Optional[str] = None,
    sort_direction: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_clean_data_db)
) -> SheetDataResponse:
    """
    Get paginated data for an export session using its saved configuration.
    If the export was created with page bounds, only returns those specific rows.
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    # Determine if this is a page-bounded export
    if session.export_page and session.export_page_size:
        # Export contains only specific rows from a single page
        # Calculate the base offset from the original export
        base_offset = (session.export_page - 1) * session.export_page_size
        export_row_count = session.row_count or session.export_page_size

        # Build query directly for the bounded export
        model = TABLE_REGISTRY[session.source_dataset][session.source_sheet]
        query = db.query(model)

        # Apply filters
        if session.search_query:
            search_term = f"%{session.search_query}%"
            query = query.filter(text("data::text ILIKE :search_term").bindparams(search_term=search_term))

        if session.filters:
            for key, value in session.filters.items():
                if value:
                    query = query.filter(text(f"data->>'{key}' = :value_{key}").bindparams(**{f"value_{key}": str(value)}))

        # Apply sorting - use request params if provided, otherwise fall back to session defaults
        actual_sort_by = sort_by or session.sort_by
        actual_sort_direction = sort_direction if sort_by else (session.sort_direction or "asc")
        if actual_sort_by:
            if actual_sort_direction == "desc":
                query = query.order_by(text(f"data->>'{actual_sort_by}' DESC NULLS LAST"))
            else:
                query = query.order_by(text(f"data->>'{actual_sort_by}' ASC NULLS LAST"))
        else:
            query = query.order_by(model.row_number)

        # Apply base offset (from original export page) and limit to export's rows
        query = query.offset(base_offset).limit(export_row_count)

        # Now apply additional pagination within the exported rows
        all_export_items = query.all()

        # Paginate within the exported data
        request_offset = (page - 1) * page_size
        paginated_items = all_export_items[request_offset:request_offset + page_size]

        # Get columns for this sheet
        columns = get_sheet_columns(session.source_dataset, session.source_sheet, db)

        items = [item.data for item in paginated_items]

        return SheetDataResponse(
            items=items,
            columns=columns,
            page=page,
            page_size=page_size,
            total=export_row_count,
            pages=(export_row_count + page_size - 1) // page_size if export_row_count > 0 else 0
        )
    else:
        # Export contains all matching rows - use standard pagination
        return get_sheet_data(
            dataset_id=session.source_dataset,
            sheet_id=session.source_sheet,
            page=page,
            page_size=page_size,
            search=session.search_query,
            sort_by=sort_by or session.sort_by,
            sort_direction=sort_direction if sort_by else (session.sort_direction or "asc"),
            filters=json.dumps(session.filters) if session.filters else None,
            db=db
        )


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


# =============================================================================
# Column Management Endpoints
# =============================================================================

def _generate_column_key(name: str, existing_keys: List[str]) -> str:
    """
    Generate a unique snake_case key from a column name.
    If key already exists, append a number suffix.
    """
    import re
    # Convert to snake_case
    key = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower()).strip('_')

    if key not in existing_keys:
        return key

    # Find unique key by appending number
    counter = 2
    while f"{key}_{counter}" in existing_keys:
        counter += 1
    return f"{key}_{counter}"


@router.get("/exports/{export_id}/columns", response_model=ColumnConfigResponse)
def get_export_columns(
    export_id: str,
    db: Session = Depends(get_clean_data_db)
) -> ColumnConfigResponse:
    """
    Get column configuration for an export session.
    Returns custom columns and visibility settings.
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    # Build custom columns response
    custom_columns = []
    for col in (session.custom_columns or []):
        custom_columns.append(CustomColumnResponse(
            key=col.get("key", ""),
            name=col.get("name", ""),
            type=col.get("type", "text"),
            source=col.get("source", "user"),
            enrichment_prompt=col.get("enrichment_prompt"),
            created_at=col.get("created_at"),
        ))

    return ColumnConfigResponse(
        custom_columns=custom_columns,
        visible_columns=session.visible_columns,
        hidden_source_columns=[]  # Future: track hidden source columns
    )


@router.post("/exports/{export_id}/columns", response_model=CustomColumnResponse)
def add_custom_column(
    export_id: str,
    column: CustomColumnCreate,
    db: Session = Depends(get_clean_data_db)
) -> CustomColumnResponse:
    """
    Add a new custom column to an export session.

    - **name**: Display name for the column
    - **type**: Column type (text, number, or enriched)
    - **enrichment_prompt**: Required if type is 'enriched'
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    # Initialize custom_columns if None
    if session.custom_columns is None:
        session.custom_columns = []

    # Get existing keys
    existing_keys = [col.get("key", "") for col in session.custom_columns]

    # Generate unique key
    key = _generate_column_key(column.name, existing_keys)

    # Determine source based on type
    source = "parallel" if column.type == "enriched" else "user"

    # Create column entry
    from datetime import datetime
    new_column = {
        "key": key,
        "name": column.name,
        "type": column.type,
        "source": source,
        "created_at": datetime.utcnow().isoformat(),
    }

    if column.enrichment_prompt:
        new_column["enrichment_prompt"] = column.enrichment_prompt

    # Add to custom columns (need to create new list for SQLAlchemy to detect change)
    updated_columns = list(session.custom_columns)
    updated_columns.append(new_column)
    session.custom_columns = updated_columns

    db.commit()
    db.refresh(session)

    return CustomColumnResponse(
        key=key,
        name=column.name,
        type=column.type,
        source=source,
        enrichment_prompt=column.enrichment_prompt,
        created_at=new_column["created_at"],
    )


@router.delete("/exports/{export_id}/columns/{column_key}")
def delete_custom_column(
    export_id: str,
    column_key: str,
    db: Session = Depends(get_clean_data_db)
) -> Dict[str, str]:
    """
    Delete a custom column from an export session.
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    if not session.custom_columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_key}' not found")

    # Find and remove the column
    updated_columns = [col for col in session.custom_columns if col.get("key") != column_key]

    if len(updated_columns) == len(session.custom_columns):
        raise HTTPException(status_code=404, detail=f"Column '{column_key}' not found")

    session.custom_columns = updated_columns
    db.commit()

    return {"message": f"Column '{column_key}' deleted successfully"}


@router.patch("/exports/{export_id}/columns/{column_key}", response_model=CustomColumnResponse)
def update_custom_column(
    export_id: str,
    column_key: str,
    update: CustomColumnUpdate,
    db: Session = Depends(get_clean_data_db)
) -> CustomColumnResponse:
    """
    Update a custom column (e.g., rename it).
    """
    try:
        session = db.query(ExportSession).filter(ExportSession.id == export_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not session:
        raise HTTPException(status_code=404, detail="Export session not found")

    if not session.custom_columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_key}' not found")

    # Find and update the column
    updated_columns = []
    found_column = None

    for col in session.custom_columns:
        if col.get("key") == column_key:
            # Update the column
            if update.name:
                col["name"] = update.name
            found_column = col
        updated_columns.append(col)

    if not found_column:
        raise HTTPException(status_code=404, detail=f"Column '{column_key}' not found")

    session.custom_columns = updated_columns
    db.commit()

    return CustomColumnResponse(
        key=found_column.get("key", ""),
        name=found_column.get("name", ""),
        type=found_column.get("type", "text"),
        source=found_column.get("source", "user"),
        enrichment_prompt=found_column.get("enrichment_prompt"),
        created_at=found_column.get("created_at"),
    )
