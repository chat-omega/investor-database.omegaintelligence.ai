"""
SQLAlchemy models for Enrichment module.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from clean_data.database import CleanDataBase


class EnrichmentJob(CleanDataBase):
    """
    Tracks AI enrichment jobs for export sessions.

    An enrichment job represents a request to enrich a specific column
    across all rows in an export session using the Parallel API.
    """
    __tablename__ = "enrichment_jobs"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    export_id = Column(UUID(as_uuid=True), ForeignKey("clean_data.export_sessions.id"), nullable=False)

    # Target column for enrichment results
    column_key = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=False)

    # User's enrichment prompt/question
    prompt = Column(Text, nullable=False)

    # Processor tier used
    processor = Column(String(50), default="base")

    # Job status: pending, running, completed, failed, cancelled
    status = Column(String(50), default="pending")

    # Progress tracking
    total_rows = Column(Integer, default=0)
    completed_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)

    # Parallel API task group ID for batch processing
    taskgroup_id = Column(String(255))

    # Error information
    error_message = Column(Text)

    # Results storage (optional, for failed rows tracking)
    results = Column(JSONB, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "export_id": str(self.export_id),
            "column_key": self.column_key,
            "column_name": self.column_name,
            "prompt": self.prompt,
            "processor": self.processor,
            "status": self.status,
            "total_rows": self.total_rows,
            "completed_rows": self.completed_rows,
            "failed_rows": self.failed_rows,
            "taskgroup_id": self.taskgroup_id,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress_percent": (
                round(self.completed_rows / self.total_rows * 100, 1)
                if self.total_rows > 0 else 0
            ),
        }


class EnrichmentResult(CleanDataBase):
    """
    Stores individual enrichment results for rows.

    This allows us to persist enriched values even if the job fails partway through,
    and supports resuming failed jobs.
    """
    __tablename__ = "enrichment_results"
    __table_args__ = {"schema": "clean_data"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("clean_data.enrichment_jobs.id"), nullable=False)
    export_id = Column(UUID(as_uuid=True), ForeignKey("clean_data.export_sessions.id"), nullable=False)

    # Row identifier (from source data)
    row_id = Column(String(255), nullable=False)

    # Column key for the enriched value
    column_key = Column(String(255), nullable=False)

    # Enriched value
    value = Column(Text)

    # Processing status for this row: pending, completed, failed
    status = Column(String(50), default="pending")

    # Error message if failed
    error = Column(Text)

    # Parallel API run ID
    run_id = Column(String(255))

    # Citations from web research (NEW)
    citations = Column(JSONB, default=list)

    # Confidence score if available (NEW)
    confidence = Column(Float)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
