"""
Seed script to populate the database with portfolio company data.
Contains portfolio companies for all seeded funds.
"""

import sys
import os
from uuid import uuid4
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import SessionLocal, engine
from database.models import Base, Fund, PortfolioCompany


def parse_valuation(valuation_str: str) -> float:
    """Parse valuation string like '$1.98B' to numeric value"""
    if not valuation_str:
        return None

    # Remove $ and spaces
    val = valuation_str.replace('$', '').replace(',', '').strip()

    multipliers = {
        'B': 1_000_000_000,
        'M': 1_000_000,
        'K': 1_000,
    }

    for suffix, mult in multipliers.items():
        if val.upper().endswith(suffix):
            try:
                return float(val[:-1]) * mult
            except ValueError:
                return None

    try:
        return float(val)
    except ValueError:
        return None


def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        return None


# Portfolio data for DST Global
DST_GLOBAL_COMPANIES = [
    {"name": "Console Systems", "sector": "Enterprise Software", "stage": "Series B", "location": "Tel Aviv, Israel", "investmentDate": "2025-09-16", "valuation": "$23.00M", "status": "Active", "description": "Enterprise software solutions for business productivity"},
    {"name": "Mistral AI", "sector": "Enterprise Software", "stage": "Series B", "location": "San Francisco, CA", "investmentDate": "2025-09-08", "valuation": "$1.98B", "status": "Active", "description": "Leading AI company developing frontier large language models"},
    {"name": "Chai Discovery", "sector": "HealthTech", "stage": "Series B", "location": "New York, NY", "investmentDate": "2025-08-06", "valuation": "$70.00M", "status": "Active", "description": "Healthcare technology and medical solutions"},
    {"name": "Laurel", "sector": "Enterprise Software", "stage": "Series B", "location": "Austin, TX", "investmentDate": "2025-07-02", "valuation": "$100.00M", "status": "Active", "description": "AI-powered time tracking for professional services"},
    {"name": "Paraform", "sector": "Human Capital Services", "stage": "Series B", "location": "Singapore", "investmentDate": "2025-06-24", "valuation": "$20.00M", "status": "Active", "description": "Recruiting marketplace connecting companies with recruiters"},
    {"name": "Harvey", "sector": "Enterprise Software", "stage": "Series B", "location": "San Francisco, CA", "investmentDate": "2025-06-23", "valuation": "$300.00M", "status": "Active", "description": "AI-powered legal assistant for law firms"},
    {"name": "Wayflyer", "sector": "Specialized Finance", "stage": "Series B", "location": "Dublin, Ireland", "investmentDate": "2025-06-23", "valuation": "$185.00M", "status": "Active", "description": "Revenue-based financing for e-commerce businesses"},
    {"name": "Nabla", "sector": "HealthTech", "stage": "Series B", "location": "Paris, France", "investmentDate": "2025-06-17", "valuation": "$79.68M", "status": "Active", "description": "AI copilot for healthcare professionals"},
    {"name": "Glean", "sector": "Enterprise Software", "stage": "Series D", "location": "Palo Alto, CA", "investmentDate": "2025-06-10", "valuation": "$4.60B", "status": "Active", "description": "Enterprise search and knowledge management platform"},
    {"name": "Anysphere", "sector": "IT Services", "stage": "Series B", "location": "San Francisco, CA", "investmentDate": "2025-06-05", "valuation": "$900.00M", "status": "Active", "description": "AI-native IDE and coding assistant (Cursor)"},
    {"name": "Airwallex", "sector": "FinTech", "stage": "Series E", "location": "Melbourne, Australia", "investmentDate": "2025-05-21", "valuation": "$5.50B", "status": "Active", "description": "Global financial infrastructure for modern businesses"},
    {"name": "Safe Superintelligence", "sector": "AI/ML", "stage": "Growth", "location": "Palo Alto, CA", "investmentDate": "2025-04-11", "valuation": "$2.00B", "status": "Active", "description": "Building safe AI systems focused on alignment"},
    {"name": "Pennylane", "sector": "FinTech", "stage": "Series B", "location": "Paris, France", "investmentDate": "2025-04-06", "valuation": "$81.53M", "status": "Active", "description": "All-in-one financial management platform for SMBs"},
    {"name": "RedotPay", "sector": "FinTech", "stage": "Growth", "location": "Hong Kong", "investmentDate": "2025-03-14", "valuation": "$40.00M", "status": "Active", "description": "Crypto payment solutions and infrastructure"},
    {"name": "Zolve", "sector": "FinTech", "stage": "Series B", "location": "Bangalore, India", "investmentDate": "2025-03-11", "valuation": "$251.00M", "status": "Active", "description": "Cross-border banking for immigrants"},
    {"name": "Mercor", "sector": "Enterprise Software", "stage": "Growth", "location": "San Francisco, CA", "investmentDate": "2025-02-20", "valuation": "$100.00M", "status": "Active", "description": "AI-powered talent sourcing platform"},
    {"name": "Quince", "sector": "E-Commerce", "stage": "Series B", "location": "San Francisco, CA", "investmentDate": "2025-01-29", "valuation": "$71.80M", "status": "Active", "description": "Direct-to-consumer luxury goods at affordable prices"},
    {"name": "Tomo", "sector": "FinTech", "stage": "Series B", "location": "New York, NY", "investmentDate": "2025-01-15", "valuation": "$85.00M", "status": "Active", "description": "Digital mortgage lender for homebuyers"},
    {"name": "Abridge", "sector": "HealthTech", "stage": "Series C", "location": "Pittsburgh, PA", "investmentDate": "2024-11-20", "valuation": "$850.00M", "status": "Active", "description": "AI-powered clinical documentation"},
    {"name": "Wiz", "sector": "Cybersecurity", "stage": "Series E", "location": "New York, NY", "investmentDate": "2024-10-15", "valuation": "$12.00B", "status": "Active", "description": "Cloud security platform"},
]

