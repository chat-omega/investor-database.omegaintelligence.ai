"""
Preqin Entity Resolution

Splink-based entity resolution for matching firms and funds across data sources.
Uses DuckDB backend for processing on dev instance, writes results to RDS.
"""

from .firm_linker import FirmLinker, run_firm_resolution
from .fund_linker import FundLinker, run_fund_resolution

__all__ = [
    "FirmLinker",
    "run_firm_resolution",
    "FundLinker",
    "run_fund_resolution",
]
