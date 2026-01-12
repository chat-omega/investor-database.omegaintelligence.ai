"""
Preqin Data Layer Module

Provides a queryable data layer for Preqin Excel exports supporting:
- Entity lookups (Firms, Funds, Deals, People, Companies)
- Relationship queries (LP ↔ GP ↔ Fund ↔ Deal ↔ Company)
- Hybrid search with pgvector embeddings
- Co-investment network analysis
"""

__version__ = "1.0.0"

# Export router for FastAPI integration
from preqin.routes import router as preqin_router

__all__ = ["preqin_router"]