# Portfolio data for MegaDelta Capital
MEGADELTA_CAPITAL_COMPANIES = [
    {"name": "TechFlow Analytics", "sector": "Enterprise Software", "stage": "Series A", "location": "Boston, MA", "investmentDate": "2024-08-15", "valuation": "$45.00M", "status": "Active", "description": "Analytics platform for enterprise data management"},
    {"name": "CloudNine Security", "sector": "Cybersecurity", "stage": "Series B", "location": "Austin, TX", "investmentDate": "2024-06-20", "valuation": "$120.00M", "status": "Active", "description": "Cloud-native security operations platform"},
    {"name": "DataMesh", "sector": "Data Infrastructure", "stage": "Series A", "location": "San Francisco, CA", "investmentDate": "2024-05-10", "valuation": "$35.00M", "status": "Active", "description": "Unified data mesh architecture platform"},
    {"name": "PayStream", "sector": "FinTech", "stage": "Series B", "location": "New York, NY", "investmentDate": "2024-03-22", "valuation": "$200.00M", "status": "Active", "description": "B2B payments infrastructure"},
    {"name": "HealthSync", "sector": "HealthTech", "stage": "Series A", "location": "Chicago, IL", "investmentDate": "2024-02-15", "valuation": "$55.00M", "status": "Active", "description": "Healthcare data interoperability platform"},
    {"name": "DevOpsAI", "sector": "Developer Tools", "stage": "Series B", "location": "Seattle, WA", "investmentDate": "2024-01-08", "valuation": "$150.00M", "status": "Active", "description": "AI-powered DevOps automation"},
    {"name": "RetailEdge", "sector": "Retail Tech", "stage": "Series A", "location": "Los Angeles, CA", "investmentDate": "2023-11-30", "valuation": "$40.00M", "status": "Active", "description": "AI-powered retail analytics and optimization"},
    {"name": "SupplyChainOS", "sector": "Supply Chain", "stage": "Series B", "location": "Atlanta, GA", "investmentDate": "2023-10-15", "valuation": "$180.00M", "status": "Active", "description": "Supply chain management and visibility platform"},
    {"name": "LegalAI", "sector": "LegalTech", "stage": "Series A", "location": "San Francisco, CA", "investmentDate": "2023-09-05", "valuation": "$65.00M", "status": "Active", "description": "AI contract analysis and legal workflow automation"},
    {"name": "GreenEnergy", "sector": "CleanTech", "stage": "Series B", "location": "Denver, CO", "investmentDate": "2023-08-20", "valuation": "$95.00M", "status": "Active", "description": "Renewable energy management platform"},
]

