"""
Firm Entity Resolution using Splink

Matches firms across different sources (GP, LP, deal investors) to create canonical firm aliases.
Uses DuckDB backend for in-memory processing, then writes results to PostgreSQL.

Usage:
    python -m preqin.entity_resolution.firm_linker [--threshold 0.8]
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
import json

try:
    import duckdb
    from splink import DuckDBAPI, Linker, SettingsCreator, block_on
    import splink.comparison_library as cl
    SPLINK_AVAILABLE = True
except ImportError:
    SPLINK_AVAILABLE = False
    logging.warning("Splink not available. Install with: pip install splink duckdb")

from sqlalchemy import text
from sqlalchemy.orm import Session

from preqin.database import engine, SessionLocal

logger = logging.getLogger(__name__)


class FirmLinker:
    """
    Splink-based firm entity resolver.
    
    Matches firm records based on:
    - Normalized name similarity
    - Country matching
    - Institution type matching
    """
    
    def __init__(self, threshold: float = 0.8):
        """
        Initialize the firm linker.
        
        Args:
            threshold: Minimum match probability to consider as same entity (0.0-1.0)
        """
        if not SPLINK_AVAILABLE:
            raise ImportError("Splink and DuckDB are required for entity resolution")
        
        self.threshold = threshold
        self.db = duckdb.connect()  # In-memory DuckDB
        self.linker = None
        
    def load_firms_from_postgres(self) -> int:
        """
        Load firms from PostgreSQL into DuckDB for processing.
        Returns count of loaded firms.
        """
        logger.info("Loading firms from PostgreSQL to DuckDB")
        
        # Fetch firms from PostgreSQL
        with SessionLocal() as session:
            result = session.execute(text("""
                SELECT 
                    id::TEXT,
                    source_id,
                    name,
                    name_normalized,
                    firm_type,
                    institution_type,
                    headquarters_country,
                    headquarters_city,
                    aum_usd
                FROM preqin.preqin_firms
            """))
            
            rows = result.fetchall()
            columns = result.keys()
        
        if not rows:
            logger.warning("No firms found in database")
            return 0
        
        # Create DuckDB table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS firms (
                id VARCHAR PRIMARY KEY,
                source_id VARCHAR,
                name VARCHAR,
                name_normalized VARCHAR,
                firm_type VARCHAR,
                institution_type VARCHAR,
                headquarters_country VARCHAR,
                headquarters_city VARCHAR,
                aum_usd DOUBLE
            )
        """)
        
        # Insert data
        for row in rows:
            self.db.execute("""
                INSERT INTO firms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, list(row))
        
        count = self.db.execute("SELECT COUNT(*) FROM firms").fetchone()[0]
        logger.info(f"Loaded {count} firms into DuckDB")
        return count
    
    def configure_linker(self) -> None:
        """
        Configure Splink linker with comparison rules for firms.
        """
        logger.info("Configuring Splink linker for firm matching")
        
        # Settings for firm matching
        settings = SettingsCreator(
            link_type="dedupe_only",
            unique_id_column_name="id",
            comparisons=[
                # Name comparison with multiple levels
                cl.JaroWinklerAtThresholds(
                    "name_normalized",
                    score_threshold_or_thresholds=[0.95, 0.88, 0.80]
                ),
                # Country exact match
                cl.ExactMatch("headquarters_country").configure(
                    term_frequency_adjustments=True
                ),
                # Institution type exact match
                cl.ExactMatch("institution_type").configure(
                    term_frequency_adjustments=True
                ),
                # City similarity
                cl.JaroWinklerAtThresholds(
                    "headquarters_city",
                    score_threshold_or_thresholds=[0.9, 0.8]
                ),
            ],
            blocking_rules_to_generate_predictions=[
                # Block on first 3 chars of normalized name
                block_on("substr(name_normalized, 1, 3)"),
                # Block on country
                block_on("headquarters_country"),
            ],
            retain_intermediate_calculation_columns=False,
        )
        
        # Initialize linker with DuckDB backend
        db_api = DuckDBAPI(self.db)
        self.linker = Linker(
            self.db.execute("SELECT * FROM firms").fetchdf(),
            settings,
            db_api=db_api
        )
        
        logger.info("Splink linker configured")
    
    def train_model(self) -> None:
        """
        Train the Splink model using expectation-maximization.
        """
        if not self.linker:
            raise ValueError("Linker not configured. Call configure_linker() first.")
        
        logger.info("Training Splink model")
        
        # Estimate u probabilities using random sampling
        self.linker.training.estimate_u_using_random_sampling(max_pairs=1e6)
        
        # Estimate m probabilities using expectation-maximization
        # Block on exact name match to get labeled examples
        self.linker.training.estimate_m_from_pairwise_labels(
            [
                block_on("name_normalized"),
                block_on("headquarters_country", "name_normalized"),
            ]
        )
        
        logger.info("Model training complete")
    
    def predict_matches(self) -> List[Dict[str, Any]]:
        """
        Predict firm matches above threshold.
        
        Returns:
            List of match dictionaries with firm IDs and match probabilities
        """
        if not self.linker:
            raise ValueError("Linker not configured. Call configure_linker() first.")
        
        logger.info(f"Predicting matches with threshold {self.threshold}")
        
        # Get predictions
        predictions = self.linker.inference.predict(threshold_match_probability=self.threshold)
        
        # Convert to list of dictionaries
        matches = []
        df = predictions.as_pandas_dataframe()
        
        for _, row in df.iterrows():
            matches.append({
                "firm_id_l": row["id_l"],
                "firm_id_r": row["id_r"],
                "match_probability": row["match_probability"],
                "match_weight": row.get("match_weight", 0),
            })
        
        logger.info(f"Found {len(matches)} matches above threshold")
        return matches
    
    def cluster_matches(self, matches: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Cluster matched firms into canonical groups.
        
        Returns:
            Dictionary mapping firm_id -> canonical_firm_id
        """
        if not matches:
            return {}
        
        logger.info("Clustering matches into canonical groups")
        
        # Build union-find for transitive closure
        parent = {}
        
        def find(x):
            if x not in parent:
                parent[x] = x
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        # Union all matched pairs
        for match in matches:
            union(match["firm_id_l"], match["firm_id_r"])
        
        # Create mapping to canonical IDs
        firm_to_canonical = {}
        for firm_id in parent.keys():
            firm_to_canonical[firm_id] = find(firm_id)
        
        logger.info(f"Created {len(set(firm_to_canonical.values()))} canonical firm groups")
        return firm_to_canonical
    
    def write_aliases_to_postgres(
        self, 
        firm_to_canonical: Dict[str, str],
        matches: List[Dict[str, Any]]
    ) -> int:
        """
        Write firm aliases to PostgreSQL.
        
        Returns:
            Number of aliases written
        """
        logger.info("Writing firm aliases to PostgreSQL")
        
        # Build match confidence lookup
        confidence = {}
        for match in matches:
            key = (match["firm_id_l"], match["firm_id_r"])
            confidence[key] = match["match_probability"]
            confidence[(match["firm_id_r"], match["firm_id_l"])] = match["match_probability"]
        
        with SessionLocal() as session:
            count = 0
            
            for firm_id, canonical_id in firm_to_canonical.items():
                if firm_id == canonical_id:
                    continue  # Skip self-references
                
                # Get alias name from DuckDB
                result = self.db.execute(
                    "SELECT name FROM firms WHERE id = ?", [firm_id]
                ).fetchone()
                
                if not result:
                    continue
                
                alias_name = result[0]
                conf = confidence.get((firm_id, canonical_id), self.threshold)
                
                # Insert alias
                sql = text("""
                    INSERT INTO preqin.preqin_firm_aliases (
                        id, canonical_firm_id, alias_name, alias_source, confidence, created_at
                    ) VALUES (
                        :id, :canonical_firm_id::UUID, :alias_name, 'splink', :confidence, NOW()
                    )
                    ON CONFLICT (canonical_firm_id, alias_name) DO UPDATE SET
                        confidence = GREATEST(preqin.preqin_firm_aliases.confidence, EXCLUDED.confidence)
                """)
                
                session.execute(sql, {
                    "id": str(uuid.uuid4()),
                    "canonical_firm_id": canonical_id,
                    "alias_name": alias_name,
                    "confidence": conf
                })
                count += 1
            
            session.commit()
        
        logger.info(f"Wrote {count} firm aliases")
        return count


def run_firm_resolution(threshold: float = 0.8) -> Dict[str, Any]:
    """
    Run full firm entity resolution pipeline.
    
    Args:
        threshold: Minimum match probability threshold
        
    Returns:
        Result dictionary with statistics
    """
    if not SPLINK_AVAILABLE:
        logger.error("Splink not available. Install with: pip install splink duckdb")
        return {"error": "Splink not available"}
    
    logger.info(f"Starting firm entity resolution (threshold: {threshold})")
    
    linker = FirmLinker(threshold=threshold)
    
    # Load data
    firm_count = linker.load_firms_from_postgres()
    if firm_count < 2:
        return {"error": "Not enough firms for resolution", "firm_count": firm_count}
    
    # Configure and train
    linker.configure_linker()
    linker.train_model()
    
    # Predict matches
    matches = linker.predict_matches()
    
    # Cluster and write results
    firm_to_canonical = linker.cluster_matches(matches)
    alias_count = linker.write_aliases_to_postgres(firm_to_canonical, matches)
    
    result = {
        "firms_processed": firm_count,
        "matches_found": len(matches),
        "canonical_groups": len(set(firm_to_canonical.values())),
        "aliases_written": alias_count,
        "threshold": threshold
    }
    
    logger.info(f"Firm resolution complete: {result}")
    return result


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Run firm entity resolution")
    parser.add_argument(
        "--threshold", type=float, default=0.8,
        help="Minimum match probability threshold (default: 0.8)"
    )
    
    args = parser.parse_args()
    
    result = run_firm_resolution(threshold=args.threshold)
    print(json.dumps(result, indent=2))
