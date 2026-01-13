"""
Pydantic schemas for Clean Data API
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class SheetInfo(BaseModel):
    """Information about a single sheet within a dataset."""
    id: str
    name: str
    display_name: str
    row_count: int
    column_count: int


class DatasetInfo(BaseModel):
    """Information about a dataset (Excel file)."""
    id: str
    name: str
    description: str
    icon: str
    sheets: List[SheetInfo]


class ColumnMetadataResponse(BaseModel):
    """Column metadata for display configuration."""
    key: str               # JSONB key (snake_case)
    name: str              # Original display name
    index: int             # Column order
    data_type: str         # string, number, date, boolean
    is_visible: bool       # Default visibility
    width: Optional[int]   # Suggested width


class SheetDataResponse(BaseModel):
    """Paginated response for sheet data."""
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    pages: int
    columns: List[ColumnMetadataResponse]


class DatasetListResponse(BaseModel):
    """Response for listing all datasets."""
    datasets: List[DatasetInfo]


# =============================================================================
# Dataset Configuration
# =============================================================================

DATASET_CONFIG = {
    "gp-dataset": DatasetInfo(
        id="gp-dataset",
        name="GP Dataset",
        description="General Partner firm data from Preqin",
        icon="building2",
        sheets=[
            SheetInfo(
                id="firms",
                name="Preqin_Export",
                display_name="GP Firms",
                row_count=43744,
                column_count=131
            ),
            SheetInfo(
                id="contacts",
                name="Contacts_Export",
                display_name="GP Contacts",
                row_count=291386,
                column_count=18
            ),
        ]
    ),
    "lp-dataset": DatasetInfo(
        id="lp-dataset",
        name="LP Dataset",
        description="Limited Partner investor data from Preqin",
        icon="users",
        sheets=[
            SheetInfo(
                id="investors",
                name="Preqin_Export",
                display_name="LP Investors",
                row_count=32065,
                column_count=215
            ),
            SheetInfo(
                id="contacts",
                name="Contacts_Export",
                display_name="LP Contacts",
                row_count=239796,
                column_count=18
            ),
        ]
    ),
    "deals-dataset": DatasetInfo(
        id="deals-dataset",
        name="Deals Export",
        description="Private market transactions from Preqin",
        icon="arrow-left-right",
        sheets=[
            SheetInfo(
                id="deals",
                name="Preqin_Export",
                display_name="Deals",
                row_count=834321,
                column_count=40
            ),
        ]
    ),
    "funds-dataset": DatasetInfo(
        id="funds-dataset",
        name="Private Market Funds",
        description="Fund information and performance from Preqin",
        icon="briefcase",
        sheets=[
            SheetInfo(
                id="funds",
                name="Preqin_Export",
                display_name="Funds",
                row_count=82962,
                column_count=133
            ),
            SheetInfo(
                id="contacts",
                name="Contacts_Export",
                display_name="Fund Contacts",
                row_count=186163,
                column_count=17
            ),
        ]
    ),
}


# =============================================================================
# Default Visible Columns by Dataset/Sheet
# =============================================================================

DEFAULT_VISIBLE_COLUMNS = {
    "gp-dataset": {
        "firms": [
            "firm_name", "firm_type", "country", "city",
            "aum_usd_mn", "dry_powder_usd_mn",
            "primary_strategy", "total_funds", "website", "last_updated"
        ],
        "contacts": ["name", "fund_manager", "job_title", "email", "linkedin"],
    },
    "lp-dataset": {
        "investors": [
            "firm_name", "institution_type", "country", "city",
            "aum_usd_mn", "pe_allocation_usd_mn", "year_est",
            "investment_strategy", "total_commitments", "website", "last_updated"
        ],
        "contacts": ["name", "investor", "job_title", "email", "linkedin"],
    },
    "deals-dataset": {
        "deals": [
            "deal_id", "portfolio_company", "deal_date", "deal_type",
            "deal_size_usd_mn", "investors_buyers_firms_funds", "country",
            "primary_industry", "stage", "deal_status"
        ],
    },
    "funds-dataset": {
        "funds": [
            "fund_id", "name", "firm_name", "vintage_inception_year",
            "fund_size_usd_mn", "target_size_usd_mn", "strategy", "status",
            "domicile", "primary_region_focus", "first_close_date", "final_close_date"
        ],
        "contacts": None,  # Show all (only 17 columns)
    },
}
