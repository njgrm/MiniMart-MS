#!/usr/bin/env python3
"""
Christian Minimart - Enterprise ERP Data Simulator v3
=====================================================
Generates 3 years (2024-2026) of realistic Philippine minimart sales history with:

1. INFLATION LOGIC (New): 4-5% annual price increases on both retail and cost prices
2. Customer Profiles: Snackers (70%), Household Shoppers (20%), Bulk Vendors (10%)
3. Daily Revenue Target: ₱80k-85k base (2024), growing with inflation
4. Seasonality: December +50%, Summer beverage boost, Payday bumps
5. External Events: Brand campaigns with 3x multiplier for 1 week

Output: sales_history_v3.csv with inflation-adjusted prices
"""

import csv
import random
import sys
import io
from datetime import datetime, timedelta
from typing import NamedTuple, Optional
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import math

# Fix Windows console encoding for emoji support
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# =============================================================================
# Configuration
# =============================================================================

START_DATE = datetime(2024, 1, 1)
END_DATE = datetime.now().replace(hour=23, minute=59, second=59)  # Current date (dynamic)

OUTPUT_FILE = "sales_history_v3.csv"

# Economic Parameters
ANNUAL_INFLATION_RATE = 0.045  # 4.5% annual inflation
BASE_DAILY_REVENUE_TARGET = 82500  # ₱80k-85k midpoint for 2024
BUSINESS_HOURS_START = 8   # 8:00 AM
BUSINESS_HOURS_END = 19    # 7:00 PM

# Customer Profile Distribution
# SNACKER: Quick purchases - single item like a soda or snack (70% of transactions)
# HOUSEHOLD: Weekly grocery run - multiple items (20% of transactions)
# VENDOR: Bulk reseller - large quantity orders (10% of transactions)
CUSTOMER_PROFILES = {
    "SNACKER": {"weight": 0.70, "items_range": (1, 2), "ticket_range": (15, 150), "qty_per_item": (1, 1)},
    "HOUSEHOLD": {"weight": 0.20, "items_range": (3, 8), "ticket_range": (300, 1500), "qty_per_item": (1, 2)},
    "VENDOR": {"weight": 0.10, "items_range": (5, 15), "ticket_range": (1500, 8000), "qty_per_item": (3, 12)},
}

# Base daily transaction count (will be adjusted by multipliers)
# ~110 transactions/day × 730 days = ~80,300 transactions over 2 years
BASE_DAILY_TRANSACTIONS = 110

