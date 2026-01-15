#!/usr/bin/env python3
"""
Christian Minimart - Supplier & Inventory Batch Data Generator
==============================================================
Generates 3 years (2024-2026) of realistic supplier transaction data including:

1. Suppliers: Multiple wholesale/distributor entities with realistic Philippine business names
2. InventoryBatch: Deliveries from suppliers (restocks with expiry dates)
3. StockMovement: Returns to suppliers (SUPPLIER_RETURN type for expired/damaged goods)

Outputs:
- suppliers.csv: Supplier master data
- inventory_batches.csv: Delivery records (restocks)
- stock_movements_returns.csv: Supplier return records

This data can be imported via Prisma seed or a bulk import action.
"""

import csv
import random
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict
import math

# =============================================================================
# Configuration
# =============================================================================

START_DATE = datetime(2024, 1, 1)
END_DATE = datetime.now().replace(hour=23, minute=59, second=59)

OUTPUT_SUPPLIERS = "suppliers.csv"
OUTPUT_BATCHES = "inventory_batches.csv"
OUTPUT_RETURNS = "stock_movements_returns.csv"

# Supplier Generation Parameters
NUM_SUPPLIERS = 15  # Total number of suppliers to generate

# Restocking Pattern Parameters
AVG_RESTOCK_FREQUENCY_DAYS = 14  # Average days between restocks per supplier
MIN_BATCH_QTY = 10  # Minimum quantity per batch
MAX_BATCH_QTY = 200  # Maximum quantity per batch
EXPIRY_DAYS_MIN = 30  # Minimum days until expiry (from received date)
EXPIRY_DAYS_MAX = 365  # Maximum days until expiry

# Return Pattern Parameters
RETURN_PROBABILITY = 0.08  # 8% of batches will have returns
RETURN_QTY_PERCENT_MIN = 0.1  # Minimum 10% of batch returned
RETURN_QTY_PERCENT_MAX = 0.5  # Maximum 50% of batch returned

# =============================================================================
# Supplier Templates
# =============================================================================

