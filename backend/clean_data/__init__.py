"""
Clean Data Layer Module

Provides storage and API access to cleaned Preqin Excel data.
"""

from clean_data.routes import router as clean_data_router

__all__ = ["clean_data_router"]
