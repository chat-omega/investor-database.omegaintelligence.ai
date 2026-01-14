"""
Pydantic schemas for Enrichment API.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class EnrichmentJobCreate(BaseModel):
    """Request schema for creating an enrichment job."""
    export_id: str = Field(..., description="Export session ID to enrich")
    column_name: str = Field(..., min_length=1, max_length=255, description="Display name for the enriched column")
    prompt: str = Field(..., min_length=10, max_length=2000, description="Question/instruction for enrichment")
    processor: Literal["lite", "base", "core", "pro", "ultra"] = Field(
        default="base",
        description="Parallel API processor tier"
    )


class EnrichmentJobResponse(BaseModel):
    """Response schema for enrichment job."""
    id: str
    export_id: str
    column_key: str
    column_name: str
    prompt: str
    processor: str
    status: str
    total_rows: int
    completed_rows: int
    failed_rows: int
    taskgroup_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress_percent: float = 0


class EnrichmentProgressEvent(BaseModel):
    """Schema for SSE progress events."""
    job_id: str
    status: str
    completed_rows: int
    total_rows: int
    progress_percent: float
    current_row_id: Optional[str] = None
    current_result: Optional[str] = None
    error: Optional[str] = None


class ProcessorInfo(BaseModel):
    """Information about a processor tier."""
    name: str
    description: str
    relative_cost: str
    recommended_for: str


PROCESSOR_INFO: List[ProcessorInfo] = [
    ProcessorInfo(
        name="lite",
        description="Fast, simple lookups",
        relative_cost="$",
        recommended_for="Basic fact lookups, simple questions"
    ),
    ProcessorInfo(
        name="base",
        description="Standard web research",
        relative_cost="$$",
        recommended_for="Most enrichment tasks (default)"
    ),
    ProcessorInfo(
        name="core",
        description="Detailed analysis",
        relative_cost="$$$",
        recommended_for="Complex questions requiring multiple sources"
    ),
    ProcessorInfo(
        name="pro",
        description="Comprehensive research",
        relative_cost="$$$$",
        recommended_for="In-depth company research"
    ),
    ProcessorInfo(
        name="ultra",
        description="Deep investigation",
        relative_cost="$$$$$",
        recommended_for="Extensive research tasks"
    ),
]