# Realistic Philippine wholesale distributors
SUPPLIER_TEMPLATES = [
    {
        "name": "San Miguel Corporation",
        "contact_person": "Juan dela Cruz",
        "contact_number": "+63 2 8632 2000",
        "email": "orders@sanmiguel.com.ph",
        "address": "40 San Miguel Avenue, Ortigas Center, Pasig City",
        "categories": ["BEVERAGES", "SODA", "SOFTDRINKS_CASE"],
    },
    {
        "name": "Coca-Cola Beverages Philippines",
        "contact_person": "Maria Santos",
        "contact_number": "+63 2 8884 2653",
        "email": "sales@coca-cola.com.ph",
        "address": "2286 Don Chino Roces Ave., Makati City",
        "categories": ["SODA", "SOFTDRINKS_CASE", "BEVERAGES"],
    },
    {
        "name": "Pepsi-Cola Products Philippines",
        "contact_person": "Roberto Reyes",
        "contact_number": "+63 2 8878 9000",
        "email": "distribution@pepsi.com.ph",
        "address": "Pepsi Building, Meralco Avenue, Pasig City",
        "categories": ["SODA", "SOFTDRINKS_CASE", "BEVERAGES"],
    },
    {
        "name": "Nestle Philippines Inc.",
        "contact_person": "Ana Garcia",
        "contact_number": "+63 2 8687 5000",
        "email": "orders@nestle.com.ph",
        "address": "Rockwell Business Center, Makati City",
        "categories": ["BEVERAGES", "DAIRY", "SNACK"],
    },
    {
        "name": "URC (Universal Robina Corporation)",
        "contact_person": "Miguel Torres",
        "contact_number": "+63 2 8633 7631",
        "email": "sales@urc.com.ph",
        "address": "110 E. Rodriguez Jr. Ave., Quezon City",
        "categories": ["SNACK", "BEVERAGES", "INSTANT_NOODLES"],
    },
    {
        "name": "Monde Nissin Corporation",
        "contact_person": "Linda Bautista",
        "contact_number": "+63 2 8810 6001",
        "email": "orders@mondenissin.com.ph",
        "address": "Km 18 West Service Road, Parañaque City",
        "categories": ["INSTANT_NOODLES", "SNACK"],
    },
    {
        "name": "Century Pacific Food Inc.",
        "contact_person": "Carlos Mendoza",
        "contact_number": "+63 2 8836 1580",
        "email": "distribution@centurypacific.com.ph",
        "address": "7th Floor, Centerpoint Building, Ortigas Center",
        "categories": ["CANNED_GOODS", "DAIRY"],
    },
    {
        "name": "Alaska Milk Corporation",
        "contact_person": "Teresa Villanueva",
        "contact_number": "+63 2 8867 8888",
        "email": "sales@alaskamilk.com.ph",
        "address": "4th Floor, Corinthian Plaza, Paseo de Roxas, Makati",
        "categories": ["DAIRY", "BEVERAGES"],
    },
    {
        "name": "Procter & Gamble Philippines",
        "contact_person": "Marco Gonzales",
        "contact_number": "+63 2 8838 0000",
        "email": "orders@pg.com.ph",
        "address": "19th Floor, Net One Center, BGC, Taguig",
        "categories": ["PERSONAL_CARE", "HOUSEHOLD"],
    },
    {
        "name": "Unilever Philippines",
        "contact_person": "Diana Ramos",
        "contact_number": "+63 2 8892 0611",
        "email": "supply@unilever.com.ph",
        "address": "1351 United Nations Ave., Ermita, Manila",
        "categories": ["PERSONAL_CARE", "HOUSEHOLD", "CONDIMENTS"],
    },
    {
        "name": "NutriAsia Inc.",
        "contact_person": "Ramon Castillo",
        "contact_number": "+63 2 8571 2836",
        "email": "sales@nutriasia.com.ph",
        "address": "8th Floor, The Salcedo Towers, Makati",
        "categories": ["CONDIMENTS", "CANNED_GOODS"],
    },
    {
        "name": "Rebisco Group of Companies",
        "contact_person": "Patricia Lim",
        "contact_number": "+63 2 8635 9901",
        "email": "orders@rebisco.com.ph",
        "address": "224 Quirino Highway, Novaliches, Quezon City",
        "categories": ["SNACK"],
    },
    {
        "name": "Oishi Snack Time",
        "contact_person": "Kevin Sy",
        "contact_number": "+63 2 8631 0101",
        "email": "distribution@oishi.com.ph",
        "address": "Liwasang Bonifacio, Tondo, Manila",
        "categories": ["SNACK", "BEVERAGES"],
    },
    {
        "name": "Del Monte Philippines Inc.",
        "contact_person": "Maricar Cruz",
        "contact_number": "+63 2 8895 0000",
        "email": "orders@delmonte.com.ph",
        "address": "JMT Corporate Condominium, Ortigas, Pasig",
        "categories": ["CANNED_GOODS", "CONDIMENTS"],
    },
    {
        "name": "Philippine Seven Corp (7-Eleven Dist.)",
        "contact_person": "Joseph Tan",
        "contact_number": "+63 2 8856 0711",
        "email": "supplier@7-eleven.com.ph",
        "address": "7-Eleven Building, EDSA corner Connecticut, Mandaluyong",
        "categories": ["SNACK", "BEVERAGES", "PERSONAL_CARE"],
    },
]

