"""
FastAPI routes for Enrichment API.
"""

import asyncio
import json
import re
import logging
from typing import Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from clean_data.database import get_clean_data_db
from clean_data.models import ExportSession, TABLE_REGISTRY
from enrichment.models import EnrichmentJob, EnrichmentResult
from enrichment.schemas import (
    EnrichmentJobCreate,
    EnrichmentJobResponse,
    EnrichmentProgressEvent,
    PROCESSOR_INFO,
)
from enrichment.parallel_client import (
    ParallelClient,
    build_enrichment_prompt,
    build_enrichment_prompt_with_citations,
    parse_enrichment_result,
    ParallelAPIError
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])


def _generate_column_key(name: str, existing_keys: List[str]) -> str:
    """Generate a unique snake_case key from a column name."""
    key = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower()).strip('_')
    if key not in existing_keys:
        return key
    counter = 2
    while f"{key}_{counter}" in existing_keys:
        counter += 1
    return f"{key}_{counter}"


@router.get("/processors")
def get_processor_info():
    """Get information about available processor tiers."""
    return [p.model_dump() for p in PROCESSOR_INFO]


@router.post("/jobs", response_model=EnrichmentJobResponse)
async def create_enrichment_job(
    job_request: EnrichmentJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_clean_data_db)
) -> EnrichmentJobResponse:
    """
    Create a new enrichment job.

    This will:
    1. Create an enriched column in the export session
    2. Start background processing to enrich all rows
    3. Return the job ID for progress tracking
    """
    # Validate export session exists
    try:
        export_session = db.query(ExportSession).filter(
            ExportSession.id == job_request.export_id
        ).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    if not export_session:
        raise HTTPException(status_code=404, detail="Export session not found")

    # Generate unique column key
    existing_keys = [col.get("key", "") for col in (export_session.custom_columns or [])]
    column_key = _generate_column_key(job_request.column_name, existing_keys)

    # Create the enrichment job
    job = EnrichmentJob(
        export_id=export_session.id,
        column_key=column_key,
        column_name=job_request.column_name,
        prompt=job_request.prompt,
        processor=job_request.processor,
        status="pending",
        total_rows=export_session.row_count or 0,
    )

    db.add(job)

    # Add the enriched column to the export session
    new_column = {
        "key": column_key,
        "name": job_request.column_name,
        "type": "enriched",
        "source": "parallel",
        "enrichment_prompt": job_request.prompt,
        "created_at": datetime.utcnow().isoformat(),
        "job_id": str(job.id),
    }

    updated_columns = list(export_session.custom_columns or [])
    updated_columns.append(new_column)
    export_session.custom_columns = updated_columns

    db.commit()
    db.refresh(job)

    # Start background enrichment task
    background_tasks.add_task(
        run_enrichment_job,
        job_id=str(job.id),
        export_id=str(export_session.id),
        source_dataset=export_session.source_dataset,
        source_sheet=export_session.source_sheet,
        column_key=column_key,
        prompt=job_request.prompt,
        processor=job_request.processor,
        filters=export_session.filters,
        search_query=export_session.search_query,
        export_page=export_session.export_page,
        export_page_size=export_session.export_page_size,
    )

    return EnrichmentJobResponse(**job.to_dict())


@router.get("/jobs/{job_id}", response_model=EnrichmentJobResponse)
def get_enrichment_job(
    job_id: str,
    db: Session = Depends(get_clean_data_db)
) -> EnrichmentJobResponse:
    """Get the status of an enrichment job."""
    try:
        job = db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not job:
        raise HTTPException(status_code=404, detail="Enrichment job not found")

    return EnrichmentJobResponse(**job.to_dict())


@router.get("/jobs/{job_id}/stream")
async def stream_enrichment_progress(
    job_id: str,
    db: Session = Depends(get_clean_data_db)
):
    """
    Stream enrichment progress via Server-Sent Events (SSE).

    Yields progress updates as the job runs.
    """
    try:
        job = db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not job:
        raise HTTPException(status_code=404, detail="Enrichment job not found")

    async def event_generator():
        """Generate SSE events for job progress."""
        last_completed = -1

        while True:
            # Refresh job from database
            db.refresh(job)

            # Send progress update if changed
            if job.completed_rows != last_completed or job.status in ["completed", "failed"]:
                last_completed = job.completed_rows

                event = EnrichmentProgressEvent(
                    job_id=str(job.id),
                    status=job.status,
                    completed_rows=job.completed_rows,
                    total_rows=job.total_rows,
                    progress_percent=round(
                        job.completed_rows / job.total_rows * 100, 1
                    ) if job.total_rows > 0 else 0,
                    error=job.error_message,
                )

                yield f"data: {event.model_dump_json()}\n\n"

            # Check if job is complete
            if job.status in ["completed", "failed", "cancelled"]:
                break

            # Wait before next update
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.delete("/jobs/{job_id}")
def cancel_enrichment_job(
    job_id: str,
    db: Session = Depends(get_clean_data_db)
) -> Dict[str, str]:
    """Cancel a running enrichment job."""
    try:
        job = db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).first()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not job:
        raise HTTPException(status_code=404, detail="Enrichment job not found")

    if job.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Job already {job.status}")

    job.status = "cancelled"
    job.completed_at = datetime.utcnow()
    db.commit()

    return {"message": "Job cancelled successfully"}