# Portfolio data for Raptor Group
RAPTOR_GROUP_COMPANIES = [
    {"name": "MediaStream", "sector": "Media Tech", "stage": "Series B", "location": "Los Angeles, CA", "investmentDate": "2024-07-12", "valuation": "$85.00M", "status": "Active", "description": "Streaming media infrastructure and analytics"},
    {"name": "ConsumerDirect", "sector": "E-Commerce", "stage": "Series A", "location": "New York, NY", "investmentDate": "2024-05-18", "valuation": "$50.00M", "status": "Active", "description": "D2C brand building and e-commerce platform"},
    {"name": "SportsTech Pro", "sector": "Sports Tech", "stage": "Series B", "location": "Miami, FL", "investmentDate": "2024-04-10", "valuation": "$120.00M", "status": "Active", "description": "Fan engagement and sports analytics platform"},
    {"name": "AdTech360", "sector": "Advertising", "stage": "Series A", "location": "San Francisco, CA", "investmentDate": "2024-02-25", "valuation": "$38.00M", "status": "Active", "description": "Programmatic advertising optimization"},
    {"name": "ContentAI", "sector": "Media Tech", "stage": "Series B", "location": "Austin, TX", "investmentDate": "2023-12-15", "valuation": "$75.00M", "status": "Active", "description": "AI-powered content creation and distribution"},
    {"name": "SocialCommerce", "sector": "E-Commerce", "stage": "Series A", "location": "Los Angeles, CA", "investmentDate": "2023-10-20", "valuation": "$42.00M", "status": "Active", "description": "Social shopping and creator commerce platform"},
]

# Portfolio data for Edelweiss Alternatives
EDELWEISS_ALTERNATIVES_COMPANIES = [
    {"name": "IndiaStack", "sector": "FinTech", "stage": "Series C", "location": "Mumbai, India", "investmentDate": "2024-08-05", "valuation": "$280.00M", "status": "Active", "description": "Digital financial infrastructure for India"},
    {"name": "AgroTech India", "sector": "AgTech", "stage": "Series B", "location": "Bangalore, India", "investmentDate": "2024-06-10", "valuation": "$95.00M", "status": "Active", "description": "Agricultural technology and farm management"},
    {"name": "RealEstate360", "sector": "PropTech", "stage": "Series B", "location": "Delhi, India", "investmentDate": "2024-04-22", "valuation": "$150.00M", "status": "Active", "description": "Real estate investment and management platform"},
    {"name": "EduLearn", "sector": "EdTech", "stage": "Series A", "location": "Pune, India", "investmentDate": "2024-02-18", "valuation": "$45.00M", "status": "Active", "description": "Online education and skill development"},
    {"name": "HealthBridge", "sector": "HealthTech", "stage": "Series B", "location": "Chennai, India", "investmentDate": "2023-11-30", "valuation": "$110.00M", "status": "Active", "description": "Healthcare access and telemedicine platform"},
]

# Portfolio data for McRock Capital (IIoT focused)
MCROCK_CAPITAL_COMPANIES = [
    {"name": "IndustrialIQ", "sector": "Industrial IoT", "stage": "Series B", "location": "Toronto, Canada", "investmentDate": "2024-09-01", "valuation": "$65.00M", "status": "Active", "description": "Industrial intelligence and predictive maintenance"},
    {"name": "SensorNet", "sector": "Industrial IoT", "stage": "Series A", "location": "Vancouver, Canada", "investmentDate": "2024-07-15", "valuation": "$28.00M", "status": "Active", "description": "Industrial sensor networks and edge computing"},
    {"name": "FactoryOS", "sector": "Manufacturing", "stage": "Series B", "location": "Detroit, MI", "investmentDate": "2024-05-20", "valuation": "$90.00M", "status": "Active", "description": "Smart factory operating system"},
    {"name": "EnergyMesh", "sector": "Energy Tech", "stage": "Series A", "location": "Calgary, Canada", "investmentDate": "2024-03-10", "valuation": "$35.00M", "status": "Active", "description": "Energy management and grid optimization"},
    {"name": "LogisticsAI", "sector": "Supply Chain", "stage": "Series B", "location": "Chicago, IL", "investmentDate": "2024-01-25", "valuation": "$78.00M", "status": "Active", "description": "AI-powered logistics and fleet management"},
    {"name": "MiningTech", "sector": "Industrial IoT", "stage": "Series A", "location": "Perth, Australia", "investmentDate": "2023-10-30", "valuation": "$42.00M", "status": "Active", "description": "Mining automation and safety systems"},
    {"name": "WaterTech", "sector": "CleanTech", "stage": "Series B", "location": "Singapore", "investmentDate": "2023-08-15", "valuation": "$55.00M", "status": "Active", "description": "Water management and quality monitoring"},
]

