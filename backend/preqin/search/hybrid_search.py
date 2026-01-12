"""
Hybrid Search for Preqin Data Layer

Combines:
- Full-text search (tsvector/tsquery)
- pg_trgm fuzzy matching
- pgvector semantic embeddings

Usage:
    from preqin.search import hybrid_search
    
    results = hybrid_search(
        query="tech buyout firms in california",
        entity_types=["firm", "fund"],
        use_semantic=True
    )
"""

import os
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import SessionLocal

logger = logging.getLogger(__name__)

# OpenAI client for embeddings
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI not available. Semantic search disabled.")


# Configuration
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536
FTS_WEIGHT = 0.3
SEMANTIC_WEIGHT = 0.7

# pgvector availability cache (None = not checked yet)
_PGVECTOR_AVAILABLE: Optional[bool] = None


def check_pgvector_available(session: Session) -> bool:
    """
    Check if pgvector extension is installed and working.
    Result is cached for the module lifetime.

    Args:
        session: Database session

    Returns:
        True if pgvector is available
    """
    global _PGVECTOR_AVAILABLE

    if _PGVECTOR_AVAILABLE is not None:
        return _PGVECTOR_AVAILABLE

    try:
        result = session.execute(text(
            "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
        ))
        _PGVECTOR_AVAILABLE = result.scalar() is not None
    except Exception as e:
        logger.warning(f"Could not check pgvector availability: {e}")
        _PGVECTOR_AVAILABLE = False

    if _PGVECTOR_AVAILABLE:
        logger.info("pgvector extension is available")
    else:
        logger.warning("pgvector extension not available - semantic search disabled")

    return _PGVECTOR_AVAILABLE


def reset_pgvector_cache():
    """Reset pgvector availability cache (for testing)."""
    global _PGVECTOR_AVAILABLE
    _PGVECTOR_AVAILABLE = None


def get_embedding(text: str) -> Optional[List[float]]:
    """
    Get OpenAI embedding for text.
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector or None if unavailable
    """
    if not OPENAI_AVAILABLE:
        return None
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set")
        return None
    
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error getting embedding: {e}")
        return None


