"""
Preqin Search Module

Hybrid search implementation combining:
- pg_trgm for fuzzy text matching
- Full-text search with tsvector
- pgvector for semantic embeddings
"""

from .simple_search import (
    simple_firm_search,
    simple_fund_search,
    simple_deal_search,
)

from .hybrid_search import (
    hybrid_search,
    generate_entity_docs,
    generate_embeddings,
)

__all__ = [
    # Simple search
    "simple_firm_search",
    "simple_fund_search",
    "simple_deal_search",
    # Hybrid search
    "hybrid_search",
    "generate_entity_docs",
    "generate_embeddings",
]
