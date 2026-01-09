"""
Seed script to populate the database with sample fund data.
Run this script to add initial fund data to the investor-database.
"""

import sys
import os
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import SessionLocal, engine
from database.models import Base, Fund, LP, LPHolding

# Sample funds data based on original portfolio data
FUNDS_DATA = [
    {
        "name": "DST Global",
        "description": "Global technology investment fund focusing on high-growth internet companies worldwide.",
        "founded_year": 2009,
        "aum_raw": "$10B",
        "aum": 10000000000.0,
        "strategy": "Growth Equity",
        "website": "https://dst-global.com",
        "headquarters": "Hong Kong"
    },
    {
        "name": "MegaDelta Capital",
        "description": "Technology-focused venture capital and growth equity fund with investments in enterprise software and fintech.",
        "founded_year": 2015,
        "aum_raw": "$2.5B",
        "aum": 2500000000.0,
        "strategy": "Growth Equity",
        "website": "https://megadeltacapital.com",
        "headquarters": "San Francisco, CA"
    },
    {
        "name": "Raptor Group",
        "description": "Multi-stage investment firm focusing on technology and consumer companies.",
        "founded_year": 2005,
        "aum_raw": "$1.8B",
        "aum": 1800000000.0,
        "strategy": "Multi-Stage",
        "website": "https://raptorgroup.com",
        "headquarters": "New York, NY"
    },
    {
        "name": "Edelweiss Alternatives",
        "description": "Alternative investment fund specializing in private equity, real estate, and infrastructure.",
        "founded_year": 2008,
        "aum_raw": "$3.2B",
        "aum": 3200000000.0,
        "strategy": "Private Equity",
        "website": "https://edelweiss.in",
        "headquarters": "Mumbai, India"
    },
    {
        "name": "McRock Capital",
        "description": "Growth equity fund focused on Industrial Internet of Things (IIoT) companies.",
        "founded_year": 2012,
        "aum_raw": "$500M",
        "aum": 500000000.0,
        "strategy": "Growth Equity",
        "website": "https://mcrockcapital.com",
        "headquarters": "Toronto, Canada"
    },
    {
        "name": "361 Capital",
        "description": "Alternative investment manager focusing on quantitative strategies and portfolio solutions.",
        "founded_year": 2001,
        "aum_raw": "$4.1B",
        "aum": 4100000000.0,
        "strategy": "Quantitative",
        "website": "https://361capital.com",
        "headquarters": "Denver, CO"
    },
    {
        "name": "Sequoia Capital",
        "description": "Legendary venture capital firm that has backed companies like Apple, Google, and Airbnb.",
        "founded_year": 1972,
        "aum_raw": "$85B",
        "aum": 85000000000.0,
        "strategy": "Venture Capital",
        "website": "https://sequoiacap.com",
        "headquarters": "Menlo Park, CA"
    },
    {
        "name": "Andreessen Horowitz",
        "description": "Leading venture capital firm investing in bold entrepreneurs building the future.",
        "founded_year": 2009,
        "aum_raw": "$35B",
        "aum": 35000000000.0,
        "strategy": "Venture Capital",
        "website": "https://a16z.com",
        "headquarters": "Menlo Park, CA"
    },
    {
        "name": "Tiger Global",
        "description": "Global investment firm focused on public and private companies in the internet, software, and technology sectors.",
        "founded_year": 2001,
        "aum_raw": "$50B",
        "aum": 50000000000.0,
        "strategy": "Growth Equity",
        "website": "https://tigerglobal.com",
        "headquarters": "New York, NY"
    },
    {
        "name": "SoftBank Vision Fund",
        "description": "World's largest technology-focused venture capital fund.",
        "founded_year": 2017,
        "aum_raw": "$100B",
        "aum": 100000000000.0,
        "strategy": "Venture Capital",
        "website": "https://visionfund.com",
        "headquarters": "Tokyo, Japan"
    }
]

# Sample LPs data
LPS_DATA = [
    {
        "name": "CALSTRS",
        "type": "Pension Fund",
        "description": "California State Teachers' Retirement System - the largest educator-only pension fund in the world.",
        "website": "https://calstrs.com",
        "primary_contact_name": "Christopher Ailman",
        "primary_contact_email": "contact@calstrs.com",
        "location": "West Sacramento, CA",
        "total_committed_capital_raw": "$330B",
        "total_committed_capital": 330000000000.0,
        "investment_focus": "Diversified",
        "first_investment_year": 1913,
        "relationship_status": "Active",
        "tier": "Tier 1"
    },
    {
        "name": "CalPERS",
        "type": "Pension Fund",
        "description": "California Public Employees' Retirement System - the largest public pension fund in the United States.",
        "website": "https://calpers.ca.gov",
        "primary_contact_name": "Marcie Frost",
        "primary_contact_email": "contact@calpers.ca.gov",
        "location": "Sacramento, CA",
        "total_committed_capital_raw": "$450B",
        "total_committed_capital": 450000000000.0,
        "investment_focus": "Diversified",
        "first_investment_year": 1932,
        "relationship_status": "Active",
        "tier": "Tier 1"
    },
    {
        "name": "Yale Endowment",
        "type": "Endowment",
        "description": "Yale University's endowment, known for pioneering the 'Yale Model' of institutional investing.",
        "website": "https://investments.yale.edu",
        "primary_contact_name": "Matthew Mendelsohn",
        "primary_contact_email": "contact@yale.edu",
        "location": "New Haven, CT",
        "total_committed_capital_raw": "$41B",
        "total_committed_capital": 41000000000.0,
        "investment_focus": "Alternative Investments",
        "first_investment_year": 1718,
        "relationship_status": "Active",
        "tier": "Tier 1"
    }
]

