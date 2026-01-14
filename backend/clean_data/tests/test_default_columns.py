"""
Tests for default visible columns configuration.
TDD: Tests written first to verify DEFAULT_VISIBLE_COLUMNS configuration.
"""

import pytest
import sys
import importlib.util

# Load schemas module directly to avoid database dependencies from clean_data/__init__.py
spec = importlib.util.spec_from_file_location(
    "schemas",
    "/home/ubuntu/current_working_dir/investor-database.omegaintelligence.ai/backend/clean_data/schemas.py"
)
schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schemas)
DEFAULT_VISIBLE_COLUMNS = schemas.DEFAULT_VISIBLE_COLUMNS


class TestGPDefaultColumns:
    """Test GP dataset default columns configuration."""

    def test_gp_firms_has_background_column(self):
        """GP firms should have 'background' in default visible columns."""
        gp_firms_columns = DEFAULT_VISIBLE_COLUMNS["gp-dataset"]["firms"]
        assert "background" in gp_firms_columns, "background column should be in GP firms default columns"

    def test_gp_firms_column_order_city_background_country(self):
        """GP firms should have columns in order: city -> background -> country."""
        gp_firms_columns = DEFAULT_VISIBLE_COLUMNS["gp-dataset"]["firms"]

        city_index = gp_firms_columns.index("city")
        background_index = gp_firms_columns.index("background")
        country_index = gp_firms_columns.index("country")

        assert city_index < background_index, "city should come before background"
        assert background_index < country_index, "background should come before country"
        assert background_index == city_index + 1, "background should be immediately after city"
        assert country_index == background_index + 1, "country should be immediately after background"


class TestLPDefaultColumns:
    """Test LP dataset default columns configuration."""

    def test_lp_investors_has_background_column(self):
        """LP investors should have 'background' in default visible columns."""
        lp_investors_columns = DEFAULT_VISIBLE_COLUMNS["lp-dataset"]["investors"]
        assert "background" in lp_investors_columns, "background column should be in LP investors default columns"

    def test_lp_investors_column_order_city_background_country(self):
        """LP investors should have columns in order: city -> background -> country."""
        lp_investors_columns = DEFAULT_VISIBLE_COLUMNS["lp-dataset"]["investors"]

        city_index = lp_investors_columns.index("city")
        background_index = lp_investors_columns.index("background")
        country_index = lp_investors_columns.index("country")

        assert city_index < background_index, "city should come before background"
        assert background_index < country_index, "background should come before country"
        assert background_index == city_index + 1, "background should be immediately after city"
        assert country_index == background_index + 1, "country should be immediately after background"


class TestColumnDisplayOrder:
    """Test that DEFAULT_VISIBLE_COLUMNS specifies correct column order for display."""

    def test_lp_investors_firm_name_before_city(self):
        """LP investors config should have firm_name before city."""
        lp_config = DEFAULT_VISIBLE_COLUMNS["lp-dataset"]["investors"]
        firm_name_idx = lp_config.index("firm_name")
        city_idx = lp_config.index("city")
        assert firm_name_idx < city_idx, "firm_name should come before city"

    def test_lp_investors_display_order(self):
        """LP investors should have display order: firm_name -> ... -> city -> background -> country."""
        lp_config = DEFAULT_VISIBLE_COLUMNS["lp-dataset"]["investors"]

        firm_name_idx = lp_config.index("firm_name")
        city_idx = lp_config.index("city")
        background_idx = lp_config.index("background")
        country_idx = lp_config.index("country")

        # Verify the intended display order
        assert firm_name_idx < city_idx < background_idx < country_idx, \
            f"Expected order: firm_name({firm_name_idx}) < city({city_idx}) < background({background_idx}) < country({country_idx})"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