# Portfolio data for 361 Capital
THREE_SIXTY_ONE_CAPITAL_COMPANIES = [
    {"name": "QuantAlpha", "sector": "FinTech", "stage": "Series B", "location": "New York, NY", "investmentDate": "2024-08-20", "valuation": "$175.00M", "status": "Active", "description": "Quantitative trading strategies and risk management"},
    {"name": "AlgoTrade", "sector": "FinTech", "stage": "Series A", "location": "Chicago, IL", "investmentDate": "2024-06-12", "valuation": "$48.00M", "status": "Active", "description": "Algorithmic trading infrastructure"},
    {"name": "RiskMetrics", "sector": "FinTech", "stage": "Series B", "location": "Boston, MA", "investmentDate": "2024-04-05", "valuation": "$92.00M", "status": "Active", "description": "Risk analytics and portfolio optimization"},
    {"name": "DataVault", "sector": "Data Infrastructure", "stage": "Series A", "location": "San Francisco, CA", "investmentDate": "2024-02-28", "valuation": "$55.00M", "status": "Active", "description": "Alternative data platform for institutional investors"},
    {"name": "MarketSignals", "sector": "FinTech", "stage": "Series B", "location": "Greenwich, CT", "investmentDate": "2023-12-10", "valuation": "$130.00M", "status": "Active", "description": "Market sentiment analysis and trading signals"},
]

# Portfolio data for additional seeded funds
SEQUOIA_CAPITAL_COMPANIES = [
    {"name": "Stripe", "sector": "FinTech", "stage": "Growth", "location": "San Francisco, CA", "investmentDate": "2014-01-15", "valuation": "$50.00B", "status": "Active", "description": "Online payment processing for businesses"},
    {"name": "Databricks", "sector": "Data Infrastructure", "stage": "Series I", "location": "San Francisco, CA", "investmentDate": "2021-08-31", "valuation": "$43.00B", "status": "Active", "description": "Unified analytics platform for data and AI"},
    {"name": "Klarna", "sector": "FinTech", "stage": "Growth", "location": "Stockholm, Sweden", "investmentDate": "2019-08-05", "valuation": "$6.70B", "status": "Active", "description": "Buy now, pay later payment solutions"},
    {"name": "Nubank", "sector": "FinTech", "stage": "IPO", "location": "Sao Paulo, Brazil", "investmentDate": "2018-10-15", "valuation": "$45.00B", "status": "IPO", "description": "Digital banking platform"},
    {"name": "Figma", "sector": "Design Tools", "stage": "Acquired", "location": "San Francisco, CA", "investmentDate": "2020-04-20", "valuation": "$20.00B", "status": "Exited", "description": "Collaborative design platform"},
]

ANDREESSEN_HOROWITZ_COMPANIES = [
    {"name": "Coinbase", "sector": "FinTech", "stage": "IPO", "location": "San Francisco, CA", "investmentDate": "2013-05-10", "valuation": "$8.50B", "status": "IPO", "description": "Cryptocurrency exchange platform"},
    {"name": "Roblox", "sector": "Gaming", "stage": "IPO", "location": "San Mateo, CA", "investmentDate": "2018-09-15", "valuation": "$22.00B", "status": "IPO", "description": "Online gaming and game creation platform"},
    {"name": "OpenSea", "sector": "Web3", "stage": "Series C", "location": "New York, NY", "investmentDate": "2022-01-05", "valuation": "$13.30B", "status": "Active", "description": "NFT marketplace"},
    {"name": "Substack", "sector": "Media Tech", "stage": "Series B", "location": "San Francisco, CA", "investmentDate": "2021-03-30", "valuation": "$650.00M", "status": "Active", "description": "Newsletter publishing platform"},
    {"name": "Notion", "sector": "Productivity", "stage": "Series C", "location": "San Francisco, CA", "investmentDate": "2021-10-08", "valuation": "$10.00B", "status": "Active", "description": "All-in-one workspace and productivity tool"},
]