@router.get("/exports/{export_id}/jobs")
def list_export_enrichment_jobs(
    export_id: str,
    db: Session = Depends(get_clean_data_db)
) -> List[EnrichmentJobResponse]:
    """List all enrichment jobs for an export session."""
    try:
        jobs = db.query(EnrichmentJob).filter(
            EnrichmentJob.export_id == export_id
        ).order_by(EnrichmentJob.created_at.desc()).all()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid export ID format")

    return [EnrichmentJobResponse(**job.to_dict()) for job in jobs]


# =============================================================================
# Background Task: Run Enrichment Job
# =============================================================================

async def run_enrichment_job(
    job_id: str,
    export_id: str,
    source_dataset: str,
    source_sheet: str,
    column_key: str,
    prompt: str,
    processor: str,
    filters: dict = None,
    search_query: str = None,
    export_page: int = None,
    export_page_size: int = None,
):
    """
    Background task to run an enrichment job.

    This fetches rows from the source data, sends them to Parallel API,
    and stores the results.
    """
    from clean_data.database import SessionLocal

    db = SessionLocal()

    try:
        # Get the job
        job = db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).first()
        if not job:
            logger.error(f"Enrichment job {job_id} not found")
            return

        # Update status to running
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()

        # Fetch rows to enrich
        model = TABLE_REGISTRY.get(source_dataset, {}).get(source_sheet)
        if not model:
            job.status = "failed"
            job.error_message = f"Invalid source: {source_dataset}/{source_sheet}"
            job.completed_at = datetime.utcnow()
            db.commit()
            return

        # Build query
        query = db.query(model)

        # Apply search filter
        if search_query:
            search_term = f"%{search_query}%"
            query = query.filter(text("data::text ILIKE :search_term").bindparams(search_term=search_term))

        # Apply filters
        if filters:
            for key, value in filters.items():
                if value:
                    query = query.filter(text(f"data->>'{key}' = :value_{key}").bindparams(**{f"value_{key}": str(value)}))

        # Apply page bounds if this is a page-bounded export
        if export_page and export_page_size:
            base_offset = (export_page - 1) * export_page_size
            query = query.order_by(model.row_number).offset(base_offset).limit(export_page_size)
        else:
            query = query.order_by(model.row_number)

        rows = query.all()
        job.total_rows = len(rows)
        db.commit()

        if not rows:
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            db.commit()
            return

        # Initialize Parallel client
        client = ParallelClient()

        # Build enrichment prompt with citations support
        full_prompt = build_enrichment_prompt_with_citations(prompt)

        # Process rows (for now, do sequentially - can optimize with batch later)
        for i, row in enumerate(rows):
            if job.status == "cancelled":
                break

            row_id = str(row.id)
            row_data = row.data or {}

            try:
                # Create task and wait for result
                result = await client.create_task_run(
                    input_data=row_data,
                    prompt=full_prompt,
                    processor=processor,
                    wait_for_result=True,
                )

                if result.status == "completed" and result.result:
                    # Parse the result to extract answer and citations
                    parsed = parse_enrichment_result(result.result)

                    # Store the result with citations
                    enrichment_result = EnrichmentResult(
                        job_id=job.id,
                        export_id=export_id,
                        row_id=row_id,
                        column_key=column_key,
                        value=str(parsed["answer"]) if parsed["answer"] else None,
                        citations=parsed["citations"],  # Store citations
                        confidence=parsed["confidence"],  # Store confidence
                        status="completed",
                        run_id=result.run_id,
                        completed_at=datetime.utcnow(),
                    )
                    db.add(enrichment_result)

                    job.completed_rows += 1
                else:
                    # Task failed
                    enrichment_result = EnrichmentResult(
                        job_id=job.id,
                        export_id=export_id,
                        row_id=row_id,
                        column_key=column_key,
                        status="failed",
                        error=result.error,
                        run_id=result.run_id,
                    )
                    db.add(enrichment_result)
                    job.failed_rows += 1

                db.commit()

            except ParallelAPIError as e:
                logger.error(f"Parallel API error for row {row_id}: {e}")
                job.failed_rows += 1
                db.commit()

            except Exception as e:
                logger.error(f"Error enriching row {row_id}: {e}")
                job.failed_rows += 1
                db.commit()

        # Mark job as complete
        job.status = "completed" if job.failed_rows == 0 else "completed"
        job.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Enrichment job {job_id} completed: {job.completed_rows}/{job.total_rows} rows")

    except Exception as e:
        logger.error(f"Enrichment job {job_id} failed: {e}")
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()

    finally:
        db.close()