# Sample Holdings for CALSTRS
HOLDINGS_DATA = [
    {
        "fund_name": "Sequoia Capital Fund XV",
        "vintage": 2018,
        "capital_committed_raw": "$100M",
        "capital_committed": 100000000.0,
        "capital_contributed_raw": "$85M",
        "capital_contributed": 85000000.0,
        "capital_distributed_raw": "$150M",
        "capital_distributed": 150000000.0,
        "market_value_raw": "$180M",
        "market_value": 180000000.0,
        "inception_irr": 25.5
    },
    {
        "fund_name": "Andreessen Horowitz Fund VII",
        "vintage": 2020,
        "capital_committed_raw": "$75M",
        "capital_committed": 75000000.0,
        "capital_contributed_raw": "$60M",
        "capital_contributed": 60000000.0,
        "capital_distributed_raw": "$20M",
        "capital_distributed": 20000000.0,
        "market_value_raw": "$120M",
        "market_value": 120000000.0,
        "inception_irr": 32.1
    },
    {
        "fund_name": "Tiger Global PIP XIV",
        "vintage": 2021,
        "capital_committed_raw": "$200M",
        "capital_committed": 200000000.0,
        "capital_contributed_raw": "$180M",
        "capital_contributed": 180000000.0,
        "capital_distributed_raw": "$50M",
        "capital_distributed": 50000000.0,
        "market_value_raw": "$220M",
        "market_value": 220000000.0,
        "inception_irr": 18.3
    },
    {
        "fund_name": "DST Global V",
        "vintage": 2019,
        "capital_committed_raw": "$150M",
        "capital_committed": 150000000.0,
        "capital_contributed_raw": "$140M",
        "capital_contributed": 140000000.0,
        "capital_distributed_raw": "$80M",
        "capital_distributed": 80000000.0,
        "market_value_raw": "$200M",
        "market_value": 200000000.0,
        "inception_irr": 22.7
    },
    {
        "fund_name": "MegaDelta Capital Fund II",
        "vintage": 2020,
        "capital_committed_raw": "$50M",
        "capital_committed": 50000000.0,
        "capital_contributed_raw": "$45M",
        "capital_contributed": 45000000.0,
        "capital_distributed_raw": "$15M",
        "capital_distributed": 15000000.0,
        "market_value_raw": "$75M",
        "market_value": 75000000.0,
        "inception_irr": 28.9
    },
    {
        "fund_name": "SoftBank Vision Fund II",
        "vintage": 2019,
        "capital_committed_raw": "$500M",
        "capital_committed": 500000000.0,
        "capital_contributed_raw": "$450M",
        "capital_contributed": 450000000.0,
        "capital_distributed_raw": "$100M",
        "capital_distributed": 100000000.0,
        "market_value_raw": "$380M",
        "market_value": 380000000.0,
        "inception_irr": -5.2
    },
    {
        "fund_name": "361 Capital Growth Fund",
        "vintage": 2017,
        "capital_committed_raw": "$80M",
        "capital_committed": 80000000.0,
        "capital_contributed_raw": "$80M",
        "capital_contributed": 80000000.0,
        "capital_distributed_raw": "$120M",
        "capital_distributed": 120000000.0,
        "market_value_raw": "$95M",
        "market_value": 95000000.0,
        "inception_irr": 15.8
    },
    {
        "fund_name": "Raptor Group Fund IV",
        "vintage": 2018,
        "capital_committed_raw": "$60M",
        "capital_committed": 60000000.0,
        "capital_contributed_raw": "$55M",
        "capital_contributed": 55000000.0,
        "capital_distributed_raw": "$40M",
        "capital_distributed": 40000000.0,
        "market_value_raw": "$85M",
        "market_value": 85000000.0,
        "inception_irr": 19.4
    }
]


def seed_database():
    """Seed the database with sample data."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if data already exists
        existing_funds = db.query(Fund).count()
        if existing_funds > 0:
            print(f"Database already has {existing_funds} funds. Skipping seed.")
            return

        # Seed Funds
        print("Seeding funds...")
        for fund_data in FUNDS_DATA:
            fund = Fund(
                id=str(uuid4()),
                **fund_data
            )
            db.add(fund)
        db.commit()
        print(f"Added {len(FUNDS_DATA)} funds.")

        # Seed LPs
        print("Seeding LPs...")
        lp_ids = {}
        for lp_data in LPS_DATA:
            lp = LP(
                id=str(uuid4()),
                **lp_data
            )
            db.add(lp)
            lp_ids[lp_data["name"]] = lp.id
        db.commit()
        print(f"Added {len(LPS_DATA)} LPs.")

        # Seed Holdings for CALSTRS
        print("Seeding holdings for CALSTRS...")
        calstrs_id = lp_ids.get("CALSTRS")
        if calstrs_id:
            for holding_data in HOLDINGS_DATA:
                holding = LPHolding(
                    id=str(uuid4()),
                    lp_id=calstrs_id,
                    lp_name="CALSTRS",
                    **holding_data
                )
                db.add(holding)
            db.commit()
            print(f"Added {len(HOLDINGS_DATA)} holdings for CALSTRS.")

        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
