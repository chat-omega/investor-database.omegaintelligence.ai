"""
SQLAlchemy models for the Investor Database
Compatible with both SQLite and MySQL
"""

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Index
from datetime import datetime
from database.db import Base


class Fund(Base):
    """
    Fund model for storing investment fund information in the database.

    Stores fund details including AUM (both raw string and parsed numeric value),
    strategy, and portfolio relationships.
    """
    __tablename__ = "funds"

    # Primary fields
    id = Column(String(36), primary_key=True)  # UUID or slug as string
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)

    # Fund details
    founded_year = Column(Integer, nullable=True)
    aum_raw = Column(String(50), nullable=True)  # e.g., "$500M"
    aum = Column(Float, nullable=True, index=True)  # e.g., 500000000.0
    strategy = Column(String(100), nullable=True, index=True)  # e.g., "Growth Equity", "Venture Capital"

    # Contact & location
    website = Column(String(255), nullable=True)
    headquarters = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Fund(id={self.id}, name={self.name}, strategy={self.strategy})>"


# Create indexes for fund queries
Index('idx_fund_strategy', Fund.strategy)
Index('idx_fund_aum', Fund.aum)


class LP(Base):
    """
    Limited Partner (LP) model for storing investor information.

    Tracks LPs, their details, and relationships with funds.
    Stores both raw string values and parsed numeric values for commitment amounts.
    """
    __tablename__ = "lps"

    # Primary fields
    id = Column(String(36), primary_key=True)  # UUID as string
    name = Column(String(255), nullable=False, unique=True, index=True)

    # Organization details
    type = Column(String(100), nullable=True, index=True)  # Individual, Family Office, Institution, Corporate, Foundation, Government, Other
    description = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)

    # Contact information
    primary_contact_name = Column(String(255), nullable=True)
    primary_contact_email = Column(String(255), nullable=True)
    primary_contact_phone = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True, index=True)  # City, Country

    # Investment details
    total_committed_capital_raw = Column(String(50), nullable=True)  # e.g., "$50M"
    total_committed_capital = Column(Float, nullable=True, index=True)  # e.g., 50000000.0
    investment_focus = Column(String(500), nullable=True)  # e.g., "Technology, Healthcare"
    first_investment_year = Column(Integer, nullable=True)

    # Relationship tracking
    relationship_status = Column(String(50), nullable=True, index=True)  # Active, Prospective, Inactive, Former
    tier = Column(String(20), nullable=True, index=True)  # Tier 1, Tier 2, Tier 3

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<LP(id={self.id}, name={self.name}, type={self.type})>"


class LPFundCommitment(Base):
    """
    LP-Fund commitment relationship tracking.

    Tracks specific commitments from LPs to funds, including commitment amounts
    and capital called.
    """
    __tablename__ = "lp_fund_commitments"

    id = Column(String(36), primary_key=True)  # UUID as string
    lp_id = Column(String(36), nullable=False, index=True)  # Foreign key to lps.id
    fund_id = Column(String(36), nullable=False, index=True)  # Foreign key to funds.id

    # Commitment details
    commitment_amount_raw = Column(String(50), nullable=True)  # e.g., "$10M"
    commitment_amount = Column(Float, nullable=True)  # e.g., 10000000.0
    commitment_date = Column(DateTime, nullable=True)

    # Capital called
    capital_called_raw = Column(String(50), nullable=True)  # e.g., "$7M"
    capital_called = Column(Float, nullable=True)  # e.g., 7000000.0

    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<LPFundCommitment(id={self.id}, lp_id={self.lp_id}, fund_id={self.fund_id})>"


# Create indexes for LP queries
Index('idx_lp_type_commitment', LP.type, LP.total_committed_capital)
Index('idx_lp_status', LP.relationship_status)
Index('idx_lp_tier', LP.tier)
Index('idx_commitment_lp_fund', LPFundCommitment.lp_id, LPFundCommitment.fund_id)


class LPHolding(Base):
    """
    LP Holdings model for storing portfolio holdings data.

    Tracks individual fund holdings with commitment, contribution, distribution,
    market value, and performance metrics. Can be linked to specific LPs or
    used as standalone portfolio holdings.
    """
    __tablename__ = "lp_holdings"

    # Primary fields
    id = Column(String(36), primary_key=True)  # UUID as string
    fund_id = Column(String(36), nullable=True, index=True)  # Foreign key to funds.id (optional)
    fund_name = Column(String(255), nullable=False, index=True)  # Denormalized for display

    # Fund details
    vintage = Column(Integer, nullable=True, index=True)  # Fund vintage year

    # Capital flows - raw string and parsed numeric
    capital_committed_raw = Column(String(50), nullable=True)  # e.g., "$50M"
    capital_committed = Column(Float, nullable=True, index=True)  # e.g., 50000000.0

    capital_contributed_raw = Column(String(50), nullable=True)  # e.g., "$35M"
    capital_contributed = Column(Float, nullable=True)  # e.g., 35000000.0

    capital_distributed_raw = Column(String(50), nullable=True)  # e.g., "$20M"
    capital_distributed = Column(Float, nullable=True)  # e.g., 20000000.0

    market_value_raw = Column(String(50), nullable=True)  # e.g., "$45M"
    market_value = Column(Float, nullable=True, index=True)  # e.g., 45000000.0

    # Performance metrics
    inception_irr = Column(Float, nullable=True)  # e.g., 15.5 (percentage)

    # Optional LP linkage
    lp_id = Column(String(36), nullable=True, index=True)  # Foreign key to lps.id (optional)
    lp_name = Column(String(255), nullable=True)  # Denormalized LP name

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<LPHolding(id={self.id}, fund_name={self.fund_name}, vintage={self.vintage})>"


# Create indexes for holdings queries
Index('idx_holding_fund', LPHolding.fund_id)
Index('idx_holding_lp', LPHolding.lp_id)
Index('idx_holding_vintage', LPHolding.vintage)
Index('idx_holding_value', LPHolding.market_value)
Index('idx_holding_irr', LPHolding.inception_irr)


class PortfolioCompany(Base):
    """
    Portfolio Company model for storing fund portfolio investments.

    Tracks companies that a fund has invested in, including investment details,
    valuation, and status.
    """
    __tablename__ = "portfolio_companies"

    # Primary fields
    id = Column(String(36), primary_key=True)  # UUID as string
    fund_id = Column(String(36), nullable=False, index=True)  # Foreign key to funds.id
    fund_name = Column(String(255), nullable=True)  # Denormalized fund name for display

    # Company details
    name = Column(String(255), nullable=False, index=True)
    sector = Column(String(100), nullable=True, index=True)
    stage = Column(String(50), nullable=True)  # Series A, Series B, Growth, IPO
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    logo_url = Column(String(512), nullable=True)

    # Investment details
    investment_date = Column(DateTime, nullable=True)
    valuation_raw = Column(String(50), nullable=True)  # e.g., "$2.5B"
    valuation = Column(Float, nullable=True, index=True)  # e.g., 2500000000.0

    # Status
    status = Column(String(20), default='Active', index=True)  # Active, Exited, IPO

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<PortfolioCompany(id={self.id}, name={self.name}, fund_id={self.fund_id})>"


# Create indexes for portfolio company queries
Index('idx_portfolio_fund', PortfolioCompany.fund_id)
Index('idx_portfolio_sector', PortfolioCompany.sector)
Index('idx_portfolio_status', PortfolioCompany.status)
Index('idx_portfolio_valuation', PortfolioCompany.valuation)
