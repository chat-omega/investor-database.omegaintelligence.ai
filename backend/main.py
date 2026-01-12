"""
FastAPI Backend for Investor Database Service
GP and LP database management with AI research capabilities
"""

import os
import json
import asyncio
import time
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc

from database.init_db import init_database
from database.db import get_db
from database.models import Fund, LP, LPFundCommitment, LPHolding, PortfolioCompany
from schemas.fund import (
    FundCreate,
    FundUpdate,
    FundResponse,
    FundListResponse
)
from schemas.lp import (
    LPCreate,
    LPUpdate,
    LPResponse,
    LPListResponse,
    LPSearchFilters,
    LPTypesResponse,
    LPStatistics,
    LPFundCommitmentCreate,
    LPFundCommitmentUpdate,
    LPFundCommitmentResponse
)
from schemas.portfolio_company import (
    PortfolioCompanyCreate,
    PortfolioCompanyUpdate,
    PortfolioCompanyResponse,
    PortfolioCompanyListResponse
)

# Import secondary funds router
from secondary_funds import secondary_funds_router

# Import Preqin data layer router
try:
    from preqin import preqin_router
    PREQIN_AVAILABLE = True
except ImportError:
    PREQIN_AVAILABLE = False
    preqin_router = None

# Import Clean Data layer router
try:
    from clean_data import clean_data_router
    CLEAN_DATA_AVAILABLE = True
except ImportError:
    CLEAN_DATA_AVAILABLE = False
    clean_data_router = None

# Configure logger
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Investor Database Service",
    description="GP and LP database management with AI research capabilities",
    version="1.0.0"
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3003").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include secondary funds router
app.include_router(secondary_funds_router)

# Include Preqin data layer router if available
if PREQIN_AVAILABLE and preqin_router:
    app.include_router(preqin_router)

# Include Clean Data layer router if available
if CLEAN_DATA_AVAILABLE and clean_data_router:
    app.include_router(clean_data_router)

# In-memory storage for research sessions
research_sessions: Dict[str, dict] = {}

# Pydantic models for research
class ResearchRequest(BaseModel):
    query: str
    model: Optional[str] = None
    searchProvider: Optional[str] = None

class ResearchSession(BaseModel):
    id: str
    query: str
    status: str  # pending, running, completed, failed
    createdAt: str
    updatedAt: str
    report: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[str] = None


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Starting up Investor Database Service...")
    init_database()
    logger.info("Database initialized successfully")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Investor Database Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Investor Database Service"
    }


# ============================================================================
# Research API Endpoints
# ============================================================================

@app.post("/api/research/start", response_model=ResearchSession)
async def start_research(
    request: ResearchRequest,
    background_tasks: BackgroundTasks
):
    """Start a new research session"""
    try:
        from research_agent import ResearchAgent
        research_agent = ResearchAgent()
    except ImportError:
        raise HTTPException(status_code=500, detail="Research agent not available")

    # Create new session
    session_id = str(uuid4())
    timestamp = datetime.utcnow().isoformat()

    session = {
        "id": session_id,
        "query": request.query,
        "status": "pending",
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "report": None,
        "error": None,
        "progress": None,
        "model": request.model or os.getenv("DEFAULT_MODEL", "gpt-4-turbo-preview"),
        "searchProvider": request.searchProvider or os.getenv("DEFAULT_SEARCH_PROVIDER", "tavily")
    }

    research_sessions[session_id] = session

    # Start research in background
    background_tasks.add_task(run_research, session_id, research_agent)

    return ResearchSession(**session)


async def run_research(session_id: str, research_agent):
    """Background task to run research"""
    try:
        session = research_sessions[session_id]
        session["status"] = "running"
        session["updatedAt"] = datetime.utcnow().isoformat()
        session["events"] = []

        def update_progress(message: str):
            session["progress"] = message
            session["updatedAt"] = datetime.utcnow().isoformat()

        def handle_event(event: dict):
            session["events"].append({
                **event,
                "timestamp": datetime.utcnow().isoformat()
            })
            session["updatedAt"] = datetime.utcnow().isoformat()

        report = await research_agent.research(
            query=session["query"],
            model=session["model"],
            search_provider=session["searchProvider"],
            progress_callback=update_progress,
            event_callback=handle_event
        )

        session["status"] = "completed"
        session["report"] = report
        session["progress"] = None
        session["updatedAt"] = datetime.utcnow().isoformat()

    except Exception as e:
        session["status"] = "failed"
        session["error"] = str(e)
        session["updatedAt"] = datetime.utcnow().isoformat()
        print(f"Research failed for session {session_id}: {e}")


