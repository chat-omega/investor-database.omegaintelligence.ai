"""
Tests for column management endpoints in Clean Data routes.
TDD approach: Write tests first, then implement endpoints.
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

# Import the FastAPI app and database dependencies
import sys
sys.path.insert(0, '/home/ubuntu/current_working_dir/investor-database.omegaintelligence.ai/backend')

from main import app
from clean_data.database import get_clean_data_db, CleanDataBase
from clean_data.models import ExportSession


# Test fixtures
@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    mock_session = MagicMock()
    return mock_session


@pytest.fixture
def sample_export_session():
    """Create a sample export session for testing."""
    return {
        "id": str(uuid.uuid4()),
        "name": "Test Export",
        "source_dataset": "gp-dataset",
        "source_sheet": "firms",
        "custom_columns": [],
        "row_count": 50,
    }


@pytest.fixture
def client(mock_db_session):
    """Create a test client with mocked database."""
    def override_get_db():
        yield mock_db_session

    app.dependency_overrides[get_clean_data_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


class TestColumnManagementEndpoints:
    """Test suite for column management endpoints."""

    def test_get_export_columns_returns_custom_columns(self, client, mock_db_session, sample_export_session):
        """GET /exports/{id}/columns should return custom column configuration."""
        # Setup mock
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = [
            {"key": "custom_col_1", "name": "Custom Column 1", "type": "text", "source": "user"}
        ]
        mock_session.visible_columns = ["name", "country"]
        mock_session.source_dataset = "gp-dataset"
        mock_session.source_sheet = "firms"

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        # Execute
        response = client.get(f"/api/clean-data/exports/{sample_export_session['id']}/columns")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "custom_columns" in data
        assert len(data["custom_columns"]) == 1
        assert data["custom_columns"][0]["key"] == "custom_col_1"

    def test_add_custom_column_success(self, client, mock_db_session, sample_export_session):
        """POST /exports/{id}/columns should add a new custom column."""
        # Setup mock
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        # Execute
        response = client.post(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns",
            json={
                "name": "CEO Name",
                "type": "text"
            }
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "CEO Name"
        assert "key" in data
        assert data["type"] == "text"
        assert data["source"] == "user"

    def test_add_custom_column_generates_unique_key(self, client, mock_db_session, sample_export_session):
        """Adding column should generate a unique snake_case key."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.post(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns",
            json={"name": "Company Revenue", "type": "number"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "company_revenue"

    def test_add_duplicate_column_name_appends_number(self, client, mock_db_session, sample_export_session):
        """Adding duplicate column name should append unique suffix."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = [
            {"key": "ceo_name", "name": "CEO Name", "type": "text", "source": "user"}
        ]

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.post(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns",
            json={"name": "CEO Name", "type": "text"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "ceo_name_2"

    def test_add_column_validation_requires_name(self, client, mock_db_session, sample_export_session):
        """Adding column without name should fail validation."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.post(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns",
            json={"type": "text"}  # Missing name
        )

        assert response.status_code == 422  # Validation error

    def test_delete_custom_column_success(self, client, mock_db_session, sample_export_session):
        """DELETE /exports/{id}/columns/{key} should remove a custom column."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = [
            {"key": "ceo_name", "name": "CEO Name", "type": "text", "source": "user"}
        ]

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.delete(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns/ceo_name"
        )

        assert response.status_code == 200
        assert mock_db_session.commit.called

    def test_delete_nonexistent_column_returns_404(self, client, mock_db_session, sample_export_session):
        """Deleting non-existent column should return 404."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.delete(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns/nonexistent"
        )

        assert response.status_code == 404

    def test_rename_custom_column_success(self, client, mock_db_session, sample_export_session):
        """PATCH /exports/{id}/columns/{key} should rename a column."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = [
            {"key": "ceo_name", "name": "CEO Name", "type": "text", "source": "user"}
        ]

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.patch(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns/ceo_name",
            json={"name": "Chief Executive"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Chief Executive"
        assert data["key"] == "ceo_name"  # Key should not change

    def test_get_columns_for_nonexistent_export_returns_404(self, client, mock_db_session):
        """Getting columns for non-existent export should return 404."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        response = client.get(f"/api/clean-data/exports/{uuid.uuid4()}/columns")

        assert response.status_code == 404

    def test_add_enriched_column_type(self, client, mock_db_session, sample_export_session):
        """Adding enriched column should include enrichment metadata."""
        mock_session = MagicMock()
        mock_session.id = uuid.UUID(sample_export_session["id"])
        mock_session.custom_columns = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_session

        response = client.post(
            f"/api/clean-data/exports/{sample_export_session['id']}/columns",
            json={
                "name": "CEO Name",
                "type": "enriched",
                "enrichment_prompt": "Who is the CEO of this company?"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "enriched"
        assert data["source"] == "parallel"
        assert data["enrichment_prompt"] == "Who is the CEO of this company?"


class TestColumnDataOperations:
    """Test suite for column data operations."""

    def test_get_export_data_includes_custom_column_values(self, client, mock_db_session, sample_export_session):
        """Export data should include values from custom columns."""
        # This test verifies that when fetching export data,
        # custom column values are merged with source data
        pass  # Will implement when export data endpoint is updated

    def test_update_custom_column_value(self, client, mock_db_session, sample_export_session):
        """Should be able to update a specific cell value in custom column."""
        pass  # Will implement when we add cell editing


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