# Product catalog (matching Christian Minimart database)
PRODUCTS = [
    # SODA - Individual bottles
    {"barcode": "544900000099", "name": "Coca-Cola Mismo 295ml", "category": "SODA", "cost_price": 18.00},
    {"barcode": "480198112005", "name": "Sprite 500ml", "category": "SODA", "cost_price": 22.50},
    {"barcode": "480198112010", "name": "Royal Tru Orange 500ml", "category": "SODA", "cost_price": 22.50},
    {"barcode": "480198112000", "name": "Coke 500ml", "category": "SODA", "cost_price": 22.50},
    {"barcode": "480392525114", "name": "Mountain Dew 500ml", "category": "SODA", "cost_price": 20.00},
    {"barcode": "480392525110", "name": "Pepsi 500ml", "category": "SODA", "cost_price": 20.00},
    {"barcode": "480198111607", "name": "Coke 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480198118062", "name": "Sprite 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480191198062", "name": "Royal Tru Orange 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480392515114", "name": "Mountain Dew 1.5L", "category": "SODA", "cost_price": 50.00},
    {"barcode": "480392515110", "name": "Pepsi 1.5L", "category": "SODA", "cost_price": 50.00},
    {"barcode": "480198111664", "name": "Coke Zero 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480392515112", "name": "7-up 1.5L", "category": "SODA", "cost_price": 50.00},
    {"barcode": "480198109722", "name": "Royal Tru Strawberry 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480392515116", "name": "Mirinda Orange 1.5L", "category": "SODA", "cost_price": 54.00},
    {"barcode": "480198111696", "name": "Coke Light 1.5L", "category": "SODA", "cost_price": 58.50},
    
    # SOFTDRINKS CASE
    {"barcode": "480198112717", "name": "Coke Swakto 195ml (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 112.00},
    {"barcode": "480198112720", "name": "Royal Swakto 195ml (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 112.00},
    {"barcode": "480198102719", "name": "Sprite Swakto 195ml (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 112.00},
    {"barcode": "480392513032", "name": "Mountain Dew 290ml (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 180.00},
    {"barcode": "480374937310", "name": "Coke 1L (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 315.00},
    {"barcode": "480611352020", "name": "Juicy Lemon 237 ml (1 Bundle)", "category": "SOFTDRINKS_CASE", "cost_price": 127.00},
    {"barcode": "480732471900", "name": "Sprite 1L (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 315.00},
    {"barcode": "542353276241", "name": "Royal 1L (1 Case)", "category": "SOFTDRINKS_CASE", "cost_price": 315.00},
    
    # BEVERAGES
    {"barcode": "955600121722", "name": "Milo 22g Sachet", "category": "BEVERAGES", "cost_price": 10.50},
    {"barcode": "480036141081", "name": "Nestle Bear Brand Fortified 33g", "category": "BEVERAGES", "cost_price": 10.00},
    {"barcode": "480864731007", "name": "Tang Orange 250g", "category": "BEVERAGES", "cost_price": 195.00},
    {"barcode": "965412919731", "name": "Energen Cereal Milk Chocolate Drink 40g", "category": "BEVERAGES", "cost_price": 8.00},
    {"barcode": "965412919613", "name": "Energen Cereal Drink Mix Vanilla Hanger 40g", "category": "BEVERAGES", "cost_price": 7.50},
    
    # SNACKS
    {"barcode": "489120804013", "name": "Oishi Prawn Crackers 60g", "category": "SNACK", "cost_price": 15.50},
    {"barcode": "893921341445", "name": "San Sky Flakes Crackers Original 25g x 10s", "category": "SNACK", "cost_price": 52.50},
    {"barcode": "893951811445", "name": "Hansel Mocha Sandwich", "category": "SNACK", "cost_price": 54.00},
    
    # CANNED GOODS
    {"barcode": "748485200019", "name": "555 Sardines in Tomato Sauce 155g", "category": "CANNED_GOODS", "cost_price": 22.00},
    {"barcode": "748485800035", "name": "Argentina Corned Beef 260g", "category": "CANNED_GOODS", "cost_price": 52.00},
    {"barcode": "480002201028", "name": "Hunts Pork & Beans 100g Doy", "category": "CANNED_GOODS", "cost_price": 13.00},
    
    # DAIRY
    {"barcode": "480057511015", "name": "Alaska Classic Evaporated Filled Milk 140ml", "category": "DAIRY", "cost_price": 25.50},
    {"barcode": "480057513016", "name": "Alaska Condensada Sweetened Condensed Creamer 168ml", "category": "DAIRY", "cost_price": 35.00},
    {"barcode": "480864702009", "name": "Eden Cheese 165g", "category": "DAIRY", "cost_price": 70.00},
    {"barcode": "480535824701", "name": "Dari Creme Butter Milk 100g", "category": "DAIRY", "cost_price": 37.00},
    
    # CONDIMENTS
    {"barcode": "000008586780", "name": "Datu Puti Patis 1L", "category": "CONDIMENTS", "cost_price": 73.00},
    {"barcode": "642611907726", "name": "Ajinomoto Seasoning Mix 50g", "category": "CONDIMENTS", "cost_price": 11.50},
    
    # PERSONAL CARE
    {"barcode": "642647382226", "name": "Sisters Night Plus Cottony Napkin", "category": "PERSONAL_CARE", "cost_price": 40.00},
    {"barcode": "642321541122", "name": "Sisters Overnight Dry", "category": "PERSONAL_CARE", "cost_price": 105.00},
    {"barcode": "672329634182", "name": "Whisper Cottony Soft Clean X-Long Overnight", "category": "PERSONAL_CARE", "cost_price": 115.00},
    {"barcode": "480088814685", "name": "Sunsilk Strong & Long 350ml", "category": "PERSONAL_CARE", "cost_price": 135.00},
    
    # HOUSEHOLD
    {"barcode": "870021639476", "name": "Downy Sunrise Fresh Fabric Conditioner Sachet 20ml", "category": "HOUSEHOLD", "cost_price": 6.00},
    {"barcode": "480004784003", "name": "Zonrox Original Bleach 250ml", "category": "HOUSEHOLD", "cost_price": 34.00},
    {"barcode": "037000359562", "name": "Ariel With a Touch of Downy Freshness Powder", "category": "HOUSEHOLD", "cost_price": 595.00},
    {"barcode": "490243086729", "name": "Joy Dishwashing Liquid Lemon 475ml", "category": "HOUSEHOLD", "cost_price": 120.00},
    {"barcode": "490243078997", "name": "Joy Dishwashing Liquid Lemon Sachet 40ml", "category": "HOUSEHOLD", "cost_price": 10.50},
    
    # INSTANT NOODLES
    {"barcode": "489310100015", "name": "Lucky Me Pancit Canton with Kalamnsi 60g", "category": "INSTANT_NOODLES", "cost_price": 11.00},
]

# Product lookup by barcode
PRODUCTS_BY_BARCODE = {p["barcode"]: p for p in PRODUCTS}

# Product lookup by category
PRODUCTS_BY_CATEGORY = defaultdict(list)
for p in PRODUCTS:
    PRODUCTS_BY_CATEGORY[p["category"]].append(p)


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Supplier:
    id: int
    name: str
    contact_person: str
    contact_number: str
    email: str
    address: str
    notes: str
    status: str
    categories: list  # Categories this supplier can provide


@dataclass
class InventoryBatch:
    id: int
    product_barcode: str
    product_name: str
    quantity: int
    expiry_date: Optional[datetime]
    received_date: datetime
    supplier_ref: str
    supplier_name: str
    supplier_id: int
    cost_price: float
    status: str


@dataclass
class StockMovementReturn:
    id: int
    batch_id: int  # Reference to the original batch
    product_barcode: str
    product_name: str
    supplier_id: int
    supplier_name: str
    movement_type: str  # SUPPLIER_RETURN
    quantity_change: int  # Negative (stock removed)
    reason: str
    reference: str
    cost_price: float
    created_at: datetime


# =============================================================================
# Inflation Functions
# =============================================================================

ANNUAL_INFLATION_RATE = 0.045

def get_inflation_factor(date: datetime) -> float:
    """Calculate cumulative inflation factor from start date."""
    days_from_start = (date - START_DATE).days
    years_from_start = days_from_start / 365.25
    return 1 + (ANNUAL_INFLATION_RATE * years_from_start)


def get_inflated_cost(base_cost: float, date: datetime) -> float:
    """Get inflation-adjusted cost price for a given date."""
    factor = get_inflation_factor(date)
    return round(base_cost * factor, 2)


# =============================================================================
# Generator Functions
# =============================================================================

def generate_suppliers() -> list[Supplier]:
    """Generate supplier records from templates."""
    suppliers = []
    
    for idx, template in enumerate(SUPPLIER_TEMPLATES[:NUM_SUPPLIERS], start=1):
        supplier = Supplier(
            id=idx,
            name=template["name"],
            contact_person=template["contact_person"],
            contact_number=template["contact_number"],
            email=template["email"],
            address=template["address"],
            notes=f"Primary distributor for {', '.join(template['categories'][:2])}",
            status="ACTIVE",
            categories=template["categories"],
        )
        suppliers.append(supplier)
    
    return suppliers


def generate_supplier_ref(supplier_name: str, date: datetime, index: int) -> str:
    """Generate a realistic supplier reference/invoice number."""
    prefix = "".join(word[0] for word in supplier_name.split()[:3]).upper()
    return f"{prefix}-{date.strftime('%Y%m%d')}-{index:04d}"


def generate_batches_and_returns(suppliers: list[Supplier]) -> tuple[list[InventoryBatch], list[StockMovementReturn]]:
    """Generate inventory batches (deliveries) and supplier returns over 3 years."""
    batches = []
    returns = []
    
    batch_id = 1
    return_id = 1
    
    # Create a mapping of categories to suppliers
    category_to_suppliers = defaultdict(list)
    for supplier in suppliers:
        for category in supplier.categories:
            category_to_suppliers[category].append(supplier)
    
    # For each product, generate restocks over the date range
    current_date = START_DATE
    
    # Track restocks per product to ensure realistic frequency
    next_restock_date = {p["barcode"]: START_DATE + timedelta(days=random.randint(0, 14)) for p in PRODUCTS}
    
    while current_date <= END_DATE:
        for product in PRODUCTS:
            barcode = product["barcode"]
            category = product["category"]
            
            # Check if it's time to restock this product
            if current_date < next_restock_date[barcode]:
                continue
            
            # Find a supplier for this category
            available_suppliers = category_to_suppliers.get(category, [])
            if not available_suppliers:
                # If no specialized supplier, use a random one
                supplier = random.choice(suppliers)
            else:
                supplier = random.choice(available_suppliers)
            
            # Generate quantity with some variance
            base_qty = random.randint(MIN_BATCH_QTY, MAX_BATCH_QTY)
            
            # Higher demand categories get larger restocks
            if category in ["SODA", "SNACK", "INSTANT_NOODLES"]:
                base_qty = int(base_qty * 1.5)
            elif category in ["SOFTDRINKS_CASE"]:
                base_qty = random.randint(5, 30)  # Cases are larger units
            
            # Seasonal adjustment (more restocks before holidays)
            if current_date.month == 12:  # December rush
                base_qty = int(base_qty * 1.8)
            elif current_date.month in [11, 3, 4]:  # Pre-holiday buildup
                base_qty = int(base_qty * 1.3)
            
            # Calculate expiry date based on product type
            if category in ["DAIRY", "BEVERAGES"]:
                expiry_days = random.randint(30, 180)
            elif category in ["CANNED_GOODS"]:
                expiry_days = random.randint(365, 730)  # 1-2 years
            elif category in ["PERSONAL_CARE", "HOUSEHOLD"]:
                expiry_days = random.randint(365, 1095)  # 1-3 years
            elif category in ["CONDIMENTS"]:
                expiry_days = random.randint(180, 365)
            else:
                expiry_days = random.randint(EXPIRY_DAYS_MIN, EXPIRY_DAYS_MAX)
            
            expiry_date = current_date + timedelta(days=expiry_days)
            
            # Get inflation-adjusted cost
            cost_price = get_inflated_cost(product["cost_price"], current_date)
            
            # Create batch record
            supplier_ref = generate_supplier_ref(supplier.name, current_date, batch_id)
            
            batch = InventoryBatch(
                id=batch_id,
                product_barcode=barcode,
                product_name=product["name"],
                quantity=base_qty,
                expiry_date=expiry_date,
                received_date=current_date,
                supplier_ref=supplier_ref,
                supplier_name=supplier.name,
                supplier_id=supplier.id,
                cost_price=cost_price,
                status="ACTIVE",
            )
            batches.append(batch)
            
            # Possibly generate a return for this batch (expired or damaged goods)
            if random.random() < RETURN_PROBABILITY:
                # Return happens after some time (when items are near expiry or found damaged)
                max_delay = min(expiry_days - 5, 180)
                if max_delay < 30:
                    max_delay = 30  # Ensure valid range
                return_delay_days = random.randint(30, max_delay)
                return_date = current_date + timedelta(days=return_delay_days)
                
                if return_date <= END_DATE:
                    return_qty = int(base_qty * random.uniform(RETURN_QTY_PERCENT_MIN, RETURN_QTY_PERCENT_MAX))
                    return_qty = max(1, return_qty)  # At least 1 item
                    
                    # Reason for return
                    reasons = [
                        "Near expiry - supplier policy return",
                        "Damaged packaging discovered during inventory check",
                        "Product recall by manufacturer",
                        "Quality issue reported by customers",
                        "Expired stock - supplier credit agreement",
                    ]
                    
                    return_record = StockMovementReturn(
                        id=return_id,
                        batch_id=batch_id,
                        product_barcode=barcode,
                        product_name=product["name"],
                        supplier_id=supplier.id,
                        supplier_name=supplier.name,
                        movement_type="SUPPLIER_RETURN",
                        quantity_change=-return_qty,  # Negative = removed from stock
                        reason=random.choice(reasons),
                        reference=f"RET-{supplier_ref}",
                        cost_price=cost_price,
                        created_at=return_date,
                    )
                    returns.append(return_record)
                    return_id += 1
            
            batch_id += 1
            
            # Schedule next restock for this product
            restock_variance = random.randint(-3, 7)  # Some variance in restock timing
            next_restock_date[barcode] = current_date + timedelta(days=AVG_RESTOCK_FREQUENCY_DAYS + restock_variance)
        
        # Move to next day
        current_date += timedelta(days=1)
    
    return batches, returns


# =============================================================================
# CSV Writers
# =============================================================================

def write_suppliers_csv(suppliers: list[Supplier], filename: str):
    """Write suppliers to CSV file."""
    fieldnames = [
        "id", "name", "contact_person", "contact_number", 
        "email", "address", "notes", "status"
    ]
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for s in suppliers:
            writer.writerow({
                "id": s.id,
                "name": s.name,
                "contact_person": s.contact_person,
                "contact_number": s.contact_number,
                "email": s.email,
                "address": s.address,
                "notes": s.notes,
                "status": s.status,
            })
    
    print(f"✅ Wrote {len(suppliers)} suppliers to {filename}")


def write_batches_csv(batches: list[InventoryBatch], filename: str):
    """Write inventory batches to CSV file."""
    fieldnames = [
        "id", "product_barcode", "product_name", "quantity", "expiry_date",
        "received_date", "supplier_ref", "supplier_name", "supplier_id",
        "cost_price", "status"
    ]
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for b in batches:
            writer.writerow({
                "id": b.id,
                "product_barcode": b.product_barcode,
                "product_name": b.product_name,
                "quantity": b.quantity,
                "expiry_date": b.expiry_date.strftime("%Y-%m-%d") if b.expiry_date else "",
                "received_date": b.received_date.strftime("%Y-%m-%d %H:%M:%S"),
                "supplier_ref": b.supplier_ref,
                "supplier_name": b.supplier_name,
                "supplier_id": b.supplier_id,
                "cost_price": b.cost_price,
                "status": b.status,
            })
    
    print(f"✅ Wrote {len(batches)} inventory batches to {filename}")


def write_returns_csv(returns: list[StockMovementReturn], filename: str):
    """Write supplier returns to CSV file."""
    fieldnames = [
        "id", "batch_id", "product_barcode", "product_name", "supplier_id",
        "supplier_name", "movement_type", "quantity_change", "reason",
        "reference", "cost_price", "created_at"
    ]
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for r in returns:
            writer.writerow({
                "id": r.id,
                "batch_id": r.batch_id,
                "product_barcode": r.product_barcode,
                "product_name": r.product_name,
                "supplier_id": r.supplier_id,
                "supplier_name": r.supplier_name,
                "movement_type": r.movement_type,
                "quantity_change": r.quantity_change,
                "reason": r.reason,
                "reference": r.reference,
                "cost_price": r.cost_price,
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            })
    
    print(f"✅ Wrote {len(returns)} supplier returns to {filename}")


# =============================================================================
# Statistics
# =============================================================================

def print_statistics(suppliers: list[Supplier], batches: list[InventoryBatch], returns: list[StockMovementReturn]):
    """Print summary statistics about generated data."""
    print("\n" + "=" * 60)
    print("📊 GENERATION STATISTICS")
    print("=" * 60)
    
    print(f"\n📦 Suppliers: {len(suppliers)}")
    
    print(f"\n📥 Inventory Batches (Deliveries): {len(batches):,}")
    
    # Batches by supplier
    batches_by_supplier = defaultdict(int)
    for b in batches:
        batches_by_supplier[b.supplier_name] += 1
    
    print("\n  Batches by Supplier:")
    for name, count in sorted(batches_by_supplier.items(), key=lambda x: -x[1])[:5]:
        print(f"    • {name}: {count:,}")
    print(f"    ... and {len(batches_by_supplier) - 5} more")
    
    # Batches by category
    batches_by_category = defaultdict(int)
    for b in batches:
        product = PRODUCTS_BY_BARCODE.get(b.product_barcode, {})
        category = product.get("category", "UNKNOWN")
        batches_by_category[category] += 1
    
    print("\n  Batches by Category:")
    for category, count in sorted(batches_by_category.items(), key=lambda x: -x[1]):
        print(f"    • {category}: {count:,}")
    
    # Total value of deliveries
    total_delivery_value = sum(b.quantity * b.cost_price for b in batches)
    print(f"\n  Total Delivery Value: ₱{total_delivery_value:,.2f}")
    
    print(f"\n📤 Supplier Returns: {len(returns):,}")
    
    # Returns by reason
    returns_by_reason = defaultdict(int)
    for r in returns:
        returns_by_reason[r.reason] += 1
    
    print("\n  Returns by Reason:")
    for reason, count in sorted(returns_by_reason.items(), key=lambda x: -x[1]):
        print(f"    • {reason[:50]}...: {count}")
    
    # Total value of returns
    total_return_value = sum(abs(r.quantity_change) * r.cost_price for r in returns)
    print(f"\n  Total Return Value: ₱{total_return_value:,.2f}")
    
    # Date range
    if batches:
        first_date = min(b.received_date for b in batches)
        last_date = max(b.received_date for b in batches)
        print(f"\n📅 Date Range: {first_date.strftime('%Y-%m-%d')} to {last_date.strftime('%Y-%m-%d')}")
        days = (last_date - first_date).days
        print(f"   Duration: {days} days (~{days/365:.1f} years)")
    
    print("\n" + "=" * 60)


# =============================================================================
# Main Execution
# =============================================================================

def main():
    print("🏪 Christian Minimart - Supplier Data Generator")
    print("=" * 60)
    print(f"📅 Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    print()
    
    # Step 1: Generate suppliers
    print("📦 Generating suppliers...")
    suppliers = generate_suppliers()
    
    # Step 2: Generate batches and returns
    print("📥 Generating inventory batches and returns...")
    print("   (This may take a moment for 3 years of data...)")
    batches, returns = generate_batches_and_returns(suppliers)
    
    # Step 3: Write CSVs
    print("\n💾 Writing CSV files...")
    write_suppliers_csv(suppliers, OUTPUT_SUPPLIERS)
    write_batches_csv(batches, OUTPUT_BATCHES)
    write_returns_csv(returns, OUTPUT_RETURNS)
    
    # Step 4: Print statistics
    print_statistics(suppliers, batches, returns)
    
    print("\n✨ Done! Files generated:")
    print(f"   • {OUTPUT_SUPPLIERS}")
    print(f"   • {OUTPUT_BATCHES}")
    print(f"   • {OUTPUT_RETURNS}")
    print("\nYou can import these files using Prisma seed or bulk import action.")


if __name__ == "__main__":
    main()