TIGER_GLOBAL_COMPANIES = [
    {"name": "Checkout.com", "sector": "FinTech", "stage": "Series D", "location": "London, UK", "investmentDate": "2022-01-11", "valuation": "$40.00B", "status": "Active", "description": "Payment processing platform"},
    {"name": "Brex", "sector": "FinTech", "stage": "Series D", "location": "San Francisco, CA", "investmentDate": "2021-10-05", "valuation": "$12.30B", "status": "Active", "description": "Corporate cards and spend management"},
    {"name": "Discord", "sector": "Social", "stage": "Series H", "location": "San Francisco, CA", "investmentDate": "2021-03-15", "valuation": "$15.00B", "status": "Active", "description": "Voice, video, and text communication platform"},
    {"name": "Canva", "sector": "Design Tools", "stage": "Growth", "location": "Sydney, Australia", "investmentDate": "2021-09-14", "valuation": "$40.00B", "status": "Active", "description": "Online design and visual communication platform"},
    {"name": "Rapyd", "sector": "FinTech", "stage": "Series E", "location": "London, UK", "investmentDate": "2021-08-04", "valuation": "$8.75B", "status": "Active", "description": "Global fintech-as-a-service platform"},
]

SOFTBANK_VISION_FUND_COMPANIES = [
    {"name": "ByteDance", "sector": "Social Media", "stage": "Growth", "location": "Beijing, China", "investmentDate": "2018-10-25", "valuation": "$220.00B", "status": "Active", "description": "Parent company of TikTok and Douyin"},
    {"name": "DoorDash", "sector": "Delivery", "stage": "IPO", "location": "San Francisco, CA", "investmentDate": "2019-05-30", "valuation": "$39.00B", "status": "IPO", "description": "Food delivery and logistics platform"},
    {"name": "Coupang", "sector": "E-Commerce", "stage": "IPO", "location": "Seoul, South Korea", "investmentDate": "2018-11-15", "valuation": "$60.00B", "status": "IPO", "description": "E-commerce marketplace"},
    {"name": "Grab", "sector": "Super App", "stage": "IPO", "location": "Singapore", "investmentDate": "2019-03-06", "valuation": "$14.00B", "status": "IPO", "description": "Southeast Asian super app"},
    {"name": "WeWork", "sector": "Real Estate", "stage": "IPO", "location": "New York, NY", "investmentDate": "2017-08-24", "valuation": "$9.00B", "status": "IPO", "description": "Flexible workspace provider"},
]


# Map fund names to their portfolio data
FUND_PORTFOLIOS = {
    "DST Global": DST_GLOBAL_COMPANIES,
    "MegaDelta Capital": MEGADELTA_CAPITAL_COMPANIES,
    "Raptor Group": RAPTOR_GROUP_COMPANIES,
    "Edelweiss Alternatives": EDELWEISS_ALTERNATIVES_COMPANIES,
    "McRock Capital": MCROCK_CAPITAL_COMPANIES,
    "361 Capital": THREE_SIXTY_ONE_CAPITAL_COMPANIES,
    "Sequoia Capital": SEQUOIA_CAPITAL_COMPANIES,
    "Andreessen Horowitz": ANDREESSEN_HOROWITZ_COMPANIES,
    "Tiger Global": TIGER_GLOBAL_COMPANIES,
    "SoftBank Vision Fund": SOFTBANK_VISION_FUND_COMPANIES,
}


def seed_portfolio_companies():
    """Seed the database with portfolio company data."""
    print("Creating database tables if not exist...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if portfolio data already exists
        existing_companies = db.query(PortfolioCompany).count()
        if existing_companies > 0:
            print(f"Database already has {existing_companies} portfolio companies. Skipping seed.")
            return

        # Get all funds
        funds = db.query(Fund).all()
        fund_map = {fund.name: fund.id for fund in funds}

        total_companies = 0

        for fund_name, companies in FUND_PORTFOLIOS.items():
            fund_id = fund_map.get(fund_name)

            if not fund_id:
                print(f"  Warning: Fund '{fund_name}' not found in database, skipping...")
                continue

            print(f"Seeding portfolio for {fund_name}...")

            for company_data in companies:
                company = PortfolioCompany(
                    id=str(uuid4()),
                    fund_id=fund_id,
                    fund_name=fund_name,
                    name=company_data["name"],
                    sector=company_data.get("sector"),
                    stage=company_data.get("stage"),
                    location=company_data.get("location"),
                    description=company_data.get("description"),
                    investment_date=parse_date(company_data.get("investmentDate")),
                    valuation_raw=company_data.get("valuation"),
                    valuation=parse_valuation(company_data.get("valuation")),
                    status=company_data.get("status", "Active")
                )
                db.add(company)
                total_companies += 1

            db.commit()
            print(f"  Added {len(companies)} companies for {fund_name}")

        print(f"\nPortfolio seeding complete! Added {total_companies} companies total.")

    except Exception as e:
        print(f"Error seeding portfolio: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_portfolio_companies()