def hybrid_search(
    query: str,
    entity_types: Optional[List[str]] = None,
    filters: Optional[Dict[str, Any]] = None,
    use_semantic: bool = True,
    limit: int = 20,
    session: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Perform hybrid search combining FTS and semantic search.
    
    Args:
        query: Search query string
        entity_types: Filter by entity types (firm, fund, deal, company, person)
        filters: Additional filters (min_aum, country, strategy, etc.)
        use_semantic: Whether to use semantic search (requires embeddings)
        limit: Maximum results
        
    Returns:
        Dictionary with search results and entity_metadata
    """
    if not query or len(query.strip()) < 2:
        return {"query": query, "results": [], "total": 0, "search_type": "none"}
    
    # Default to all entity types
    if not entity_types:
        entity_types = ["firm", "fund", "company"]  # Skip person/deal for MVP

    # Create session early so we can check pgvector
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True

    # Check pgvector availability (cached after first call)
    pgvector_available = check_pgvector_available(session)

    # Get query embedding if semantic search requested AND pgvector available
    query_embedding = None
    search_type = "fts_only"

    if use_semantic and pgvector_available:
        query_embedding = get_embedding(query)
        if query_embedding:
            search_type = "hybrid"
        else:
            logger.info("Falling back to FTS-only search (embedding failed)")
    elif use_semantic and not pgvector_available:
        logger.info("Falling back to FTS-only search (pgvector not available)")
    
    # Build filter conditions
    filter_conditions = []
    params = {
        "query": query,
        "entity_types": entity_types,
        "limit": limit
    }
    
    if filters:
        if filters.get("min_aum"):
            filter_conditions.append("(entity_metadata->>'aum_usd')::NUMERIC >= :min_aum")
            params["min_aum"] = filters["min_aum"]
        
        if filters.get("country"):
            filter_conditions.append("entity_metadata->>'country' ILIKE :country")
            params["country"] = f"%{filters['country']}%"
        
        if filters.get("strategy"):
            filter_conditions.append("entity_metadata->>'strategy' ILIKE :strategy")
            params["strategy"] = f"%{filters['strategy']}%"
        
        if filters.get("firm_type"):
            filter_conditions.append("entity_metadata->>'firm_type' = :firm_type")
            params["firm_type"] = filters["firm_type"]
    
    filter_sql = " AND ".join(filter_conditions) if filter_conditions else "1=1"
    
    # Build search query
    if query_embedding:
        # Hybrid search with vector similarity
        # Format embedding as PostgreSQL vector literal (avoid SQLAlchemy param issues with ::vector cast)
        embedding_literal = f"'[{','.join(map(str, query_embedding))}]'::vector"

        sql = text(f"""
            SELECT
                entity_type,
                entity_id,
                title,
                SUBSTRING(doc_text, 1, 200) as snippet,
                entity_metadata,
                ts_rank(search_vector, plainto_tsquery('english', :query)) as text_score,
                CASE
                    WHEN embedding IS NOT NULL
                    THEN 1 - (embedding <=> {embedding_literal})
                    ELSE 0
                END as semantic_score,
                CASE
                    WHEN embedding IS NOT NULL
                    THEN ({FTS_WEIGHT} * ts_rank(search_vector, plainto_tsquery('english', :query)) +
                          {SEMANTIC_WEIGHT} * (1 - (embedding <=> {embedding_literal})))
                    ELSE ts_rank(search_vector, plainto_tsquery('english', :query))
                END as combined_score
            FROM preqin.preqin_entity_doc
            WHERE entity_type = ANY(:entity_types)
              AND {filter_sql}
              AND (
                  search_vector @@ plainto_tsquery('english', :query)
                  OR (embedding IS NOT NULL AND 1 - (embedding <=> {embedding_literal}) > 0.6)
              )
            ORDER BY combined_score DESC
            LIMIT :limit
        """)
    else:
        # FTS-only search
        sql = text(f"""
            SELECT
                entity_type,
                entity_id,
                title,
                SUBSTRING(doc_text, 1, 200) as snippet,
                entity_metadata,
                ts_rank(search_vector, plainto_tsquery('english', :query)) as text_score,
                0::FLOAT as semantic_score,
                ts_rank(search_vector, plainto_tsquery('english', :query)) as combined_score
            FROM preqin.preqin_entity_doc
            WHERE entity_type = ANY(:entity_types)
              AND {filter_sql}
              AND search_vector @@ plainto_tsquery('english', :query)
            ORDER BY combined_score DESC
            LIMIT :limit
        """)

    try:
        result = session.execute(sql, params)
        
        results = []
        for row in result:
            results.append({
                "entity_type": row[0],
                "entity_id": str(row[1]),
                "title": row[2],
                "snippet": row[3],
                "entity_metadata": row[4],
                "text_score": float(row[5]) if row[5] else 0,
                "semantic_score": float(row[6]) if row[6] else 0,
                "score": float(row[7]) if row[7] else 0,
            })
        
        return {
            "query": query,
            "results": results,
            "total": len(results),
            "search_type": search_type,
            "entity_types": entity_types,
        }
    finally:
        if close_session:
            session.close()


def generate_entity_docs(batch_size: int = 1000) -> Dict[str, int]:
    """
    Generate entity documents for hybrid search.
    Creates searchable documents combining entity attributes.
    
    Args:
        batch_size: Number of records to process per batch
        
    Returns:
        Dictionary with counts per entity type
    """
    logger.info("Generating entity documents for search")
    
    counts = {}
    
    with SessionLocal() as session:
        # Generate firm documents
        sql_firms = text("""
            INSERT INTO preqin.preqin_entity_doc (
                id, entity_type, entity_id, title, doc_text, entity_metadata, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                'firm',
                id,
                name,
                preqin.generate_firm_doc(
                    name, firm_type, institution_type,
                    headquarters_country, headquarters_region,
                    description, aum_usd
                ),
                jsonb_build_object(
                    'firm_type', firm_type,
                    'institution_type', institution_type,
                    'country', headquarters_country,
                    'aum_usd', aum_usd
                ),
                NOW(),
                NOW()
            FROM preqin.preqin_firms
            ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                title = EXCLUDED.title,
                doc_text = EXCLUDED.doc_text,
                entity_metadata = EXCLUDED.entity_metadata,
                updated_at = NOW()
        """)
        
        result = session.execute(sql_firms)
        counts["firm"] = result.rowcount
        session.commit()
        logger.info(f"Generated {counts['firm']} firm documents")
        
        # Generate fund documents
        sql_funds = text("""
            INSERT INTO preqin.preqin_entity_doc (
                id, entity_type, entity_id, title, doc_text, entity_metadata, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                'fund',
                f.id,
                f.name,
                f.name || ' ' ||
                COALESCE(f.strategy, '') || ' ' ||
                COALESCE(f.sub_strategy, '') || ' ' ||
                COALESCE('vintage ' || f.vintage_year::TEXT, '') || ' ' ||
                COALESCE(fm.name, '') || ' ' ||
                CASE WHEN f.fund_size_usd IS NOT NULL
                     THEN 'size ' || ROUND(f.fund_size_usd / 1000000000, 2)::TEXT || ' billion'
                     ELSE ''
                END,
                jsonb_build_object(
                    'strategy', f.strategy,
                    'vintage_year', f.vintage_year,
                    'fund_size_usd', f.fund_size_usd,
                    'manager_name', fm.name
                ),
                NOW(),
                NOW()
            FROM preqin.preqin_funds f
            LEFT JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
            LEFT JOIN preqin.preqin_firms fm ON fm.id = fmf.firm_id
            ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                title = EXCLUDED.title,
                doc_text = EXCLUDED.doc_text,
                entity_metadata = EXCLUDED.entity_metadata,
                updated_at = NOW()
        """)
        
        result = session.execute(sql_funds)
        counts["fund"] = result.rowcount
        session.commit()
        logger.info(f"Generated {counts['fund']} fund documents")
        
        # Generate company documents
        sql_companies = text("""
            INSERT INTO preqin.preqin_entity_doc (
                id, entity_type, entity_id, title, doc_text, entity_metadata, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                'company',
                id,
                name,
                name || ' ' ||
                COALESCE(primary_industry, '') || ' ' ||
                COALESCE(secondary_industry, '') || ' ' ||
                COALESCE(country, '') || ' ' ||
                COALESCE(region, '') || ' ' ||
                COALESCE(description, ''),
                jsonb_build_object(
                    'industry', primary_industry,
                    'country', country,
                    'region', region
                ),
                NOW(),
                NOW()
            FROM preqin.preqin_companies
            ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                title = EXCLUDED.title,
                doc_text = EXCLUDED.doc_text,
                entity_metadata = EXCLUDED.entity_metadata,
                updated_at = NOW()
        """)
        
        result = session.execute(sql_companies)
        counts["company"] = result.rowcount
        session.commit()
        logger.info(f"Generated {counts['company']} company documents")
    
    total = sum(counts.values())
    logger.info(f"Generated {total} total entity documents")
    return counts


def generate_embeddings(
    entity_types: Optional[List[str]] = None,
    batch_size: int = 100,
    limit: Optional[int] = None
) -> Dict[str, int]:
    """
    Generate OpenAI embeddings for entity documents.
    
    Args:
        entity_types: Types to generate embeddings for (default: firm, fund, company)
        batch_size: Number of embeddings to generate per API call
        limit: Optional limit on total embeddings to generate
        
    Returns:
        Dictionary with counts per entity type
    """
    if not OPENAI_AVAILABLE:
        logger.error("OpenAI not available. Cannot generate embeddings.")
        return {"error": "OpenAI not available"}
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY not set")
        return {"error": "OPENAI_API_KEY not set"}
    
    if not entity_types:
        entity_types = ["firm", "fund", "company"]
    
    logger.info(f"Generating embeddings for entity types: {entity_types}")
    
    client = openai.OpenAI(api_key=api_key)
    counts = {}
    
    with SessionLocal() as session:
        for entity_type in entity_types:
            # Get documents without embeddings
            limit_sql = f"LIMIT {limit}" if limit else ""
            
            sql_fetch = text(f"""
                SELECT id, doc_text
                FROM preqin.preqin_entity_doc
                WHERE entity_type = :entity_type
                  AND embedding IS NULL
                {limit_sql}
            """)
            
            result = session.execute(sql_fetch, {"entity_type": entity_type})
            docs = result.fetchall()
            
            if not docs:
                counts[entity_type] = 0
                continue
            
            logger.info(f"Generating embeddings for {len(docs)} {entity_type} documents")
            
            count = 0
            for i in range(0, len(docs), batch_size):
                batch = docs[i:i + batch_size]
                texts = [doc[1][:8000] for doc in batch]  # Truncate to 8K chars
                
                try:
                    response = client.embeddings.create(
                        model=EMBEDDING_MODEL,
                        input=texts
                    )
                    
                    # Update embeddings in database
                    for j, embedding_data in enumerate(response.data):
                        doc_id = batch[j][0]
                        embedding = embedding_data.embedding
                        
                        sql_update = text("""
                            UPDATE preqin.preqin_entity_doc
                            SET embedding = :embedding::vector
                            WHERE id = :doc_id
                        """)
                        
                        session.execute(sql_update, {
                            "doc_id": str(doc_id),
                            "embedding": f"[{','.join(map(str, embedding))}]"
                        })
                        count += 1
                    
                    session.commit()
                    logger.info(f"Generated {count} embeddings for {entity_type}")
                    
                except Exception as e:
                    logger.error(f"Error generating embeddings: {e}")
                    session.rollback()
                    break
            
            counts[entity_type] = count
    
    total = sum(counts.values())
    logger.info(f"Generated {total} total embeddings")
    return counts


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Generate search documents and embeddings")
    parser.add_argument("--generate-docs", action="store_true",
                       help="Generate entity documents")
    parser.add_argument("--generate-embeddings", action="store_true",
                       help="Generate embeddings for documents")
    parser.add_argument("--entity-types", nargs="+", default=["firm", "fund", "company"],
                       help="Entity types to process")
    parser.add_argument("--limit", type=int, help="Limit number of embeddings")
    
    args = parser.parse_args()
    
    if args.generate_docs:
        result = generate_entity_docs()
        print(json.dumps(result, indent=2))
    
    if args.generate_embeddings:
        result = generate_embeddings(
            entity_types=args.entity_types,
            limit=args.limit
        )
        print(json.dumps(result, indent=2))
    
    if not args.generate_docs and not args.generate_embeddings:
        print("Use --generate-docs and/or --generate-embeddings")
