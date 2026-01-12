"""
Fund Entity Resolution using Splink

Matches funds across different sources to create canonical fund aliases.
Uses DuckDB backend for in-memory processing, then writes results to PostgreSQL.

Usage:
    python -m preqin.entity_resolution.fund_linker [--threshold 0.8]
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


class FundLinker:
    """
    Splink-based fund entity resolver.
    
    Matches fund records based on:
    - Normalized name similarity
    - Vintage year matching
    - Strategy matching
    - Manager firm matching
    """
    
    def __init__(self, threshold: float = 0.85):
        """
        Initialize the fund linker.
        
        Args:
            threshold: Minimum match probability to consider as same entity (0.0-1.0)
        """
        if not SPLINK_AVAILABLE:
            raise ImportError("Splink and DuckDB are required for entity resolution")
        
        self.threshold = threshold
        self.db = duckdb.connect()  # In-memory DuckDB
        self.linker = None
        
    def load_funds_from_postgres(self) -> int:
        """
        Load funds from PostgreSQL into DuckDB for processing.
        Returns count of loaded funds.
        """
        logger.info("Loading funds from PostgreSQL to DuckDB")
        
        # Fetch funds from PostgreSQL with manager info
        with SessionLocal() as session:
            result = session.execute(text("""
                SELECT 
                    f.id::TEXT,
                    f.source_id,
                    f.name,
                    f.name_normalized,
                    f.vintage_year,
                    f.strategy,
                    f.fund_size_usd,
                    fm.name as manager_name,
                    fm.name_normalized as manager_name_normalized
                FROM preqin.preqin_funds f
                LEFT JOIN preqin.preqin_firm_manages_fund fmf ON fmf.fund_id = f.id
                LEFT JOIN preqin.preqin_firms fm ON fm.id = fmf.firm_id
            """))
            
            rows = result.fetchall()
        
        if not rows:
            logger.warning("No funds found in database")
            return 0
        
        # Create DuckDB table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS funds (
                id VARCHAR PRIMARY KEY,
                source_id VARCHAR,
                name VARCHAR,
                name_normalized VARCHAR,
                vintage_year INTEGER,
                strategy VARCHAR,
                fund_size_usd DOUBLE,
                manager_name VARCHAR,
                manager_name_normalized VARCHAR
            )
        """)
        
        # Insert data
        for row in rows:
            self.db.execute("""
                INSERT INTO funds VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, list(row))
        
        count = self.db.execute("SELECT COUNT(*) FROM funds").fetchone()[0]
        logger.info(f"Loaded {count} funds into DuckDB")
        return count
    
    def configure_linker(self) -> None:
        """
        Configure Splink linker with comparison rules for funds.
        """
        logger.info("Configuring Splink linker for fund matching")
        
        # Settings for fund matching
        settings = SettingsCreator(
            link_type="dedupe_only",
            unique_id_column_name="id",
            comparisons=[
                # Name comparison with multiple levels
                cl.JaroWinklerAtThresholds(
                    "name_normalized",
                    score_threshold_or_thresholds=[0.95, 0.88, 0.80]
                ),
                # Vintage year exact match (very important for funds)
                cl.ExactMatch("vintage_year").configure(
                    term_frequency_adjustments=True
                ),
                # Strategy exact match
                cl.ExactMatch("strategy").configure(
                    term_frequency_adjustments=True
                ),
                # Manager name similarity
                cl.JaroWinklerAtThresholds(
                    "manager_name_normalized",
                    score_threshold_or_thresholds=[0.95, 0.88]
                ),
            ],
            blocking_rules_to_generate_predictions=[
                # Block on vintage year
                block_on("vintage_year"),
                # Block on first 3 chars of normalized name
                block_on("substr(name_normalized, 1, 3)"),
                # Block on manager
                block_on("manager_name_normalized"),
            ],
            retain_intermediate_calculation_columns=False,
        )
        
        # Initialize linker with DuckDB backend
        db_api = DuckDBAPI(self.db)
        self.linker = Linker(
            self.db.execute("SELECT * FROM funds").fetchdf(),
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
        
        logger.info("Training Splink model for funds")
        
        # Estimate u probabilities
        self.linker.training.estimate_u_using_random_sampling(max_pairs=1e6)
        
        # Estimate m probabilities
        self.linker.training.estimate_m_from_pairwise_labels(
            [
                block_on("name_normalized"),
                block_on("vintage_year", "manager_name_normalized"),
            ]
        )
        
        logger.info("Model training complete")
    
    def predict_matches(self) -> List[Dict[str, Any]]:
        """
        Predict fund matches above threshold.
        
        Returns:
            List of match dictionaries with fund IDs and match probabilities
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
                "fund_id_l": row["id_l"],
                "fund_id_r": row["id_r"],
                "match_probability": row["match_probability"],
                "match_weight": row.get("match_weight", 0),
            })
        
        logger.info(f"Found {len(matches)} matches above threshold")
        return matches
    
    def cluster_matches(self, matches: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Cluster matched funds into canonical groups.
        
        Returns:
            Dictionary mapping fund_id -> canonical_fund_id
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
            union(match["fund_id_l"], match["fund_id_r"])
        
        # Create mapping to canonical IDs
        fund_to_canonical = {}
        for fund_id in parent.keys():
            fund_to_canonical[fund_id] = find(fund_id)
        
        logger.info(f"Created {len(set(fund_to_canonical.values()))} canonical fund groups")
        return fund_to_canonical
    
    def write_aliases_to_postgres(
        self, 
        fund_to_canonical: Dict[str, str],
        matches: List[Dict[str, Any]]
    ) -> int:
        """
        Write fund aliases to PostgreSQL.
        
        Returns:
            Number of aliases written
        """
        logger.info("Writing fund aliases to PostgreSQL")
        
        # Build match confidence lookup
        confidence = {}
        for match in matches:
            key = (match["fund_id_l"], match["fund_id_r"])
            confidence[key] = match["match_probability"]
            confidence[(match["fund_id_r"], match["fund_id_l"])] = match["match_probability"]
        
        with SessionLocal() as session:
            count = 0
            
            for fund_id, canonical_id in fund_to_canonical.items():
                if fund_id == canonical_id:
                    continue  # Skip self-references
                
                # Get alias name from DuckDB
                result = self.db.execute(
                    "SELECT name FROM funds WHERE id = ?", [fund_id]
                ).fetchone()
                
                if not result:
                    continue
                
                alias_name = result[0]
                conf = confidence.get((fund_id, canonical_id), self.threshold)
                
                # Insert alias
                sql = text("""
                    INSERT INTO preqin.preqin_fund_aliases (
                        id, canonical_fund_id, alias_name, alias_source, confidence, created_at
                    ) VALUES (
                        :id, :canonical_fund_id::UUID, :alias_name, 'splink', :confidence, NOW()
                    )
                    ON CONFLICT (canonical_fund_id, alias_name) DO UPDATE SET
                        confidence = GREATEST(preqin.preqin_fund_aliases.confidence, EXCLUDED.confidence)
                """)
                
                session.execute(sql, {
                    "id": str(uuid.uuid4()),
                    "canonical_fund_id": canonical_id,
                    "alias_name": alias_name,
                    "confidence": conf
                })
                count += 1
            
            session.commit()
        
        logger.info(f"Wrote {count} fund aliases")
        return count


def run_fund_resolution(threshold: float = 0.85) -> Dict[str, Any]:
    """
    Run full fund entity resolution pipeline.
    
    Args:
        threshold: Minimum match probability threshold
        
    Returns:
        Result dictionary with statistics
    """
    if not SPLINK_AVAILABLE:
        logger.error("Splink not available. Install with: pip install splink duckdb")
        return {"error": "Splink not available"}
    
    logger.info(f"Starting fund entity resolution (threshold: {threshold})")
    
    linker = FundLinker(threshold=threshold)
    
    # Load data
    fund_count = linker.load_funds_from_postgres()
    if fund_count < 2:
        return {"error": "Not enough funds for resolution", "fund_count": fund_count}
    
    # Configure and train
    linker.configure_linker()
    linker.train_model()
    
    # Predict matches
    matches = linker.predict_matches()
    
    # Cluster and write results
    fund_to_canonical = linker.cluster_matches(matches)
    alias_count = linker.write_aliases_to_postgres(fund_to_canonical, matches)
    
    result = {
        "funds_processed": fund_count,
        "matches_found": len(matches),
        "canonical_groups": len(set(fund_to_canonical.values())),
        "aliases_written": alias_count,
        "threshold": threshold
    }
    
    logger.info(f"Fund resolution complete: {result}")
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
    
    parser = argparse.ArgumentParser(description="Run fund entity resolution")
    parser.add_argument(
        "--threshold", type=float, default=0.85,
        help="Minimum match probability threshold (default: 0.85)"
    )
    
    args = parser.parse_args()
    
    result = run_fund_resolution(threshold=args.threshold)
    print(json.dumps(result, indent=2))