@app.get("/api/research/stream/{session_id}")
async def stream_research(session_id: str):
    """Stream research results using Server-Sent Events"""

    if session_id not in research_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        session = research_sessions[session_id]
        last_status = None
        last_progress = None
        last_report_length = 0
        last_event_index = 0
        stream_start_time = time.time()
        max_stream_duration = 600
        last_heartbeat = time.time()

        while True:
            elapsed = time.time() - stream_start_time
            if elapsed > max_stream_duration:
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "type": "error",
                        "data": f"Research timed out after {max_stream_duration/60:.0f} minutes."
                    })
                }
                yield {"event": "message", "data": "[DONE]"}
                session["status"] = "failed"
                session["error"] = "Stream timeout"
                break

            if time.time() - last_heartbeat > 30:
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"type": "heartbeat", "time": time.time()})
                }
                last_heartbeat = time.time()

            if session["status"] != last_status:
                yield {
                    "event": "message",
                    "data": json.dumps({"type": "status", "data": session["status"]})
                }
                last_status = session["status"]

            if session.get("progress") and session["progress"] != last_progress:
                yield {
                    "event": "message",
                    "data": json.dumps({"type": "progress", "data": session["progress"]})
                }
                last_progress = session["progress"]

            if "events" in session:
                events = session["events"]
                if len(events) > last_event_index:
                    for event in events[last_event_index:]:
                        if event["type"] == "step_started":
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "step_started",
                                    "data": {
                                        "step": event["step"],
                                        "phase": event["phase"],
                                        "timestamp": event["timestamp"]
                                    }
                                })
                            }
                        elif event["type"] == "query_added":
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "query_added",
                                    "data": {
                                        "query": event["query"],
                                        "timestamp": event["timestamp"]
                                    }
                                })
                            }
                        elif event["type"] == "source_found":
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "source_found",
                                    "data": {
                                        **event["source"],
                                        "timestamp": event["timestamp"]
                                    }
                                })
                            }
                        elif event["type"] == "report_chunk":
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "chunk",
                                    "data": event["data"]
                                })
                            }
                    last_event_index = len(events)

            if session.get("report"):
                current_length = len(session["report"])
                if current_length > last_report_length:
                    chunk = session["report"][last_report_length:current_length]
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "chunk", "data": chunk})
                    }
                    last_report_length = current_length

            if session["status"] in ["completed", "failed"]:
                if session["status"] == "completed":
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "type": "complete",
                            "data": {"report": session["report"]}
                        })
                    }
                else:
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "type": "error",
                            "data": session.get("error", "Unknown error")
                        })
                    }
                yield {"event": "message", "data": "[DONE]"}
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.get("/api/research/history", response_model=List[ResearchSession])
async def get_research_history(limit: int = 50):
    """Get research history"""
    sessions = list(research_sessions.values())
    sessions.sort(key=lambda x: x["createdAt"], reverse=True)
    return [ResearchSession(**session) for session in sessions[:limit]]


@app.get("/api/research/{session_id}", response_model=ResearchSession)
async def get_research(session_id: str):
    """Get research session by ID"""
    if session_id not in research_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return ResearchSession(**research_sessions[session_id])


# ============================================================================
# Fund API Endpoints
# ============================================================================

@app.post("/api/funds", response_model=FundResponse, status_code=201)
async def create_fund(
    fund: FundCreate,
    db: Session = Depends(get_db)
):
    """Create a new fund"""
    try:
        db_fund = Fund(
            id=str(uuid4()),
            **fund.model_dump()
        )

        db.add(db_fund)
        db.commit()
        db.refresh(db_fund)

        logger.info(f"Created fund: {db_fund.id} - {db_fund.name}")
        return FundResponse.model_validate(db_fund)

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create fund: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create fund: {str(e)}")