# Product catalog (matching Christian Minimart actual database)
# Categories: SODA (individual bottles), SOFTDRINKS_CASE (wholesale only - case/bundle)
PRODUCTS = [
    # SODA - Individual bottles (retail customers: snackers, household)
    {"barcode": "544900000099", "name": "Coca-Cola Mismo 295ml", "brand": "Coca-Cola", "category": "SODA", "base_retail": 20.00, "base_cost": 18.00},
    {"barcode": "480198112005", "name": "Sprite 500ml", "brand": "Coca-Cola", "category": "SODA", "base_retail": 25.00, "base_cost": 22.50},
    {"barcode": "480198112010", "name": "Royal Tru Orange 500ml", "brand": "Coca-Cola", "category": "SODA", "base_retail": 25.00, "base_cost": 22.50},
    {"barcode": "480198112000", "name": "Coke 500ml", "brand": "Coca-Cola", "category": "SODA", "base_retail": 25.00, "base_cost": 22.50},
    {"barcode": "480392525114", "name": "Mountain Dew 500ml", "brand": "Pepsi", "category": "SODA", "base_retail": 22.00, "base_cost": 20.00},
    {"barcode": "480392525110", "name": "Pepsi 500ml", "brand": "Pepsi", "category": "SODA", "base_retail": 22.00, "base_cost": 20.00},
    {"barcode": "480198111607", "name": "Coke 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480198118062", "name": "Sprite 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480191198062", "name": "Royal Tru Orange 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480392515114", "name": "Mountain Dew 1.5L", "brand": "Pepsi", "category": "SODA", "base_retail": 55.00, "base_cost": 50.00},
    {"barcode": "480392515110", "name": "Pepsi 1.5L", "brand": "Pepsi", "category": "SODA", "base_retail": 55.00, "base_cost": 50.00},
    {"barcode": "480198111664", "name": "Coke Zero 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480392515112", "name": "7-up 1.5L", "brand": "Pepsi", "category": "SODA", "base_retail": 55.00, "base_cost": 50.00},
    {"barcode": "480198109722", "name": "Royal Tru Strawberry 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480392515116", "name": "Mirinda Orange 1.5L", "brand": "Pepsi", "category": "SODA", "base_retail": 60.00, "base_cost": 54.00},
    {"barcode": "480198111696", "name": "Coke Light 1.5L", "brand": "Coca-Cola", "category": "SODA", "base_retail": 65.00, "base_cost": 58.50},
    
    # SOFTDRINKS CASE - Wholesale only (VENDOR profile purchases these by case/bundle)
    # These have wholesale_price instead of retail_price, qty represents cases not individual bottles
    {"barcode": "480198112717", "name": "Coke Swakto 195ml (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 125.00, "base_cost": 112.00, "wholesale_only": True},
    {"barcode": "480198112720", "name": "Royal Swakto 195ml (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 125.00, "base_cost": 112.00, "wholesale_only": True},
    {"barcode": "480198102719", "name": "Sprite Swakto 195ml (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 125.00, "base_cost": 112.00, "wholesale_only": True},
    {"barcode": "480392513032", "name": "Mountain Dew 290ml (1 Case)", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "base_retail": 200.00, "base_cost": 180.00, "wholesale_only": True},
    {"barcode": "480374937310", "name": "Coke 1L (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 350.00, "base_cost": 315.00, "wholesale_only": True},
    {"barcode": "480611352020", "name": "Juicy Lemon 237 ml (1 Bundle)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 141.00, "base_cost": 127.00, "wholesale_only": True},
    {"barcode": "480732471900", "name": "Sprite 1L (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 350.00, "base_cost": 315.00, "wholesale_only": True},
    {"barcode": "542353276241", "name": "Royal 1L (1 Case)", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "base_retail": 350.00, "base_cost": 315.00, "wholesale_only": True},
    
    # BEVERAGES (affected by summer seasonality)  
    {"barcode": "955600121722", "name": "Milo 22g Sachet", "brand": "Nestle", "category": "BEVERAGES", "base_retail": 12.00, "base_cost": 10.50},
    {"barcode": "480036141081", "name": "Nestle Bear Brand Fortified 33g", "brand": "Nestle", "category": "BEVERAGES", "base_retail": 11.50, "base_cost": 10.00},
    {"barcode": "480864731007", "name": "Tang Orange 250g", "brand": "Tang", "category": "BEVERAGES", "base_retail": 216.00, "base_cost": 195.00},
    {"barcode": "965412919731", "name": "Energen Cereal Milk Chocolate Drink 40g", "brand": "Energen", "category": "BEVERAGES", "base_retail": 9.00, "base_cost": 8.00},
    {"barcode": "965412919613", "name": "Energen Cereal Drink Mix Vanilla Hanger 40g", "brand": "Energen", "category": "BEVERAGES", "base_retail": 8.60, "base_cost": 7.50},
    
    # SNACKS
    {"barcode": "489120804013", "name": "Oishi Prawn Crackers 60g", "brand": "Oishi", "category": "SNACK", "base_retail": 17.60, "base_cost": 15.50},
    {"barcode": "893921341445", "name": "San Sky Flakes Crackers Original 25g x 10s", "brand": "M.Y. San", "category": "SNACK", "base_retail": 58.40, "base_cost": 52.50},
    {"barcode": "893951811445", "name": "Hansel Mocha Sandwich", "brand": "Rebisco", "category": "SNACK", "base_retail": 60.20, "base_cost": 54.00},
    
    # CANNED GOODS
    {"barcode": "748485200019", "name": "555 Sardines in Tomato Sauce 155g", "brand": "555", "category": "CANNED_GOODS", "base_retail": 25.00, "base_cost": 22.00},
    {"barcode": "748485800035", "name": "Argentina Corned Beef 260g", "brand": "Argentina", "category": "CANNED_GOODS", "base_retail": 57.50, "base_cost": 52.00},
    {"barcode": "480002201028", "name": "Hunts Pork & Beans 100g Doy", "brand": "Hunts", "category": "CANNED_GOODS", "base_retail": 14.50, "base_cost": 13.00},
    
    # DAIRY
    {"barcode": "480057511015", "name": "Alaska Classic Evaporated Filled Milk 140ml", "brand": "Alaska", "category": "DAIRY", "base_retail": 28.20, "base_cost": 25.50},
    {"barcode": "480057513016", "name": "Alaska Condensada Sweetened Condensed Creamer 168ml", "brand": "Alaska", "category": "DAIRY", "base_retail": 39.00, "base_cost": 35.00},
    {"barcode": "480864702009", "name": "Eden Cheese 165g", "brand": "Mondelez", "category": "DAIRY", "base_retail": 78.00, "base_cost": 70.00},
    {"barcode": "480535824701", "name": "Dari Creme Butter Milk 100g", "brand": "Dari Creme", "category": "DAIRY", "base_retail": 41.00, "base_cost": 37.00},
    
    # CONDIMENTS
    {"barcode": "000008586780", "name": "Datu Puti Patis 1L", "brand": "Datu Puti", "category": "CONDIMENTS", "base_retail": 80.85, "base_cost": 73.00},
    {"barcode": "642611907726", "name": "Ajinomoto Seasoning Mix 50g", "brand": "Ajinomoto", "category": "CONDIMENTS", "base_retail": 13.00, "base_cost": 11.50},
    
    # PERSONAL CARE
    {"barcode": "642647382226", "name": "Sisters Night Plus Cottony Napkin", "brand": "Sisters", "category": "PERSONAL_CARE", "base_retail": 44.50, "base_cost": 40.00},
    {"barcode": "642321541122", "name": "Sisters Overnight Dry", "brand": "Sisters", "category": "PERSONAL_CARE", "base_retail": 117.00, "base_cost": 105.00},
    {"barcode": "672329634182", "name": "Whisper Cottony Soft Clean X-Long Overnight", "brand": "Whisper", "category": "PERSONAL_CARE", "base_retail": 128.00, "base_cost": 115.00},
    {"barcode": "480088814685", "name": "Sunsilk Strong & Long 350ml", "brand": "Sunsilk", "category": "PERSONAL_CARE", "base_retail": 150.00, "base_cost": 135.00},
    
    # HOUSEHOLD
    {"barcode": "870021639476", "name": "Downy Sunrise Fresh Fabric Conditioner Sachet 20ml", "brand": "Downy", "category": "HOUSEHOLD", "base_retail": 7.00, "base_cost": 6.00},
    {"barcode": "480004784003", "name": "Zonrox Original Bleach 250ml", "brand": "Zonrox", "category": "HOUSEHOLD", "base_retail": 38.00, "base_cost": 34.00},
    {"barcode": "037000359562", "name": "Ariel With a Touch of Downy Freshness Powder", "brand": "Ariel", "category": "HOUSEHOLD", "base_retail": 660.00, "base_cost": 595.00},
    {"barcode": "490243086729", "name": "Joy Dishwashing Liquid Lemon 475ml", "brand": "Joy", "category": "HOUSEHOLD", "base_retail": 134.00, "base_cost": 120.00},
    {"barcode": "490243078997", "name": "Joy Dishwashing Liquid Lemon Sachet 40ml", "brand": "Joy", "category": "HOUSEHOLD", "base_retail": 12.00, "base_cost": 10.50},
    
    # === TEST SCENARIO PRODUCTS ===
    # DEAD STOCK: Product that NEVER sells (for testing dead inventory insight)
    # This is intentionally excluded from normal selection - only exists in database
    {"barcode": "480004210014", "name": "UFC Premium Banana Ketchup 320g", "brand": "UFC", "category": "DEAD_STOCK", "base_retail": 65.00, "base_cost": 58.00, "never_sell": True},
    
    # HERO PRODUCT: Product with higher velocity (for testing hero product insight)
    # This product gets a 3x boost in selection probability (toned down from 10x)
    {"barcode": "489310100015", "name": "Lucky Me Pancit Canton with Kalamnsi 60g", "brand": "Lucky Me", "category": "INSTANT_NOODLES", "base_retail": 12.50, "base_cost": 11.00, "hero_boost": 3.0},
]

# Brands that run manufacturer campaigns
CAMPAIGN_BRANDS = ["Coca-Cola", "Pepsi", "Nestle", "Oishi", "Alaska", "Ariel", "Joy", "555", "Lucky Me"]

# Payment method distribution (70% CASH, 30% GCASH)
PAYMENT_METHODS = ["CASH"] * 7 + ["GCASH"] * 3


# =============================================================================
# Data Classes
# =============================================================================

class EventSource(Enum):
    NONE = ""
    STORE_DISCOUNT = "STORE_DISCOUNT"
    MANUFACTURER_CAMPAIGN = "MANUFACTURER_CAMPAIGN"
    HOLIDAY = "HOLIDAY"


@dataclass
class BrandCampaign:
    """Represents a brand/manufacturer advertising campaign"""
    name: str
    brand: str
    start_date: datetime
    end_date: datetime
    multiplier: float = 3.0  # 3x volume for campaigns
    source: EventSource = EventSource.MANUFACTURER_CAMPAIGN


@dataclass
class StorePromo:
    """Represents a store-initiated promotion"""
    name: str
    product_barcodes: list
    start_date: datetime
    end_date: datetime
    multiplier: float = 2.0
    source: EventSource = EventSource.STORE_DISCOUNT


@dataclass
class Holiday:
    """Represents a holiday period"""
    name: str
    date: datetime
    duration_days: int = 1
    multiplier: float = 1.8
    source: EventSource = EventSource.HOLIDAY


@dataclass
class Transaction:
    """Represents a single customer transaction"""
    transaction_id: str
    date: datetime
    time: datetime
    customer_type: str
    payment_method: str
    items: list = field(default_factory=list)
    total_amount: float = 0.0
    total_cost: float = 0.0


# =============================================================================
# Inflation Functions
# =============================================================================

def get_inflation_factor(date: datetime) -> float:
    """
    Calculate the cumulative inflation factor from start date.
    Formula: price_at_date = base_price * (1 + inflation_rate * years_from_start)
    
    This simulates gradual price increases over the 3-year period.
    """
    days_from_start = (date - START_DATE).days
    years_from_start = days_from_start / 365.25
    
    # Linear interpolation for smooth price changes
    return 1 + (ANNUAL_INFLATION_RATE * years_from_start)


def get_inflated_prices(product: dict, date: datetime) -> tuple[float, float]:
    """Get inflation-adjusted retail and cost prices for a product on a given date."""
    factor = get_inflation_factor(date)
    
    # Round to 2 decimal places for realistic pricing
    retail = round(product["base_retail"] * factor, 2)
    cost = round(product["base_cost"] * factor, 2)
    
    return retail, cost


def get_daily_revenue_target(date: datetime) -> float:
    """Get the inflation-adjusted daily revenue target for a given date."""
    factor = get_inflation_factor(date)
    return BASE_DAILY_REVENUE_TARGET * factor


# =============================================================================
# Event Generators
# =============================================================================

def generate_brand_campaigns(year: int, num_campaigns: int = 3) -> list[BrandCampaign]:
    """Generate 3 random brand advertising campaigns per year"""
    campaigns = []
    used_months = set()
    
    for _ in range(num_campaigns):
        brand = random.choice(CAMPAIGN_BRANDS)
        
        # Pick a random month (avoid duplicates)
        available_months = [m for m in range(1, 13) if m not in used_months]
        if not available_months:
            break
        month = random.choice(available_months)
        used_months.add(month)
        
        # Random week within the month (1 week duration)
        day = random.randint(1, 21)
        start_date = datetime(year, month, day)
        end_date = start_date + timedelta(days=7)  # Exactly 1 week
        
        campaign_names = [
            f"{brand} TV Commercial Blitz",
            f"{brand} Summer Promo",
            f"{brand} Back to School",
            f"{brand} Holiday Special",
            f"{brand} Anniversary Sale",
            f"{brand} New Product Launch",
        ]
        
        campaigns.append(BrandCampaign(
            name=random.choice(campaign_names),
            brand=brand,
            start_date=start_date,
            end_date=end_date,
            multiplier=3.0  # 3x volume during campaigns
        ))
    
    return campaigns


def generate_store_promos(year: int) -> list[StorePromo]:
    """Generate store-initiated promotions"""
    promos = []
    
    for month in [2, 5, 8, 11]:  # Quarterly promos
        random_products = random.sample(PRODUCTS, k=random.randint(3, 6))
        barcodes = [p["barcode"] for p in random_products]
        
        start_date = datetime(year, month, random.randint(1, 15))
        end_date = start_date + timedelta(days=random.randint(7, 14))
        
        promos.append(StorePromo(
            name=f"Christian Minimart {start_date.strftime('%B')} Sale",
            product_barcodes=barcodes,
            start_date=start_date,
            end_date=end_date,
            multiplier=random.uniform(1.5, 2.2)
        ))
    
    return promos


def generate_holidays(year: int) -> list[Holiday]:
    """Generate Philippine holidays that affect sales"""
    return [
        Holiday("New Year's Day", datetime(year, 1, 1), 2, 1.6),
        Holiday("Valentine's Day", datetime(year, 2, 14), 2, 1.4),
        Holiday("Holy Week", datetime(year, 3, 28), 4, 1.5),
        Holiday("Labor Day", datetime(year, 5, 1), 1, 1.3),
        Holiday("Independence Day", datetime(year, 6, 12), 1, 1.3),
        Holiday("All Saints Day", datetime(year, 11, 1), 2, 1.4),
        Holiday("Bonifacio Day", datetime(year, 11, 30), 1, 1.3),
        Holiday("Christmas Eve", datetime(year, 12, 24), 2, 2.0),
        Holiday("Christmas Day", datetime(year, 12, 25), 2, 1.8),
        Holiday("New Year's Eve", datetime(year, 12, 31), 1, 1.9),
    ]


# =============================================================================
# Multiplier Calculations
# =============================================================================

def get_seasonality_multiplier(date: datetime, category: str) -> float:
    """Calculate seasonality multiplier based on month and category"""
    month = date.month
    
    # December boost (Christmas season) - +50%
    if month == 12:
        return 1.5
    
    # November pre-Christmas
    if month == 11:
        return 1.2
    
    # Summer boost for beverages (April-May, Philippine summer)
    if month in [4, 5] and category in ["BEVERAGES", "SODA", "SOFTDRINKS_CASE"]:
        return 1.4
    
    # March-April (graduation/summer start)
    if month in [3, 4]:
        return 1.1
    
    # August (back to school)
    if month == 8:
        return 1.15
    
    return 1.0


def get_payday_multiplier(date: datetime) -> float:
    """Payday bump on 15th and 30th of each month for household shoppers"""
    day = date.day
    if day in [15, 30, 31]:  # Include 31st as month-end
        return 1.4
    if day in [14, 16, 29]:  # Day before/after payday
        return 1.2
    return 1.0


def get_day_of_week_multiplier(date: datetime) -> float:
    """Weekends typically have higher sales"""
    day = date.weekday()
    
    if day == 5:  # Saturday
        return 1.3
    elif day == 6:  # Sunday
        return 1.25
    elif day == 4:  # Friday
        return 1.15
    else:
        return 1.0


def is_within_campaign(date: datetime, campaigns: list[BrandCampaign], brand: str) -> tuple[bool, Optional[BrandCampaign]]:
    """Check if a brand has an active campaign on this date"""
    for campaign in campaigns:
        if campaign.brand == brand and campaign.start_date <= date <= campaign.end_date:
            return True, campaign
    return False, None


def is_within_store_promo(date: datetime, promos: list[StorePromo], barcode: str) -> tuple[bool, Optional[StorePromo]]:
    """Check if a product has an active store promo on this date"""
    for promo in promos:
        if barcode in promo.product_barcodes and promo.start_date <= date <= promo.end_date:
            return True, promo
    return False, None


def is_within_holiday(date: datetime, holidays: list[Holiday]) -> tuple[bool, Optional[Holiday]]:
    """Check if date falls within a holiday period"""
    for holiday in holidays:
        end_date = holiday.date + timedelta(days=holiday.duration_days)
        if holiday.date <= date <= end_date:
            return True, holiday
    return False, None


# =============================================================================
# Transaction Time Generator
# =============================================================================

def generate_transaction_time(date: datetime) -> datetime:
    """
    Generate a random transaction time within business hours (8 AM - 7 PM).
    Uses a distribution that peaks during lunch and afternoon hours.
    """
    # Weight distribution: lighter mornings, peak at noon/afternoon
    hour_weights = {
        8: 0.5, 9: 0.7, 10: 0.9, 11: 1.2,
        12: 1.5, 13: 1.3, 14: 1.0, 15: 1.1,
        16: 1.2, 17: 1.4, 18: 1.3,
    }
    
    hours = list(hour_weights.keys())
    weights = list(hour_weights.values())
    
    hour = random.choices(hours, weights=weights, k=1)[0]
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    
    return datetime(date.year, date.month, date.day, hour, minute, second)


# =============================================================================
# Customer Profile Selection
# =============================================================================

def select_customer_profile() -> str:
    """Select a customer profile based on weighted distribution"""
    profiles = list(CUSTOMER_PROFILES.keys())
    weights = [CUSTOMER_PROFILES[p]["weight"] for p in profiles]
    return random.choices(profiles, weights=weights, k=1)[0]


def get_products_for_profile(profile: str, date: datetime, campaigns: list[BrandCampaign], 
                             promos: list[StorePromo]) -> list[dict]:
    """Select products appropriate for the customer profile with realistic quantities"""
    config = CUSTOMER_PROFILES[profile]
    min_items, max_items = config["items_range"]
    target_min, target_max = config["ticket_range"]
    min_qty, max_qty = config["qty_per_item"]
    
    # Adjust target for inflation
    inflation = get_inflation_factor(date)
    target_min *= inflation
    target_max *= inflation
    
    # Determine how many distinct product types this customer will buy
    num_items = random.randint(min_items, max_items)
    selected_items = []
    current_total = 0
    
    # Create a pool of products with their inflated prices
    # Filter based on profile type:
    # - SNACKER/HOUSEHOLD: Only retail products (exclude wholesale_only)
    # - VENDOR: All products including wholesale_only (case/bundle purchases)
    product_pool = []
    wholesale_pool = []  # Separate pool for case/bundle products (VENDOR only)
    
    for p in PRODUCTS:
        if p.get("never_sell", False):
            continue  # Skip dead stock products entirely
        
        retail, cost = get_inflated_prices(p, date)
        product_with_prices = {**p, "retail_price": retail, "cost_price": cost}
        
        if p.get("wholesale_only", False):
            # Case/bundle products go to wholesale pool (VENDOR only)
            wholesale_pool.append(product_with_prices)
        else:
            # Regular retail products
            product_pool.append(product_with_prices)
    
    # Separate products by price tier for more realistic selection
    cheap_products = [p for p in product_pool if p["retail_price"] <= 30]
    mid_products = [p for p in product_pool if 30 < p["retail_price"] <= 80]
    expensive_products = [p for p in product_pool if p["retail_price"] > 80]
    
    # Create weighted selection for hero products
    weighted_pool = []
    for p in product_pool:
        hero_boost = int(p.get("hero_boost", 1))
        weighted_pool.append(p)
        for _ in range(hero_boost - 1):
            weighted_pool.append(p)
    
    # Snackers prefer cheap items (sodas, snacks, instant noodles)
    if profile == "SNACKER":
        # 80% chance of picking cheap items, 20% mid-range
        # Exclude wholesale_only products
        selection_pool = cheap_products * 4 + mid_products if cheap_products else weighted_pool
    elif profile == "HOUSEHOLD":
        # Mix of all price tiers, exclude wholesale_only
        selection_pool = cheap_products * 2 + mid_products * 2 + expensive_products
    else:  # VENDOR
        # Vendors buy BOTH retail products in bulk AND wholesale case/bundle products
        # Give strong preference to wholesale products (cases/bundles) - 60% of selection
        selection_pool = weighted_pool + (wholesale_pool * 3)  # 3x weight for wholesale
    
    # Add hero products to selection pool
    for p in product_pool:
        if p.get("hero_boost", 1) > 1:
            for _ in range(int(p["hero_boost"])):
                selection_pool.append(p)
    
    random.shuffle(selection_pool)
    
    # Select exactly num_items products (or fewer if budget exceeded)
    attempts = 0
    max_attempts = num_items * 5
    
    while len(selected_items) < num_items and attempts < max_attempts:
        attempts += 1
        
        if not selection_pool:
            break
            
        product = random.choice(selection_pool)
        retail = product["retail_price"]
        
        # Determine quantity based on profile
        # For wholesale products (cases), qty is number of cases (smaller qty)
        if product.get("wholesale_only", False):
            qty = random.randint(1, 3)  # 1-3 cases per order
        else:
            qty = random.randint(min_qty, max_qty)
        
        # Check for campaigns/promos - slight quantity boost
        in_campaign, _ = is_within_campaign(date, campaigns, product["brand"])
        in_promo, _ = is_within_store_promo(date, promos, product["barcode"])
        
        if (in_campaign or in_promo) and profile != "SNACKER":
            qty = min(qty + 1, max_qty + 2)  # Small boost, capped
        
        item_total = retail * qty
        
        # Check if adding this would exceed budget
        if current_total + item_total > target_max:
            # For snackers, just skip expensive items
            if profile == "SNACKER":
                continue
            # For others, reduce quantity to fit
            qty = max(1, int((target_max - current_total) / retail))
            if qty <= 0:
                continue
            item_total = retail * qty
        
        # Avoid duplicates - check if product already selected
        if any(item["barcode"] == product["barcode"] for item in selected_items):
            continue
        
        selected_items.append({
            **product,
            "quantity": qty,
            "subtotal": round(item_total, 2),
            "cost_total": round(product["cost_price"] * qty, 2),
        })
        current_total += item_total
        
        # Stop if we've exceeded max budget
        if current_total >= target_max:
            break
    
    return selected_items


# =============================================================================
# Daily Transaction Generator
# =============================================================================

def get_daily_transaction_count(date: datetime, holidays: list[Holiday]) -> int:
    """
    Calculate the number of transactions for a given day.
    Base: ~110 transactions/day, adjusted by seasonality and day-of-week.
    """
    base_count = BASE_DAILY_TRANSACTIONS
    
    # Apply seasonality
    seasonality = get_seasonality_multiplier(date, "")
    dow_mult = get_day_of_week_multiplier(date)
    
    # Check for holidays
    in_holiday, holiday = is_within_holiday(date, holidays)
    holiday_mult = holiday.multiplier if in_holiday else 1.0
    
    # Payday boost (more customers on payday)
    payday_mult = get_payday_multiplier(date)
    
    # Calculate adjusted count with some randomness (±15%)
    adjusted_count = base_count * seasonality * dow_mult * holiday_mult * payday_mult
    adjusted_count *= random.uniform(0.85, 1.15)
    
    return max(50, int(adjusted_count))  # Minimum 50 transactions per day


def generate_daily_transactions(
    date: datetime,
    campaigns: list[BrandCampaign],
    promos: list[StorePromo],
    holidays: list[Holiday]
) -> list[dict]:
    """
    Generate all transactions for a single day with realistic customer profiles.
    Uses transaction-count-driven approach for realistic volume.
    """
    
    transactions = []
    
    # Check for holidays
    in_holiday, holiday = is_within_holiday(date, holidays)
    
    # Calculate how many transactions to generate today
    target_transactions = get_daily_transaction_count(date, holidays)
    
    transaction_id_base = date.strftime("%Y%m%d")
    
    for tx_counter in range(1, target_transactions + 1):
        # Select customer profile based on weighted distribution
        profile = select_customer_profile()
        
        # Get products for this customer
        items = get_products_for_profile(profile, date, campaigns, promos)
        
        if not items:
            continue
        
        # Calculate transaction totals
        tx_total = sum(item["subtotal"] for item in items)
        tx_cost = sum(item["cost_total"] for item in items)
        
        # Generate transaction time
        tx_time = generate_transaction_time(date)
        
        # Payment method - snackers more likely to use cash
        if profile == "SNACKER":
            payment = random.choices(["CASH", "GCASH"], weights=[0.8, 0.2], k=1)[0]
        else:
            payment = random.choice(PAYMENT_METHODS)
        
        transaction_id = f"TX-{transaction_id_base}-{tx_counter:04d}"
        
        # Create transaction record for each item
        for item in items:
            # Check for events affecting this item
            in_campaign, campaign = is_within_campaign(date, campaigns, item["brand"])
            in_promo, promo = is_within_store_promo(date, promos, item["barcode"])
            
            is_event = in_campaign or in_promo or in_holiday
            event_source = ""
            event_name = ""
            
            if in_campaign:
                event_source = EventSource.MANUFACTURER_CAMPAIGN.value
                event_name = campaign.name
            elif in_promo:
                event_source = EventSource.STORE_DISCOUNT.value
                event_name = promo.name
            elif in_holiday:
                event_source = EventSource.HOLIDAY.value
                event_name = holiday.name
            
            transactions.append({
                "transaction_id": transaction_id,
                "date": date.strftime("%Y-%m-%d"),
                "time": tx_time.strftime("%H:%M:%S"),
                "customer_type": profile,
                "barcode": item["barcode"],
                "product_name": item["name"],
                "brand": item["brand"],
                "category": item["category"],
                "quantity": item["quantity"],
                "unit_price": item["retail_price"],
                "cost_price": item["cost_price"],
                "subtotal": item["subtotal"],
                "cost_total": item["cost_total"],
                "profit": round(item["subtotal"] - item["cost_total"], 2),
                "payment_method": payment,
                "is_event": is_event,
                "event_source": event_source,
                "event_name": event_name,
                "inflation_factor": round(get_inflation_factor(date), 4),
            })
    
    return transactions


# =============================================================================
# Main Generation
# =============================================================================

def generate_all_sales() -> tuple[list[dict], list, list, list]:
    """Generate complete sales history with inflation-adjusted prices"""
    print("🚀 Starting Christian Minimart Sales History Generation v3")
    print(f"📅 Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    print(f"📦 Products: {len(PRODUCTS)}")
    print(f"📈 Inflation Rate: {ANNUAL_INFLATION_RATE * 100}% per year")
    print(f"💰 Base Daily Target (2024): ₱{BASE_DAILY_REVENUE_TARGET:,.2f}")
    
    all_sales = []
    
    # Generate events for each year
    years = range(START_DATE.year, END_DATE.year + 1)
    all_campaigns = []
    all_promos = []
    all_holidays = []
    
    for year in years:
        campaigns = generate_brand_campaigns(year, num_campaigns=3)
        promos = generate_store_promos(year)
        holidays = generate_holidays(year)
        
        all_campaigns.extend(campaigns)
        all_promos.extend(promos)
        all_holidays.extend(holidays)
        
        print(f"\n📆 Year {year}:")
        print(f"   🎯 Brand Campaigns: {len(campaigns)}")
        for c in campaigns:
            print(f"      - {c.name} ({c.brand}): {c.start_date.strftime('%m/%d')} - {c.end_date.strftime('%m/%d')}, {c.multiplier:.0f}x")
        print(f"   🏪 Store Promos: {len(promos)}")
        print(f"   🎉 Holidays: {len(holidays)}")
    
    # Generate daily sales
    print("\n⏳ Generating daily sales data...")
    print(f"   📊 Target: ~{BASE_DAILY_TRANSACTIONS} transactions/day")
    current_date = START_DATE
    total_days = (END_DATE - START_DATE).days
    
    day_count = 0
    total_tx_count = 0
    while current_date <= END_DATE:
        daily_transactions = generate_daily_transactions(
            current_date,
            all_campaigns,
            all_promos,
            all_holidays
        )
        all_sales.extend(daily_transactions)
        
        # Count unique transactions
        unique_tx_ids = set(t["transaction_id"] for t in daily_transactions)
        total_tx_count += len(unique_tx_ids)
        
        day_count += 1
        if day_count % 60 == 0:
            progress = (day_count / total_days) * 100
            daily_rev = sum(t["subtotal"] for t in daily_transactions)
            print(f"   📊 Day {day_count}/{total_days} ({progress:.0f}%) - {current_date.strftime('%Y-%m-%d')} - Tx: {len(unique_tx_ids)} - Revenue: ₱{daily_rev:,.2f}")
        
        current_date += timedelta(days=1)
    
    print(f"\n✅ Generated {len(all_sales):,} line items across {total_tx_count:,} transactions over {day_count} days")
    
    return all_sales, all_campaigns, all_promos, all_holidays


def export_to_csv(sales: list[dict], filename: str):
    """Export sales data to CSV"""
    if not sales:
        print("❌ No sales data to export")
        return
    
    fieldnames = list(sales[0].keys())
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sales)
    
    print(f"📁 Exported to {filename}")


def export_events_csv(campaigns: list, promos: list, holidays: list, filename: str):
    """Export events data for the EventLog table"""
    events = []
    
    for c in campaigns:
        events.append({
            "name": c.name,
            "source": "MANUFACTURER_CAMPAIGN",
            "start_date": c.start_date.strftime("%Y-%m-%d"),
            "end_date": c.end_date.strftime("%Y-%m-%d"),
            "multiplier": round(c.multiplier, 2),
            "affected_brand": c.brand,
            "affected_barcodes": "",
        })
    
    for p in promos:
        events.append({
            "name": p.name,
            "source": "STORE_DISCOUNT",
            "start_date": p.start_date.strftime("%Y-%m-%d"),
            "end_date": p.end_date.strftime("%Y-%m-%d"),
            "multiplier": round(p.multiplier, 2),
            "affected_brand": "",
            "affected_barcodes": "|".join(p.product_barcodes),
        })
    
    for h in holidays:
        end_date = h.date + timedelta(days=h.duration_days)
        events.append({
            "name": h.name,
            "source": "HOLIDAY",
            "start_date": h.date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "multiplier": round(h.multiplier, 2),
            "affected_brand": "",
            "affected_barcodes": "",
        })
    
    fieldnames = ["name", "source", "start_date", "end_date", "multiplier", "affected_brand", "affected_barcodes"]
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(events)
    
    print(f"📁 Exported events to {filename}")


def print_summary_stats(sales: list[dict]):
    """Print summary statistics with year-over-year comparison"""
    print("\n" + "=" * 70)
    print("📊 SUMMARY STATISTICS")
    print("=" * 70)
    
    # Group by year
    by_year = defaultdict(list)
    for s in sales:
        year = s["date"][:4]
        by_year[year].append(s)
    
    print("\n📈 Year-over-Year Analysis (Demonstrating Inflation Effect):\n")
    print(f"{'Year':<10} {'Revenue':>18} {'COGS':>18} {'Profit':>18} {'Margin':>10} {'Avg Tx':>12}")
    print("-" * 86)
    
    prev_revenue = None
    for year in sorted(by_year.keys()):
        year_sales = by_year[year]
        revenue = sum(s["subtotal"] for s in year_sales)
        cost = sum(s["cost_total"] for s in year_sales)
        profit = sum(s["profit"] for s in year_sales)
        margin = (profit / revenue * 100) if revenue > 0 else 0
        
        # Count unique transactions
        unique_tx = len(set(s["transaction_id"] for s in year_sales))
        avg_tx = revenue / unique_tx if unique_tx > 0 else 0
        
        # YoY growth
        yoy = ""
        if prev_revenue:
            growth = ((revenue - prev_revenue) / prev_revenue) * 100
            yoy = f" (+{growth:.1f}%)" if growth > 0 else f" ({growth:.1f}%)"
        
        print(f"{year:<10} ₱{revenue:>15,.2f}{yoy:<10} ₱{cost:>13,.2f} ₱{profit:>13,.2f} {margin:>8.1f}% ₱{avg_tx:>10,.2f}")
        prev_revenue = revenue
    
    # Overall stats
    total_revenue = sum(s["subtotal"] for s in sales)
    total_cost = sum(s["cost_total"] for s in sales)
    total_profit = sum(s["profit"] for s in sales)
    total_units = sum(s["quantity"] for s in sales)
    total_transactions = len(set(s["transaction_id"] for s in sales))
    
    print("\n" + "-" * 70)
    print(f"💰 Total Revenue: ₱{total_revenue:,.2f}")
    print(f"🧾 Total Transactions: {total_transactions:,}")
    print(f"📦 Total Units Sold: {total_units:,}")
    print(f"💵 Total COGS: ₱{total_cost:,.2f}")
    print(f"📈 Total Profit: ₱{total_profit:,.2f}")
    print(f"📊 Average Margin: {(total_profit/total_revenue)*100:.1f}%")
    print(f"🛒 Average Transaction Value: ₱{total_revenue/total_transactions:,.2f}")
    
    # Customer profile breakdown - by transactions
    print("\n👥 Customer Profile Breakdown (by Transactions):")
    
    # Group sales by transaction to get accurate counts
    tx_by_profile = defaultdict(set)
    revenue_by_profile = defaultdict(float)
    for s in sales:
        tx_by_profile[s["customer_type"]].add(s["transaction_id"])
        revenue_by_profile[s["customer_type"]] += s["subtotal"]
    
    for profile in ["SNACKER", "HOUSEHOLD", "VENDOR"]:
        tx_count = len(tx_by_profile[profile])
        tx_pct = (tx_count / total_transactions * 100) if total_transactions > 0 else 0
        rev = revenue_by_profile[profile]
        rev_pct = (rev / total_revenue * 100) if total_revenue > 0 else 0
        avg_ticket = rev / tx_count if tx_count > 0 else 0
        print(f"   - {profile}: {tx_count:,} transactions ({tx_pct:.0f}%), ₱{rev:,.2f} revenue ({rev_pct:.1f}%), Avg ₱{avg_ticket:.2f}/tx")
    
    # Inflation impact
    print("\n💹 Inflation Impact:")
    first_date = datetime.strptime(sales[0]["date"], "%Y-%m-%d")
    last_date = datetime.strptime(sales[-1]["date"], "%Y-%m-%d")
    print(f"   - Start (Jan 2024): Inflation factor = 1.0000")
    print(f"   - End (Jan 2026): Inflation factor = {get_inflation_factor(last_date):.4f}")
    print(f"   - Cumulative price increase: ~{(get_inflation_factor(last_date) - 1) * 100:.1f}%")
    
    # Event-driven sales
    event_sales = [s for s in sales if s["is_event"]]
    organic_sales = [s for s in sales if not s["is_event"]]
    
    print(f"\n🎯 Event vs Organic Sales:")
    print(f"   - Event-Driven: {len(event_sales):,} records ({len(event_sales)/len(sales)*100:.1f}%)")
    print(f"   - Organic: {len(organic_sales):,} records ({len(organic_sales)/len(sales)*100:.1f}%)")
    
    if event_sales:
        event_revenue = sum(s["subtotal"] for s in event_sales)
        print(f"   - Event Revenue: ₱{event_revenue:,.2f} ({event_revenue/total_revenue*100:.1f}% of total)")


# =============================================================================
# Main Execution
# =============================================================================

if __name__ == "__main__":
    # Generate all data
    sales, campaigns, promos, holidays = generate_all_sales()
    
    # Export to CSV files
    export_to_csv(sales, OUTPUT_FILE)
    export_events_csv(campaigns, promos, holidays, "events_log_v3.csv")
    
    # Print summary
    print_summary_stats(sales)
    
    print("\n✅ Generation Complete!")
    print(f"📁 Files created:")
    print(f"   - {OUTPUT_FILE} (Transaction history with inflation)")
    print(f"   - events_log_v3.csv (Events for EventLog table)")
