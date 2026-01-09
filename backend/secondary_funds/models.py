"""SQLAlchemy models for secondary funds database."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class FundStatus(Base):
    """Fund status lookup table."""
    __tablename__ = "fund_status"

    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class Strategy(Base):
    """Investment strategy lookup table."""
    __tablename__ = "strategy"

    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class Sector(Base):
    """Investment sector lookup table."""
    __tablename__ = "sector"

    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class InstitutionType(Base):
    """Institution type lookup table."""
    __tablename__ = "institution_type"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class SecondaryGP(Base):
    """General Partner - fund managers in secondary market."""
    __tablename__ = "gp"

    id = Column(Integer, primary_key=True)
    institution_name = Column(String(300), nullable=False, unique=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    institution_type_id = Column(Integer, ForeignKey("institution_type.id"), nullable=True)
    aum_usd = Column(Numeric(18, 2), nullable=True)
    aum_raw = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    institution_type = relationship("InstitutionType", lazy="joined")
    funds = relationship("SecondaryFund", back_populates="gp", lazy="dynamic")


class SecondaryLP(Base):
    """Limited Partner - institutional investors in secondary funds."""
    __tablename__ = "lp"

    id = Column(Integer, primary_key=True)
    institution_name = Column(String(300), nullable=False)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    institution_type_id = Column(Integer, ForeignKey("institution_type.id"), nullable=True)
    aum_usd = Column(Numeric(18, 2), nullable=True)
    aum_raw = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    institution_type = relationship("InstitutionType", lazy="joined")


class SecondaryFund(Base):
    """Secondary fund model."""
    __tablename__ = "fund"

    id = Column(Integer, primary_key=True)
    fund_name = Column(String(500), nullable=False)
    gp_id = Column(Integer, ForeignKey("gp.id"), nullable=True)
    status_id = Column(Integer, ForeignKey("fund_status.id"), nullable=False)

    # Temporal fields
    vintage_year = Column(Integer, nullable=True)
    fund_close_year = Column(Integer, nullable=True)
    launch_year = Column(Integer, nullable=True)

    # Size fields (normalized to USD millions)
    fund_size_usd = Column(Numeric(18, 2), nullable=True)
    fund_size_raw = Column(String(50), nullable=True)
    target_size_usd = Column(Numeric(18, 2), nullable=True)
    target_size_raw = Column(String(50), nullable=True)

    # Performance metrics
    dpi = Column(Numeric(6, 3), nullable=True)
    tvpi = Column(Numeric(6, 3), nullable=True)
    irr = Column(Numeric(6, 2), nullable=True)

    # Data provenance
    data_source = Column(Text, nullable=True)
    last_reporting_date = Column(Date, nullable=True)
    source_file = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    gp = relationship("SecondaryGP", back_populates="funds", lazy="joined")
    status = relationship("FundStatus", lazy="joined")
    strategies = relationship("FundStrategy", back_populates="fund", lazy="joined")
    sectors = relationship("FundSector", back_populates="fund", lazy="joined")


class FundStrategy(Base):
    """Many-to-many: Fund to Strategy association."""
    __tablename__ = "fund_strategy"

    fund_id = Column(Integer, ForeignKey("fund.id", ondelete="CASCADE"), primary_key=True)
    strategy_id = Column(Integer, ForeignKey("strategy.id"), primary_key=True)

    # Relationships
    fund = relationship("SecondaryFund", back_populates="strategies")
    strategy = relationship("Strategy", lazy="joined")


class FundSector(Base):
    """Many-to-many: Fund to Sector association."""
    __tablename__ = "fund_sector"

    fund_id = Column(Integer, ForeignKey("fund.id", ondelete="CASCADE"), primary_key=True)
    sector_id = Column(Integer, ForeignKey("sector.id"), primary_key=True)

    # Relationships
    fund = relationship("SecondaryFund", back_populates="sectors")
    sector = relationship("Sector", lazy="joined")