@app.get("/api/funds/{fund_id}", response_model=FundResponse)
async def get_fund(
    fund_id: str,
    db: Session = Depends(get_db)
):
    """Get a single fund by ID"""
    try:
        fund = db.query(Fund).filter(Fund.id == fund_id).first()

        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        return FundResponse.model_validate(fund)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get fund {fund_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve fund: {str(e)}")


@app.put("/api/funds/{fund_id}", response_model=FundResponse)
async def update_fund(
    fund_id: str,
    fund_update: FundUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing fund"""
    try:
        db_fund = db.query(Fund).filter(Fund.id == fund_id).first()

        if not db_fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        update_data = fund_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_fund, field, value)

        db.commit()
        db.refresh(db_fund)

        logger.info(f"Updated fund: {fund_id} - {db_fund.name}")
        return FundResponse.model_validate(db_fund)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update fund {fund_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update fund: {str(e)}")


@app.delete("/api/funds/{fund_id}", status_code=204)
async def delete_fund(
    fund_id: str,
    db: Session = Depends(get_db)
):
    """Delete a fund"""
    try:
        db_fund = db.query(Fund).filter(Fund.id == fund_id).first()

        if not db_fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        db.delete(db_fund)
        db.commit()

        logger.info(f"Deleted fund: {fund_id}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete fund {fund_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete fund: {str(e)}")


@app.get("/api/funds", response_model=FundListResponse)
async def list_funds(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search in fund name and description"),
    strategy: Optional[str] = Query(None, description="Filter by investment strategy"),
    min_aum: Optional[float] = Query(None, description="Minimum AUM"),
    max_aum: Optional[float] = Query(None, description="Maximum AUM"),
    headquarters: Optional[str] = Query(None, description="Filter by headquarters location"),
    min_founded_year: Optional[int] = Query(None, description="Minimum founding year"),
    max_founded_year: Optional[int] = Query(None, description="Maximum founding year"),
    sort_by: str = Query("name", description="Field to sort by"),
    order: str = Query("asc", description="Sort order (asc or desc)"),
    limit: int = Query(50, ge=1, le=500, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip")
):
    """List and search funds with advanced filtering"""
    try:
        query = db.query(Fund)

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Fund.name.ilike(search_filter),
                    Fund.description.ilike(search_filter)
                )
            )

        if strategy:
            query = query.filter(Fund.strategy == strategy)

        if headquarters:
            headquarters_filter = f"%{headquarters}%"
            query = query.filter(Fund.headquarters.ilike(headquarters_filter))

        if min_aum is not None:
            query = query.filter(Fund.aum >= min_aum)

        if max_aum is not None:
            query = query.filter(Fund.aum <= max_aum)

        if min_founded_year is not None:
            query = query.filter(Fund.founded_year >= min_founded_year)

        if max_founded_year is not None:
            query = query.filter(Fund.founded_year <= max_founded_year)

        total = query.count()

        sort_order = desc if order.lower() == "desc" else asc

        if sort_by == "name":
            query = query.order_by(sort_order(Fund.name))
        elif sort_by == "aum":
            query = query.order_by(sort_order(Fund.aum))
        elif sort_by == "founded_year":
            query = query.order_by(sort_order(Fund.founded_year))
        elif sort_by == "created_at":
            query = query.order_by(sort_order(Fund.created_at))
        else:
            query = query.order_by(asc(Fund.name))

        query = query.limit(limit).offset(offset)
        funds = query.all()

        page_size = limit
        current_page = (offset // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return FundListResponse(
            funds=[FundResponse.model_validate(f) for f in funds],
            total=total,
            page=current_page,
            page_size=page_size,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Failed to list funds: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list funds: {str(e)}")


@app.get("/api/funds/meta/strategies")
async def get_strategies(db: Session = Depends(get_db)):
    """Get all unique investment strategies"""
    try:
        strategies = db.query(Fund.strategy)\
            .filter(Fund.strategy.isnot(None))\
            .distinct()\
            .order_by(Fund.strategy)\
            .all()

        strategies_list = [strat[0] for strat in strategies]

        return {"strategies": strategies_list}

    except Exception as e:
        logger.error(f"Failed to get strategies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve strategies: {str(e)}")


@app.get("/api/funds/meta/stats")
async def get_fund_statistics(db: Session = Depends(get_db)):
    """Get fund database statistics"""
    try:
        total_funds = db.query(func.count(Fund.id)).scalar()
        funds_with_aum = db.query(func.count(Fund.id)).filter(Fund.aum.isnot(None)).scalar()
        avg_aum = db.query(func.avg(Fund.aum)).filter(Fund.aum.isnot(None)).scalar() or 0.0
        avg_founded_year = db.query(func.avg(Fund.founded_year)).filter(Fund.founded_year.isnot(None)).scalar() or 0

        strategy_breakdown = db.query(
            Fund.strategy,
            func.count(Fund.id).label('count')
        ).filter(Fund.strategy.isnot(None))\
            .group_by(Fund.strategy)\
            .order_by(desc('count'))\
            .all()

        strategy_list = [{"strategy": strat[0], "count": strat[1]} for strat in strategy_breakdown]

        return {
            "total_funds": total_funds,
            "funds_with_aum": funds_with_aum,
            "avg_aum": float(avg_aum),
            "avg_founded_year": int(avg_founded_year) if avg_founded_year else None,
            "strategy_breakdown": strategy_list
        }

    except Exception as e:
        logger.error(f"Failed to get fund statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve fund statistics: {str(e)}")


# ============================================================================
# LP (Limited Partner) API Endpoints
# ============================================================================

@app.get("/api/lps", response_model=LPListResponse)
async def list_lps(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search in LP name and description"),
    type: Optional[str] = Query(None, description="Filter by LP type"),
    location: Optional[str] = Query(None, description="Filter by location"),
    relationship_status: Optional[str] = Query(None, description="Filter by relationship status"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    min_commitment: Optional[float] = Query(None, description="Minimum committed capital"),
    max_commitment: Optional[float] = Query(None, description="Maximum committed capital"),
    min_investment_year: Optional[int] = Query(None, description="Minimum first investment year"),
    max_investment_year: Optional[int] = Query(None, description="Maximum first investment year"),
    sort_by: str = Query("name", description="Field to sort by"),
    order: str = Query("asc", description="Sort order (asc or desc)"),
    limit: int = Query(50, ge=1, le=500, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip")
):
    """List and search LPs with advanced filtering"""
    try:
        query = db.query(LP)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    LP.name.ilike(search_pattern),
                    LP.description.ilike(search_pattern)
                )
            )

        if type:
            query = query.filter(LP.type == type)

        if location:
            location_pattern = f"%{location}%"
            query = query.filter(LP.location.ilike(location_pattern))

        if relationship_status:
            query = query.filter(LP.relationship_status == relationship_status)

        if tier:
            query = query.filter(LP.tier == tier)

        if min_commitment is not None:
            query = query.filter(LP.total_committed_capital >= min_commitment)
        if max_commitment is not None:
            query = query.filter(LP.total_committed_capital <= max_commitment)

        if min_investment_year is not None:
            query = query.filter(LP.first_investment_year >= min_investment_year)
        if max_investment_year is not None:
            query = query.filter(LP.first_investment_year <= max_investment_year)

        total = query.count()

        sort_func = desc if order == "desc" else asc
        sort_field_map = {
            "name": LP.name,
            "total_committed_capital": LP.total_committed_capital,
            "first_investment_year": LP.first_investment_year,
            "created_at": LP.created_at
        }
        sort_field = sort_field_map.get(sort_by, LP.name)
        query = query.order_by(sort_func(sort_field))

        query = query.limit(limit).offset(offset)
        lps = query.all()

        page = (offset // limit) + 1
        total_pages = (total + limit - 1) // limit

        return LPListResponse(
            lps=[LPResponse.model_validate(lp) for lp in lps],
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Failed to list LPs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve LPs: {str(e)}")


@app.get("/api/lps/{lp_id}", response_model=LPResponse)
async def get_lp(
    lp_id: str,
    db: Session = Depends(get_db)
):
    """Get a single LP by ID"""
    try:
        lp = db.query(LP).filter(LP.id == lp_id).first()

        if not lp:
            raise HTTPException(status_code=404, detail="LP not found")

        return LPResponse.model_validate(lp)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get LP {lp_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve LP: {str(e)}")


@app.post("/api/lps", response_model=LPResponse, status_code=201)
async def create_lp(
    lp: LPCreate,
    db: Session = Depends(get_db)
):
    """Create a new LP"""
    try:
        existing = db.query(LP).filter(LP.name == lp.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="LP with this name already exists")

        lp_id = str(uuid4())
        new_lp = LP(id=lp_id, **lp.model_dump())

        db.add(new_lp)
        db.commit()
        db.refresh(new_lp)

        logger.info(f"Created new LP: {lp_id} - {new_lp.name}")
        return LPResponse.model_validate(new_lp)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create LP: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create LP: {str(e)}")


@app.put("/api/lps/{lp_id}", response_model=LPResponse)
async def update_lp(
    lp_id: str,
    lp_update: LPUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing LP"""
    try:
        lp = db.query(LP).filter(LP.id == lp_id).first()

        if not lp:
            raise HTTPException(status_code=404, detail="LP not found")

        if lp_update.name and lp_update.name != lp.name:
            existing = db.query(LP).filter(LP.name == lp_update.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="LP with this name already exists")

        update_data = lp_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(lp, field, value)

        db.commit()
        db.refresh(lp)

        logger.info(f"Updated LP: {lp_id}")
        return LPResponse.model_validate(lp)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update LP {lp_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update LP: {str(e)}")


@app.delete("/api/lps/{lp_id}")
async def delete_lp(
    lp_id: str,
    db: Session = Depends(get_db)
):
    """Delete an LP"""
    try:
        lp = db.query(LP).filter(LP.id == lp_id).first()

        if not lp:
            raise HTTPException(status_code=404, detail="LP not found")

        lp_name = lp.name
        db.delete(lp)
        db.commit()

        logger.info(f"Deleted LP: {lp_id} - {lp_name}")
        return {"success": True, "message": f"LP '{lp_name}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete LP {lp_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete LP: {str(e)}")


@app.get("/api/lps/meta/types")
async def get_lp_types(db: Session = Depends(get_db)):
    """Get all unique LP types"""
    try:
        types = db.query(LP.type)\
            .filter(LP.type.isnot(None))\
            .distinct()\
            .order_by(LP.type)\
            .all()

        types_list = [t[0] for t in types]

        standard_types = ["Individual", "Family Office", "Institution", "Corporate", "Foundation", "Government", "Other"]
        for st in standard_types:
            if st not in types_list:
                types_list.append(st)

        types_list.sort()

        return {"types": types_list}

    except Exception as e:
        logger.error(f"Failed to get LP types: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve LP types: {str(e)}")


@app.get("/api/lps/meta/stats")
async def get_lp_statistics(db: Session = Depends(get_db)):
    """Get LP database statistics"""
    try:
        total_lps = db.query(func.count(LP.id)).scalar()
        total_capital = db.query(func.sum(LP.total_committed_capital))\
            .filter(LP.total_committed_capital.isnot(None)).scalar() or 0.0
        avg_commitment = db.query(func.avg(LP.total_committed_capital))\
            .filter(LP.total_committed_capital.isnot(None)).scalar() or 0.0

        type_breakdown = db.query(
            LP.type,
            func.count(LP.id).label('count')
        ).filter(LP.type.isnot(None))\
            .group_by(LP.type)\
            .order_by(desc('count'))\
            .all()

        tier_breakdown = db.query(
            LP.tier,
            func.count(LP.id).label('count')
        ).filter(LP.tier.isnot(None))\
            .group_by(LP.tier)\
            .order_by(LP.tier)\
            .all()

        status_breakdown = db.query(
            LP.relationship_status,
            func.count(LP.id).label('count')
        ).filter(LP.relationship_status.isnot(None))\
            .group_by(LP.relationship_status)\
            .order_by(desc('count'))\
            .all()

        return {
            "total_lps": total_lps,
            "total_committed_capital": total_capital,
            "avg_commitment": avg_commitment,
            "type_breakdown": [{"type": t[0], "count": t[1]} for t in type_breakdown],
            "tier_breakdown": [{"tier": t[0], "count": t[1]} for t in tier_breakdown],
            "status_breakdown": [{"status": s[0], "count": s[1]} for s in status_breakdown]
        }

    except Exception as e:
        logger.error(f"Failed to get LP statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve LP statistics: {str(e)}")


# ============================================================================
# LP Fund Commitment API Endpoints
# ============================================================================

@app.get("/api/lps/{lp_id}/commitments", response_model=List[Dict])
async def list_lp_commitments(
    lp_id: str,
    db: Session = Depends(get_db)
):
    """List all fund commitments for a specific LP"""
    try:
        lp = db.query(LP).filter(LP.id == lp_id).first()
        if not lp:
            raise HTTPException(status_code=404, detail="LP not found")

        commitments = db.query(
            LPFundCommitment,
            Fund.name.label("fund_name"),
            Fund.strategy.label("fund_strategy")
        ).join(
            Fund, LPFundCommitment.fund_id == Fund.id
        ).filter(
            LPFundCommitment.lp_id == lp_id
        ).order_by(
            desc(LPFundCommitment.commitment_date)
        ).all()

        result = []
        for commitment, fund_name, fund_strategy in commitments:
            capital_called_percentage = None
            if commitment.commitment_amount and commitment.capital_called:
                capital_called_percentage = (commitment.capital_called / commitment.commitment_amount) * 100

            result.append({
                "id": commitment.id,
                "lp_id": commitment.lp_id,
                "fund_id": commitment.fund_id,
                "fund_name": fund_name,
                "fund_strategy": fund_strategy,
                "commitment_amount_raw": commitment.commitment_amount_raw,
                "commitment_amount": commitment.commitment_amount,
                "commitment_date": commitment.commitment_date,
                "capital_called_raw": commitment.capital_called_raw,
                "capital_called": commitment.capital_called,
                "capital_called_percentage": capital_called_percentage,
                "notes": commitment.notes,
                "created_at": commitment.created_at,
                "updated_at": commitment.updated_at
            })

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list commitments for LP {lp_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve commitments: {str(e)}")


@app.post("/api/lps/{lp_id}/commitments", response_model=LPFundCommitmentResponse, status_code=201)
async def create_lp_commitment(
    lp_id: str,
    commitment: LPFundCommitmentCreate,
    db: Session = Depends(get_db)
):
    """Create a new fund commitment for an LP"""
    try:
        lp = db.query(LP).filter(LP.id == lp_id).first()
        if not lp:
            raise HTTPException(status_code=404, detail="LP not found")

        fund = db.query(Fund).filter(Fund.id == commitment.fund_id).first()
        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        if commitment.lp_id != lp_id:
            raise HTTPException(status_code=400, detail="LP ID in body must match URL parameter")

        existing = db.query(LPFundCommitment).filter(
            LPFundCommitment.lp_id == lp_id,
            LPFundCommitment.fund_id == commitment.fund_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Commitment already exists for this LP and fund")

        commitment_id = str(uuid4())
        new_commitment = LPFundCommitment(id=commitment_id, **commitment.model_dump())

        db.add(new_commitment)
        db.commit()
        db.refresh(new_commitment)

        logger.info(f"Created commitment {commitment_id} for LP {lp_id}")
        return LPFundCommitmentResponse.model_validate(new_commitment)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create commitment for LP {lp_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create commitment: {str(e)}")


@app.put("/api/lps/{lp_id}/commitments/{commitment_id}", response_model=LPFundCommitmentResponse)
async def update_lp_commitment(
    lp_id: str,
    commitment_id: str,
    commitment_update: LPFundCommitmentUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing fund commitment"""
    try:
        commitment = db.query(LPFundCommitment).filter(
            LPFundCommitment.id == commitment_id,
            LPFundCommitment.lp_id == lp_id
        ).first()

        if not commitment:
            raise HTTPException(status_code=404, detail="Commitment not found for this LP")

        update_data = commitment_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(commitment, field, value)

        db.commit()
        db.refresh(commitment)

        logger.info(f"Updated commitment {commitment_id} for LP {lp_id}")
        return LPFundCommitmentResponse.model_validate(commitment)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update commitment {commitment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update commitment: {str(e)}")


@app.delete("/api/lps/{lp_id}/commitments/{commitment_id}", status_code=204)
async def delete_lp_commitment(
    lp_id: str,
    commitment_id: str,
    db: Session = Depends(get_db)
):
    """Delete a fund commitment"""
    try:
        commitment = db.query(LPFundCommitment).filter(
            LPFundCommitment.id == commitment_id,
            LPFundCommitment.lp_id == lp_id
        ).first()

        if not commitment:
            raise HTTPException(status_code=404, detail="Commitment not found for this LP")

        db.delete(commitment)
        db.commit()

        logger.info(f"Deleted commitment {commitment_id} for LP {lp_id}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete commitment {commitment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete commitment: {str(e)}")


# ============================================================================
# LP Holdings API Endpoints
# ============================================================================

@app.get("/api/holdings")
async def get_holdings(
    lp_id: Optional[str] = None,
    vintage: Optional[int] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    search: Optional[str] = None,
    sort_by: str = "vintage",
    sort_order: str = "desc",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get LP holdings with filtering, sorting, and pagination"""
    try:
        query = db.query(LPHolding)

        if lp_id:
            query = query.filter(LPHolding.lp_id == lp_id)

        if vintage:
            query = query.filter(LPHolding.vintage == vintage)

        if min_value is not None:
            query = query.filter(LPHolding.market_value >= min_value)

        if max_value is not None:
            query = query.filter(LPHolding.market_value <= max_value)

        if search:
            query = query.filter(LPHolding.fund_name.ilike(f"%{search}%"))

        total_count = query.count()

        sort_column = {
            "vintage": LPHolding.vintage,
            "fund_name": LPHolding.fund_name,
            "market_value": LPHolding.market_value,
            "inception_irr": LPHolding.inception_irr,
            "capital_committed": LPHolding.capital_committed,
            "capital_contributed": LPHolding.capital_contributed,
        }.get(sort_by, LPHolding.vintage)

        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        holdings = query.limit(limit).offset(offset).all()

        results = []
        for holding in holdings:
            results.append({
                "id": holding.id,
                "fund_id": holding.fund_id,
                "fund_name": holding.fund_name,
                "vintage": holding.vintage,
                "capital_committed": holding.capital_committed,
                "capital_committed_raw": holding.capital_committed_raw,
                "capital_contributed": holding.capital_contributed,
                "capital_contributed_raw": holding.capital_contributed_raw,
                "capital_distributed": holding.capital_distributed,
                "capital_distributed_raw": holding.capital_distributed_raw,
                "market_value": holding.market_value,
                "market_value_raw": holding.market_value_raw,
                "inception_irr": holding.inception_irr,
                "lp_id": holding.lp_id,
                "lp_name": holding.lp_name,
                "created_at": holding.created_at.isoformat() if holding.created_at else None,
                "updated_at": holding.updated_at.isoformat() if holding.updated_at else None,
            })

        return {
            "holdings": results,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Failed to get holdings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get holdings: {str(e)}")


@app.get("/api/holdings/{holding_id}")
async def get_holding(holding_id: str, db: Session = Depends(get_db)):
    """Get a single holding by ID"""
    try:
        holding = db.query(LPHolding).filter(LPHolding.id == holding_id).first()

        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found")

        return {
            "id": holding.id,
            "fund_id": holding.fund_id,
            "fund_name": holding.fund_name,
            "vintage": holding.vintage,
            "capital_committed": holding.capital_committed,
            "capital_committed_raw": holding.capital_committed_raw,
            "capital_contributed": holding.capital_contributed,
            "capital_contributed_raw": holding.capital_contributed_raw,
            "capital_distributed": holding.capital_distributed,
            "capital_distributed_raw": holding.capital_distributed_raw,
            "market_value": holding.market_value,
            "market_value_raw": holding.market_value_raw,
            "inception_irr": holding.inception_irr,
            "lp_id": holding.lp_id,
            "lp_name": holding.lp_name,
            "created_at": holding.created_at.isoformat() if holding.created_at else None,
            "updated_at": holding.updated_at.isoformat() if holding.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get holding {holding_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get holding: {str(e)}")


@app.post("/api/holdings", status_code=201)
async def create_holding(holding_data: dict, db: Session = Depends(get_db)):
    """Create a new holding"""
    try:
        holding_id = str(uuid4())

        holding = LPHolding(
            id=holding_id,
            fund_id=holding_data.get("fund_id"),
            fund_name=holding_data["fund_name"],
            vintage=holding_data.get("vintage"),
            capital_committed=holding_data.get("capital_committed"),
            capital_committed_raw=holding_data.get("capital_committed_raw"),
            capital_contributed=holding_data.get("capital_contributed"),
            capital_contributed_raw=holding_data.get("capital_contributed_raw"),
            capital_distributed=holding_data.get("capital_distributed"),
            capital_distributed_raw=holding_data.get("capital_distributed_raw"),
            market_value=holding_data.get("market_value"),
            market_value_raw=holding_data.get("market_value_raw"),
            inception_irr=holding_data.get("inception_irr"),
            lp_id=holding_data.get("lp_id"),
            lp_name=holding_data.get("lp_name"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(holding)
        db.commit()
        db.refresh(holding)

        logger.info(f"Created holding {holding_id} for fund {holding.fund_name}")

        return {
            "id": holding.id,
            "fund_id": holding.fund_id,
            "fund_name": holding.fund_name,
            "vintage": holding.vintage,
            "capital_committed": holding.capital_committed,
            "capital_committed_raw": holding.capital_committed_raw,
            "capital_contributed": holding.capital_contributed,
            "capital_contributed_raw": holding.capital_contributed_raw,
            "capital_distributed": holding.capital_distributed,
            "capital_distributed_raw": holding.capital_distributed_raw,
            "market_value": holding.market_value,
            "market_value_raw": holding.market_value_raw,
            "inception_irr": holding.inception_irr,
            "lp_id": holding.lp_id,
            "lp_name": holding.lp_name,
            "created_at": holding.created_at.isoformat() if holding.created_at else None,
            "updated_at": holding.updated_at.isoformat() if holding.updated_at else None,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create holding: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create holding: {str(e)}")


@app.put("/api/holdings/{holding_id}")
async def update_holding(
    holding_id: str,
    holding_data: dict,
    db: Session = Depends(get_db)
):
    """Update an existing holding"""
    try:
        holding = db.query(LPHolding).filter(LPHolding.id == holding_id).first()

        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found")

        for key, value in holding_data.items():
            if hasattr(holding, key) and key not in ['id', 'created_at']:
                setattr(holding, key, value)

        holding.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(holding)

        logger.info(f"Updated holding {holding_id}")

        return {
            "id": holding.id,
            "fund_id": holding.fund_id,
            "fund_name": holding.fund_name,
            "vintage": holding.vintage,
            "capital_committed": holding.capital_committed,
            "capital_committed_raw": holding.capital_committed_raw,
            "capital_contributed": holding.capital_contributed,
            "capital_contributed_raw": holding.capital_contributed_raw,
            "capital_distributed": holding.capital_distributed,
            "capital_distributed_raw": holding.capital_distributed_raw,
            "market_value": holding.market_value,
            "market_value_raw": holding.market_value_raw,
            "inception_irr": holding.inception_irr,
            "lp_id": holding.lp_id,
            "lp_name": holding.lp_name,
            "created_at": holding.created_at.isoformat() if holding.created_at else None,
            "updated_at": holding.updated_at.isoformat() if holding.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update holding {holding_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update holding: {str(e)}")


@app.delete("/api/holdings/{holding_id}", status_code=204)
async def delete_holding(holding_id: str, db: Session = Depends(get_db)):
    """Delete a holding"""
    try:
        holding = db.query(LPHolding).filter(LPHolding.id == holding_id).first()

        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found")

        db.delete(holding)
        db.commit()

        logger.info(f"Deleted holding {holding_id}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete holding {holding_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete holding: {str(e)}")


@app.get("/api/holdings/stats/summary")
async def get_holdings_stats(lp_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Get aggregate statistics for holdings"""
    try:
        query = db.query(LPHolding)

        if lp_id:
            query = query.filter(LPHolding.lp_id == lp_id)

        holdings = query.all()

        if not holdings:
            return {
                "total_capital_committed": 0,
                "total_capital_contributed": 0,
                "total_capital_distributed": 0,
                "total_market_value": 0,
                "average_irr": 0,
                "count": 0,
                "by_vintage": {}
            }

        total_committed = sum(h.capital_committed for h in holdings if h.capital_committed)
        total_contributed = sum(h.capital_contributed for h in holdings if h.capital_contributed)
        total_distributed = sum(h.capital_distributed for h in holdings if h.capital_distributed)
        total_value = sum(h.market_value for h in holdings if h.market_value)

        irr_values = [h.inception_irr for h in holdings if h.inception_irr is not None]
        avg_irr = sum(irr_values) / len(irr_values) if irr_values else 0

        by_vintage = {}
        for holding in holdings:
            if holding.vintage:
                vintage = str(holding.vintage)
                if vintage not in by_vintage:
                    by_vintage[vintage] = 0
                by_vintage[vintage] += 1

        return {
            "total_capital_committed": total_committed,
            "total_capital_contributed": total_contributed,
            "total_capital_distributed": total_distributed,
            "total_market_value": total_value,
            "average_irr": avg_irr,
            "count": len(holdings),
            "by_vintage": by_vintage
        }

    except Exception as e:
        logger.error(f"Failed to get holdings stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get holdings stats: {str(e)}")


# ============================================================================
# Portfolio Company API Endpoints
# ============================================================================

@app.get("/api/portfolio-companies", response_model=PortfolioCompanyListResponse)
async def list_portfolio_companies(
    db: Session = Depends(get_db),
    fund_id: Optional[str] = Query(None, description="Filter by fund ID"),
    search: Optional[str] = Query(None, description="Search in company name and description"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    stage: Optional[str] = Query(None, description="Filter by investment stage"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Exited, IPO)"),
    location: Optional[str] = Query(None, description="Filter by location"),
    min_valuation: Optional[float] = Query(None, description="Minimum valuation"),
    max_valuation: Optional[float] = Query(None, description="Maximum valuation"),
    sort_by: str = Query("name", description="Field to sort by"),
    order: str = Query("asc", description="Sort order (asc or desc)"),
    limit: int = Query(50, ge=1, le=500, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip")
):
    """List and search portfolio companies with advanced filtering"""
    try:
        query = db.query(PortfolioCompany)

        if fund_id:
            query = query.filter(PortfolioCompany.fund_id == fund_id)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    PortfolioCompany.name.ilike(search_pattern),
                    PortfolioCompany.description.ilike(search_pattern)
                )
            )

        if sector:
            query = query.filter(PortfolioCompany.sector == sector)

        if stage:
            query = query.filter(PortfolioCompany.stage == stage)

        if status:
            query = query.filter(PortfolioCompany.status == status)

        if location:
            location_pattern = f"%{location}%"
            query = query.filter(PortfolioCompany.location.ilike(location_pattern))

        if min_valuation is not None:
            query = query.filter(PortfolioCompany.valuation >= min_valuation)

        if max_valuation is not None:
            query = query.filter(PortfolioCompany.valuation <= max_valuation)

        total = query.count()

        sort_func = desc if order == "desc" else asc
        sort_field_map = {
            "name": PortfolioCompany.name,
            "sector": PortfolioCompany.sector,
            "stage": PortfolioCompany.stage,
            "valuation": PortfolioCompany.valuation,
            "investment_date": PortfolioCompany.investment_date,
            "created_at": PortfolioCompany.created_at
        }
        sort_field = sort_field_map.get(sort_by, PortfolioCompany.name)
        query = query.order_by(sort_func(sort_field))

        query = query.limit(limit).offset(offset)
        companies = query.all()

        page = (offset // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return PortfolioCompanyListResponse(
            companies=[PortfolioCompanyResponse.model_validate(c) for c in companies],
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Failed to list portfolio companies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list portfolio companies: {str(e)}")


@app.get("/api/funds/{fund_id}/portfolio", response_model=PortfolioCompanyListResponse)
async def get_fund_portfolio(
    fund_id: str,
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search in company name"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    stage: Optional[str] = Query(None, description="Filter by stage"),
    status: Optional[str] = Query(None, description="Filter by status"),
    sort_by: str = Query("name", description="Field to sort by"),
    order: str = Query("asc", description="Sort order"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """Get portfolio companies for a specific fund"""
    try:
        # Verify fund exists
        fund = db.query(Fund).filter(Fund.id == fund_id).first()
        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        query = db.query(PortfolioCompany).filter(PortfolioCompany.fund_id == fund_id)

        if search:
            query = query.filter(PortfolioCompany.name.ilike(f"%{search}%"))

        if sector:
            query = query.filter(PortfolioCompany.sector == sector)

        if stage:
            query = query.filter(PortfolioCompany.stage == stage)

        if status:
            query = query.filter(PortfolioCompany.status == status)

        total = query.count()

        sort_func = desc if order == "desc" else asc
        sort_field_map = {
            "name": PortfolioCompany.name,
            "sector": PortfolioCompany.sector,
            "valuation": PortfolioCompany.valuation,
            "investment_date": PortfolioCompany.investment_date
        }
        sort_field = sort_field_map.get(sort_by, PortfolioCompany.name)
        query = query.order_by(sort_func(sort_field))

        companies = query.limit(limit).offset(offset).all()

        page = (offset // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return PortfolioCompanyListResponse(
            companies=[PortfolioCompanyResponse.model_validate(c) for c in companies],
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get portfolio for fund {fund_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get fund portfolio: {str(e)}")


@app.get("/api/portfolio-companies/{company_id}", response_model=PortfolioCompanyResponse)
async def get_portfolio_company(
    company_id: str,
    db: Session = Depends(get_db)
):
    """Get a single portfolio company by ID"""
    try:
        company = db.query(PortfolioCompany).filter(PortfolioCompany.id == company_id).first()

        if not company:
            raise HTTPException(status_code=404, detail="Portfolio company not found")

        return PortfolioCompanyResponse.model_validate(company)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get portfolio company {company_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get portfolio company: {str(e)}")


@app.post("/api/portfolio-companies", response_model=PortfolioCompanyResponse, status_code=201)
async def create_portfolio_company(
    company: PortfolioCompanyCreate,
    db: Session = Depends(get_db)
):
    """Create a new portfolio company"""
    try:
        # Verify fund exists
        fund = db.query(Fund).filter(Fund.id == company.fund_id).first()
        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

        company_id = str(uuid4())
        new_company = PortfolioCompany(
            id=company_id,
            fund_name=company.fund_name or fund.name,
            **company.model_dump(exclude={'fund_name'})
        )

        db.add(new_company)
        db.commit()
        db.refresh(new_company)

        logger.info(f"Created portfolio company: {company_id} - {new_company.name}")
        return PortfolioCompanyResponse.model_validate(new_company)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create portfolio company: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create portfolio company: {str(e)}")


@app.put("/api/portfolio-companies/{company_id}", response_model=PortfolioCompanyResponse)
async def update_portfolio_company(
    company_id: str,
    company_update: PortfolioCompanyUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing portfolio company"""
    try:
        company = db.query(PortfolioCompany).filter(PortfolioCompany.id == company_id).first()

        if not company:
            raise HTTPException(status_code=404, detail="Portfolio company not found")

        update_data = company_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(company, field, value)

        db.commit()
        db.refresh(company)

        logger.info(f"Updated portfolio company: {company_id}")
        return PortfolioCompanyResponse.model_validate(company)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update portfolio company {company_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update portfolio company: {str(e)}")


@app.delete("/api/portfolio-companies/{company_id}", status_code=204)
async def delete_portfolio_company(
    company_id: str,
    db: Session = Depends(get_db)
):
    """Delete a portfolio company"""
    try:
        company = db.query(PortfolioCompany).filter(PortfolioCompany.id == company_id).first()

        if not company:
            raise HTTPException(status_code=404, detail="Portfolio company not found")

        company_name = company.name
        db.delete(company)
        db.commit()

        logger.info(f"Deleted portfolio company: {company_id} - {company_name}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete portfolio company {company_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete portfolio company: {str(e)}")


@app.get("/api/portfolio-companies/meta/sectors")
async def get_portfolio_sectors(db: Session = Depends(get_db)):
    """Get all unique portfolio company sectors"""
    try:
        sectors = db.query(PortfolioCompany.sector)\
            .filter(PortfolioCompany.sector.isnot(None))\
            .distinct()\
            .order_by(PortfolioCompany.sector)\
            .all()

        return {"sectors": [s[0] for s in sectors]}

    except Exception as e:
        logger.error(f"Failed to get portfolio sectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sectors: {str(e)}")


@app.get("/api/portfolio-companies/meta/stats")
async def get_portfolio_statistics(
    fund_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get portfolio company statistics"""
    try:
        query = db.query(PortfolioCompany)
        if fund_id:
            query = query.filter(PortfolioCompany.fund_id == fund_id)

        total_companies = query.count()
        total_valuation = query.with_entities(func.sum(PortfolioCompany.valuation))\
            .filter(PortfolioCompany.valuation.isnot(None)).scalar() or 0.0

        # Status breakdown
        status_breakdown = query.with_entities(
            PortfolioCompany.status,
            func.count(PortfolioCompany.id)
        ).group_by(PortfolioCompany.status).all()

        # Sector breakdown
        sector_breakdown = query.with_entities(
            PortfolioCompany.sector,
            func.count(PortfolioCompany.id)
        ).filter(PortfolioCompany.sector.isnot(None))\
            .group_by(PortfolioCompany.sector)\
            .order_by(desc(func.count(PortfolioCompany.id)))\
            .limit(10).all()

        return {
            "total_companies": total_companies,
            "total_valuation": float(total_valuation),
            "status_breakdown": [{"status": s[0] or "Unknown", "count": s[1]} for s in status_breakdown],
            "sector_breakdown": [{"sector": s[0], "count": s[1]} for s in sector_breakdown]
        }

    except Exception as e:
        logger.error(f"Failed to get portfolio statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get portfolio statistics: {str(e)}")
