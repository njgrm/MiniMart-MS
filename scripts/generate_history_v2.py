#!/usr/bin/env python3
"""
Christian Minimart - Enterprise ERP Data Simulator v2
=====================================================
Generates 2 years of realistic sales history data with:
1. Base Velocity: Random 5-15 units/day per product
2. Seasonality: December 1.5x, Summer (Apr/May) 1.4x for beverages
3. External Events: Brand campaigns with 2.5x multiplier

Output: CSV with event tracking for forecasting engine calibration
"""

import csv
import random
from datetime import datetime, timedelta
from typing import NamedTuple
from dataclasses import dataclass
from enum import Enum

# =============================================================================
# Configuration
# =============================================================================

START_DATE = datetime(2024, 1, 1)
END_DATE = datetime(2026, 1, 3)  # Current date

OUTPUT_FILE = "sales_history_v2.csv"

# Product catalog (matching Christian Minimart actual database - from prodFinalznehje.csv)
PRODUCTS = [
    # SODA/SOFTDRINKS - Single serve and bottles (corrected barcodes from CSV)
    {"barcode": "544900000099", "name": "Coca-Cola Mismo 295ml", "brand": "Coca-Cola", "category": "SODA", "retail_price": 20.00, "cost_price": 18.00},
    {"barcode": "480198112005", "name": "Sprite 500ml", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 25.00, "cost_price": 22.50},
    {"barcode": "480198112010", "name": "Royal Tru Orange 500ml", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 25.00, "cost_price": 22.50},
    {"barcode": "480198112000", "name": "Coke 500ml", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 25.00, "cost_price": 22.50},
    {"barcode": "480392525114", "name": "Mountain Dew 500ml", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 22.00, "cost_price": 20.00},
    {"barcode": "480392525110", "name": "Pepsi 500ml", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 22.00, "cost_price": 20.00},
    {"barcode": "480198111607", "name": "Coke 1.5L", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480198118062", "name": "Sprite 1.5L", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480191198062", "name": "Royal Tru Orange 1.5L", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480392515114", "name": "Mountain Dew 1.5L", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 55.00, "cost_price": 50.00},
    {"barcode": "480392515110", "name": "Pepsi 1.5L", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 55.00, "cost_price": 50.00},
    {"barcode": "480198111664", "name": "Coke Zero 1.5L", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480392515112", "name": "7-up 1.5L", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 55.00, "cost_price": 50.00},
    {"barcode": "480198109722", "name": "Royal Tru Strawberry 1.5L", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480392515116", "name": "Mirinda Orange 1.5L", "brand": "Pepsi", "category": "SOFTDRINKS_CASE", "retail_price": 60.00, "cost_price": 54.00},
    {"barcode": "480198111696", "name": "Coke Light", "brand": "Coca-Cola", "category": "SOFTDRINKS_CASE", "retail_price": 65.00, "cost_price": 58.50},
    
    # BEVERAGES (affected by summer seasonality)  
    {"barcode": "955600121722", "name": "Milo 22g Sachet", "brand": "Nestle", "category": "BEVERAGES", "retail_price": 12.00, "cost_price": 10.50},
    {"barcode": "480036141081", "name": "Nestle Bear Brand Fortified 33g", "brand": "Nestle", "category": "BEVERAGES", "retail_price": 11.50, "cost_price": 10.00},
    {"barcode": "480864731007", "name": "Tang Orange 250g", "brand": "Tang", "category": "BEVERAGES", "retail_price": 216.00, "cost_price": 195.00},
    {"barcode": "965412919731", "name": "Energen Cereal Milk Chocolate Drink 40g", "brand": "Energen", "category": "BEVERAGES", "retail_price": 9.00, "cost_price": 8.00},
    {"barcode": "965412919613", "name": "Energen Cereal Drink Mix Vanilla Hanger 40g", "brand": "Energen", "category": "BEVERAGES", "retail_price": 8.60, "cost_price": 7.50},
    
    # SNACKS
    {"barcode": "489120804013", "name": "Oishi Prawn Crackers 60g", "brand": "Oishi", "category": "SNACK", "retail_price": 17.60, "cost_price": 15.50},
    {"barcode": "893921341445", "name": "San Sky Flakes Crackers Original 25g x 10s", "brand": "M.Y. San", "category": "SNACK", "retail_price": 58.40, "cost_price": 52.50},
    {"barcode": "893951811445", "name": "Hansel Mocha Sandwich", "brand": "Rebisco", "category": "SNACK", "retail_price": 60.20, "cost_price": 54.00},
    
    # CANNED GOODS
    {"barcode": "748485200019", "name": "555 Sardines in Tomato Sauce 155g", "brand": "555", "category": "CANNED_GOODS", "retail_price": 25.00, "cost_price": 22.00},
    {"barcode": "748485800035", "name": "Argentina Corned Beef 260g", "brand": "Argentina", "category": "CANNED_GOODS", "retail_price": 57.50, "cost_price": 52.00},
    {"barcode": "480002201028", "name": "Hunts Pork & Beans 100g Doy", "brand": "Hunts", "category": "CANNED_GOODS", "retail_price": 14.50, "cost_price": 13.00},
    
    # DAIRY
    {"barcode": "480057511015", "name": "Alaska Classic Evaporated Filled Milk 140ml", "brand": "Alaska", "category": "DAIRY", "retail_price": 28.20, "cost_price": 25.50},
    {"barcode": "480057513016", "name": "Alaska Condensada Sweetened Condensed Creamer 168ml", "brand": "Alaska", "category": "DAIRY", "retail_price": 39.00, "cost_price": 35.00},
    {"barcode": "480864702009", "name": "Eden Cheese 165g", "brand": "Mondelez", "category": "DAIRY", "retail_price": 78.00, "cost_price": 70.00},
    {"barcode": "480535824701", "name": "Dari Creme Butter Milk 100g", "brand": "Dari Creme", "category": "DAIRY", "retail_price": 41.00, "cost_price": 37.00},
    
    # CONDIMENTS
    {"barcode": "000008586780", "name": "Datu Puti Patis 1L", "brand": "Datu Puti", "category": "CONDIMENTS", "retail_price": 80.85, "cost_price": 73.00},
    {"barcode": "642611907726", "name": "Ajinomoto Seasoning Mix 50g", "brand": "Ajinomoto", "category": "BEVERAGES", "retail_price": 13.00, "cost_price": 11.50},
    
    # PERSONAL CARE
    {"barcode": "642647382226", "name": "Sisters Night Plus Cottony Napkin", "brand": "Sisters", "category": "PERSONAL_CARE", "retail_price": 44.50, "cost_price": 40.00},
    {"barcode": "642321541122", "name": "Sisters Overnight Dry", "brand": "Sisters", "category": "PERSONAL_CARE", "retail_price": 117.00, "cost_price": 105.00},
    {"barcode": "672329634182", "name": "Whisper Cottony Soft Clean X-Long Overnight", "brand": "Whisper", "category": "PERSONAL_CARE", "retail_price": 128.00, "cost_price": 115.00},
    {"barcode": "480088814685", "name": "Sunsilk Strong & Long 350ml", "brand": "Sunsilk", "category": "PERSONAL_CARE", "retail_price": 150.00, "cost_price": 135.00},
    
    # HOUSEHOLD
    {"barcode": "870021639476", "name": "Downy Sunrise Fresh Fabric Conditioner Sachet 20ml", "brand": "Downy", "category": "HOUSEHOLD", "retail_price": 7.00, "cost_price": 6.00},
    {"barcode": "480004784003", "name": "Zonrox Original Bleach 250ml", "brand": "Zonrox", "category": "HOUSEHOLD", "retail_price": 38.00, "cost_price": 34.00},
    {"barcode": "037000359562", "name": "Ariel With a Touch of Downy Freshness Powder", "brand": "Ariel", "category": "HOUSEHOLD", "retail_price": 660.00, "cost_price": 595.00},
    {"barcode": "490243086729", "name": "Joy Dishwashing Liquid Lemon 475ml", "brand": "Joy", "category": "HOUSEHOLD", "retail_price": 134.00, "cost_price": 120.00},
    {"barcode": "490243078997", "name": "Joy Dishwashing Liquid Lemon Sachet 40ml", "brand": "Joy", "category": "HOUSEHOLD", "retail_price": 12.00, "cost_price": 10.50},
]

# Brands that run manufacturer campaigns
CAMPAIGN_BRANDS = ["Coca-Cola", "Pepsi", "Nestle", "Oishi", "Alaska", "Ariel", "Joy", "555"]

# Payment method distribution (70% CASH, 30% GCASH)
PAYMENT_METHODS = ["CASH", "CASH", "CASH", "CASH", "CASH", "CASH", "CASH", "GCASH", "GCASH", "GCASH"]


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
    multiplier: float = 2.5
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


# =============================================================================
# Event Generators
# =============================================================================

def generate_brand_campaigns(year: int, num_campaigns: int = 3) -> list[BrandCampaign]:
    """Generate random brand advertising campaigns for a year"""
    campaigns = []
    used_months = set()
    
    for _ in range(num_campaigns):
        # Pick a random brand
        brand = random.choice(CAMPAIGN_BRANDS)
        
        # Pick a random month (avoid duplicates)
        available_months = [m for m in range(1, 13) if m not in used_months]
        if not available_months:
            break
        month = random.choice(available_months)
        used_months.add(month)
        
        # Random week within the month
        day = random.randint(1, 21)
        start_date = datetime(year, month, day)
        end_date = start_date + timedelta(days=random.randint(5, 10))
        
        campaign_names = [
            f"{brand} TV Commercial Campaign",
            f"{brand} Summer Blitz",
            f"{brand} Back to School Promo",
            f"{brand} Holiday Special",
            f"{brand} Anniversary Sale",
            f"{brand} Product Launch",
        ]
        
        campaigns.append(BrandCampaign(
            name=random.choice(campaign_names),
            brand=brand,
            start_date=start_date,
            end_date=end_date,
            multiplier=random.uniform(2.0, 3.0)
        ))
    
    return campaigns


def generate_store_promos(year: int) -> list[StorePromo]:
    """Generate store-initiated promotions"""
    promos = []
    
    # Monthly store promos (random products)
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
        Holiday("Holy Week", datetime(year, 3, 28), 4, 1.5),  # Approximate
        Holiday("Labor Day", datetime(year, 5, 1), 1, 1.3),
        Holiday("Independence Day", datetime(year, 6, 12), 1, 1.3),
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
    
    # December boost (Christmas season) - applies to all
    if month == 12:
        return 1.5
    
    # November pre-Christmas
    if month == 11:
        return 1.2
    
    # Summer boost for beverages (April-May, Philippine summer)
    if month in [4, 5] and category in ["BEVERAGES", "SODA"]:
        return 1.4
    
    # March-April (graduation/summer start)
    if month in [3, 4]:
        return 1.1
    
    # August (back to school)
    if month == 8:
        return 1.15
    
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


def is_within_campaign(date: datetime, campaigns: list[BrandCampaign], brand: str) -> tuple[bool, BrandCampaign | None]:
    """Check if a brand has an active campaign on this date"""
    for campaign in campaigns:
        if campaign.brand == brand and campaign.start_date <= date <= campaign.end_date:
            return True, campaign
    return False, None


def is_within_store_promo(date: datetime, promos: list[StorePromo], barcode: str) -> tuple[bool, StorePromo | None]:
    """Check if a product has an active store promo on this date"""
    for promo in promos:
        if barcode in promo.product_barcodes and promo.start_date <= date <= promo.end_date:
            return True, promo
    return False, None


def is_within_holiday(date: datetime, holidays: list[Holiday]) -> tuple[bool, Holiday | None]:
    """Check if date falls within a holiday period"""
    for holiday in holidays:
        end_date = holiday.date + timedelta(days=holiday.duration_days)
        if holiday.date <= date <= end_date:
            return True, holiday
    return False, None


# =============================================================================
# Sales Generation
# =============================================================================

def generate_daily_sales(
    date: datetime,
    product: dict,
    campaigns: list[BrandCampaign],
    promos: list[StorePromo],
    holidays: list[Holiday]
) -> dict:
    """Generate sales record for a single product on a single day"""
    
    # Base velocity: 5-15 units per day (seeded by product for consistency)
    random.seed(hash(product["barcode"]) + date.toordinal())
    base_velocity = random.randint(5, 15)
    
    # Reset seed to be truly random for quantity variation
    random.seed()
    
    # Apply multipliers
    multiplier = 1.0
    is_event = False
    event_source = EventSource.NONE
    event_name = ""
    
    # 1. Seasonality (always applies)
    seasonality_mult = get_seasonality_multiplier(date, product["category"])
    multiplier *= seasonality_mult
    
    # 2. Day of week
    dow_mult = get_day_of_week_multiplier(date)
    multiplier *= dow_mult
    
    # 3. Check for brand campaign
    in_campaign, campaign = is_within_campaign(date, campaigns, product["brand"])
    if in_campaign and campaign:
        multiplier *= campaign.multiplier
        is_event = True
        event_source = EventSource.MANUFACTURER_CAMPAIGN
        event_name = campaign.name
    
    # 4. Check for store promo (can stack with brand campaign)
    in_promo, promo = is_within_store_promo(date, promos, product["barcode"])
    if in_promo and promo:
        multiplier *= promo.multiplier
        is_event = True
        # If already had a campaign, prefer store promo as source
        if event_source == EventSource.NONE:
            event_source = EventSource.STORE_DISCOUNT
            event_name = promo.name
    
    # 5. Check for holiday
    in_holiday, holiday = is_within_holiday(date, holidays)
    if in_holiday and holiday:
        multiplier *= holiday.multiplier
        if event_source == EventSource.NONE:
            is_event = True
            event_source = EventSource.HOLIDAY
            event_name = holiday.name
    
    # Calculate final quantity with some randomness
    quantity = int(base_velocity * multiplier)
    quantity = max(1, quantity + random.randint(-2, 2))  # Add noise
    
    # Calculate financials
    subtotal = round(quantity * product["retail_price"], 2)
    cost_total = round(quantity * product["cost_price"], 2)
    profit = round(subtotal - cost_total, 2)
    
    # Randomly assign payment method (70% CASH, 30% GCASH)
    payment_method = random.choice(PAYMENT_METHODS)
    
    return {
        "date": date.strftime("%Y-%m-%d"),
        "barcode": product["barcode"],
        "product_name": product["name"],
        "brand": product["brand"],
        "category": product["category"],
        "quantity": quantity,
        "retail_price": product["retail_price"],
        "cost_price": product["cost_price"],
        "subtotal": subtotal,
        "cost_total": cost_total,
        "profit": profit,
        "payment_method": payment_method,
        "is_event": is_event,
        "event_source": event_source.value if event_source else "",
        "event_name": event_name,
        "seasonality_multiplier": round(seasonality_mult, 2),
        "total_multiplier": round(multiplier, 2),
    }


def generate_all_sales() -> list[dict]:
    """Generate complete sales history"""
    print("🚀 Starting Christian Minimart Sales History Generation v2")
    print(f"📅 Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    print(f"📦 Products: {len(PRODUCTS)}")
    
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
            print(f"      - {c.name} ({c.brand}): {c.start_date.strftime('%m/%d')} - {c.end_date.strftime('%m/%d')}, {c.multiplier:.1f}x")
        print(f"   🏪 Store Promos: {len(promos)}")
        print(f"   🎉 Holidays: {len(holidays)}")
    
    # Generate daily sales
    print("\n⏳ Generating daily sales data...")
    current_date = START_DATE
    total_days = (END_DATE - START_DATE).days
    
    while current_date <= END_DATE:
        for product in PRODUCTS:
            sale = generate_daily_sales(
                current_date,
                product,
                all_campaigns,
                all_promos,
                all_holidays
            )
            all_sales.append(sale)
        
        current_date += timedelta(days=1)
    
    print(f"✅ Generated {len(all_sales):,} sales records")
    
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
    """Print summary statistics"""
    print("\n" + "=" * 60)
    print("📊 SUMMARY STATISTICS")
    print("=" * 60)
    
    total_revenue = sum(s["subtotal"] for s in sales)
    total_cost = sum(s["cost_total"] for s in sales)
    total_profit = sum(s["profit"] for s in sales)
    total_units = sum(s["quantity"] for s in sales)
    
    print(f"💰 Total Revenue: ₱{total_revenue:,.2f}")
    print(f"📦 Total Units Sold: {total_units:,}")
    print(f"💵 Total Cost: ₱{total_cost:,.2f}")
    print(f"📈 Total Profit: ₱{total_profit:,.2f}")
    print(f"📊 Profit Margin: {(total_profit/total_revenue)*100:.1f}%")
    
    # Event-driven sales
    event_sales = [s for s in sales if s["is_event"]]
    organic_sales = [s for s in sales if not s["is_event"]]
    
    print(f"\n🎯 Event-Driven Sales: {len(event_sales):,} records ({len(event_sales)/len(sales)*100:.1f}%)")
    print(f"🌿 Organic Sales: {len(organic_sales):,} records ({len(organic_sales)/len(sales)*100:.1f}%)")
    
    if event_sales:
        event_revenue = sum(s["subtotal"] for s in event_sales)
        print(f"💥 Event Revenue: ₱{event_revenue:,.2f} ({event_revenue/total_revenue*100:.1f}% of total)")
    
    # By event source
    from collections import Counter
    event_sources = Counter(s["event_source"] for s in sales if s["event_source"])
    print("\n📋 Event Sources:")
    for source, count in event_sources.most_common():
        print(f"   - {source}: {count:,} records")


# =============================================================================
# Main Execution
# =============================================================================

if __name__ == "__main__":
    # Generate all data
    sales, campaigns, promos, holidays = generate_all_sales()
    
    # Export to CSV files
    export_to_csv(sales, OUTPUT_FILE)
    export_events_csv(campaigns, promos, holidays, "events_log.csv")
    
    # Print summary
    print_summary_stats(sales)
    
    print("\n✅ Generation Complete!")
    print(f"📁 Files created:")
    print(f"   - {OUTPUT_FILE} (Transaction history)")
    print(f"   - events_log.csv (Events for EventLog table)")
