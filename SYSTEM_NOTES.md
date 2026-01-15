Category 1: The Forecasting Engine (The "Heart" of the Thesis)
This is the most critical area. Since you shifted from LSTM (Complex Deep Learning) to WMA (Statistical), you must defend this choice as a feature, not a limitation.
Q1: "Your title says 'Optimization Forecasting'. Why did you use Weighted Moving Average (WMA) instead of advanced AI like LSTM or ARIMA?"
The Defense: "We prioritized explainability and reliability for a small business context.
Data Volume: Deep learning models like LSTM require massive historical datasets (thousands of data points) to be accurate. For a single minimart with 2-3 years of data, LSTM often 'overfits' (memorizes noise).
Responsiveness: In retail, recent sales are the strongest predictor of tomorrow's demand. WMA allows us to weight the last 7 days heavily while still considering the last 30 days.
Performance: WMA runs instantly on the server without expensive GPU costs, making the system affordable for a small business."
Citation Needed Here: Find a study comparing "Complex vs. Simple Forecasting Models in Small Retail." Look for papers that state: “Simple statistical methods often outperform complex neural networks for short-term retail forecasting with limited data.”


Q2: "How does your system handle 'outliers'—like a sudden bulk order or a typhoon day where no one bought anything?"
The Defense: "Our algorithm includes an Outlier Correction step before forecasting.
If a day's generic sales are significantly higher than the standard deviation (e.g., 3x normal), the system 'dampens' that value down to a normal maximum before using it for prediction.
This prevents a single lucky day from causing the system to over-order stock next week."


Q3: "How do you account for seasonality (e.g., higher soft drink sales in summer)?"
The Defense: "We implemented a Year-Over-Year (YoY) Lookback.
When forecasting for upcoming days, the system looks at the same month from the previous year.
If sales were 20% higher last May, the system applies a 'seasonality multiplier' to the WMA result. This captures trends that a simple moving average might miss."

Category 2: System Architecture & Technology
Q4: "Why did you choose a web-based architecture (Next.js) for a POS? Isn't a desktop app faster/more reliable?"
The Defense: "We chose distinct advantages of the Modern Web (PWA) approach:
Unified Ecosystem: Next.js allows us to run the POS, the Inventory Dashboard, and the Vendor/Customer Portal all in one codebase.
Hardware Independence: The owner can check sales on their phone via the dashboard while the cashier uses a PC. No installation is required.
Real-time Synchronization: Using React Server Actions, inventory updates happen instantly across all devices. If a cashier sells an item, the 'Online Pre-order' system immediately knows it's out of stock."


Q5: "Why PostgreSQL instead of MySQL? They are both standard."
The Defense: "We chose PostgreSQL for its robustness with financial data.
Postgres offers stronger data integrity features and better support for complex analytical queries (like the window functions we use for the moving averages).
It also handles concurrent writes better, which is crucial when online orders and physical POS transactions happen simultaneously."

Category 3: Operational & Logic
Q6: "You mentioned FEFO (First-Expired, First-Out). How does the system actually enforce this if the cashier just grabs any item?"
The Defense: "The system enforces FEFO logically to ensure financial accuracy.
Physically: We provide 'Batch Reports' to the staff, instructing them to shelve older items in front.
Systematically: When a sale occurs, the system automatically deducts stock from the batch with the nearest expiry date. This ensures that our 'Profit & Loss' report accurately reflects the cost of the oldest inventory, which is standard accounting practice."


Q7: "How does the system calculate safety stock? What if the delivery is delayed?"
The Defense: "We use a Dynamic Reorder Point (ROP) formula.
Instead of a static number (e.g., 'Order when 10 left'), the system calculates: (Average Daily Sales x Lead Time) + Safety Buffer.
If a product starts selling faster, the ROP automatically rises, prompting the manager to order sooner. This adapts to changing demand velocities."
Citation Needed Here: Look for Operation Management textbooks or papers defining “Dynamic Reorder Point formula in Supply Chain Management.”

Category 4: Security & Integrity
Q8: "What prevents a cashier from stealing money and deleting the transaction?"
The Defense: "We implemented a strict Immutable Audit Log.
Soft Deletes: Transactions are never truly deleted from the database; they are only flagged as status: VOID.
Audit Trail: Every action (Void, Price Change, Stock Adjustment) records the User ID, Timestamp, Old Value, and New Value. The admin can view a 'Suspicious Activity' report that highlights voided transactions."
Summary of Citations to Find:
For Forecasting: "Statistical methods (Moving Averages) vs. Neural Networks for Small-Medium Enterprise (SME) data." (Prove simple is better for small data).
For Inventory: "Benefits of FEFO and Dynamic Reorder Points in reducing perishable waste."
For
Architecture:** "Advantages of Cloud-based/Web-based POS for real-time inventory visibility."******


 Christian Minimart System: Defense & Concept Notes
1. The Core Philosophy: "System 2 Thinking"
Concept: The system doesn't just record data; it analyzes it to prevent errors before they happen.
Defense: "We designed the system to move the owner from 'Intuition-based' ordering (guessing) to 'Data-driven' ordering. The system acts as a smart assistant that suggests what to order and when, based on math, not feelings."

2. The Forecasting Engine (Crucial Defense)
Why NOT Deep Learning (LSTM/AI)?
The Trap: Panelists might ask why you didn't use "modern AI".
The Answer: "Deep Learning requires thousands of data points and is distinctively 'Black Box' (hard to explain why it made a decision). For a small business with ~2 years of data, Statistical Forecasting (WMA) is superior because:
It is Explainable: We can show exactly how the number was calculated.
It is Responsive: It reacts instantly to recent trends.
It is Computationally Efficient: Runs fast on a standard server."
The Formula: "Outlier-Corrected Weighted Moving Average"
This is the "Secret Sauce" of your system. It has 3 steps:
Step 1: Outlier Correction (The Safety Net)
Problem: A typhoon happens (0 sales) or a bulk buyer clears the shelf (100 sales). These are "Outliers" that ruin averages.
Solution: Before calculating, the system scans the last 30 days.
If a day is > 2x Standard Deviation from the average, it strictly caps it.
Example: Average is 10. One day sold 100. The system treats it as ~20 for the forecast, so next week's order isn't bloated.
Step 2: Weighted Moving Average (WMA)
Concept: Recent history matters more than old history.
The Weights:
Last 7 Days: Get 70% of the voting power (High importance).
Last 14 Days: Get 20% importance.
Last 30 Days: Get 10% importance.
Why? In retail, what happened yesterday is a better predictor of tomorrow than what happened last month.
Step 3: Seasonality & Event Adjustments
Concept: "History Rhymes."
YoY (Year-Over-Year): The system checks the same date last year.
If last December sales spiked 50%, the forecast adds a 1.5x multiplier.
Event Awareness: If an event is active (e.g., "Summer Promo"), the system automatically applies a boost multiplier defined in the EventLog.

3. Inventory Management (FEFO & Dynamic ROP)
FEFO: First-Expired, First-Out
The Problem: Most systems use FIFO (First-In, First-Out). But for food, Expiry matters more than Arrival.
Your Solution: When a product is sold, the database query (schema.prisma) specifically looks for the batch with the nearest_expiry_date and deducts from there.
Defense: "This ensures our 'Asset Value' report is financially accurate. We are accounting for the 'oldest' cost first, which aligns with minimizing spoilage losses."
Dynamic ROP: Reorder Point
Old Way: "Order when we have 10 left." (Static)
Your Way: "Order when we have Lead Time days of stock left." (Dynamic)
The Formula:


ROP=(Daily Velocity×Lead Time)+Safety Buffer
ROP=(Daily Velocity×Lead Time)+Safety Buffer


Example:
You sell 5 Cokes/day.
Supplier takes 3 days to deliver.
Safety Buffer is 2 days.
ROP = (5 * 3) + (5 * 2) = 25 units.
Alert triggers when you hit 25, not 10.
Why? If Coke sales suddenly jump to 20/day, the ROP automatically jumps to 100. A static number would cause a stockout.

4. Sales Velocity (The "Pulse" of the Store)
Where it appears: Dashboard "Inventory Health" cards (X.X/day).
Calculation: Sum of Sales (Last 7 Days) / 7.
Defense: "We use a 7-day rolling window for velocity. This smoothes out weekend spikes vs. weekday lulls, giving the owner a realistic 'Speed' of sales to plan cash flow."



5. Technology Stack Defense ("Why Next.js?")
Feature
Why Next.js (App Router)?
Defense
Real-time Sync
Server Actions (use server)
"Inventory updates propagate instantly without complex API setups."
Offline Reliability
PWA Capabilities
"The system caches critical assets, allowing basic viewing even if internet dips."
Database
PostgreSQL + Prisma
"Type-safety guarantees. We cannot accidentally save a 'text' price into a 'decimal' field. Prisma ensures data integrity across complex relations (Batches <-> Products)."
Performance
React Server Components (RSC)
"Heavy calculations (Forecasting) run on the powerful server, not the cheap tablet device, making the UI snappy."


Summary for Q&A
If asked about Accuracy:
"Accuracy is ensured by the Outlier Correction mechanism. We don't just blindly average numbers; we filter out 'noise' (anomalies) first, then apply recent-weighted bias, and finally adjust for seasonal trends."

If asked about Reliability:
"Reliability is enforced by PostgreSQL transactions. When a sale happens, the Inventory Deduction, Sales Record, and Audit Log entry all happen in an atomic transaction. Either they all succeed, or none do. Data can never be 'half-saved'."

Academic Validation (Added from Literature Review)
1. "Why utilize a short WMA window (favoring recent days) instead of a long-term average?"
   - Studies (Parta Trading Co., 2022) confirm that shorter forecasting windows (emphasizing recent months) yield significantly lower Mean Absolute Deviation (MAD) errors (approx. 40% less error) compared to longer windows.
   - In volatile retail environments, "what happened yesterday" is a far stronger predictor than "what happened 6 months ago."
   - Our system uses an *Exponential Decay* weight model (heavily weighting the last 7 days) to capitalize on this finding.

2. "How do you validate the accuracy of your model?"
   - We utilize **Mean Absolute Deviation (MAD)** as a retrospective validation metric.
   - During our validation phase, we tested the model against historical sales. 
   - While we do not compute MAD in real-time (to save server resources), the algorithm itself is designed to minimize deviation by filtering outliers first.
   - Reference: (JAIC, 2023) highlights that using MAD/MSE is the standard for validating WMA-based Decision Support Systems.

3. "Does your system align with industry practices?"
   - Yes. The use of WMA specifically for "avoiding excess inventory" is well-documented (Galaksi Journal).
   - Our method of prioritizing recent data points (Weights summing to 1, higher weights for t-1, t-2...) is the mathematical standard for short-term demand forecasting.

---

## Entity-Relationship Diagram (ERD) Explanation

### Overview
The Christian Minimart database schema implements a **relational model** optimized for retail operations, inventory tracking, and sales analytics. The schema follows **3rd Normal Form (3NF)** to eliminate data redundancy while maintaining query performance through strategic indexing.

### Core Entity Groups

#### 1. **User Management (Authentication & Authorization)**

```
┌─────────────┐
│    User     │
├─────────────┤
│ user_id PK  │
│ username    │
│ password    │
│ role        │──────┐
│ status      │      │  Roles: ADMIN, CASHIER
└─────────────┘      │
       │             │
       ▼             │
┌─────────────┐      │
│ Transaction │◄─────┘  "Who processed this sale?"
└─────────────┘
```

**Defense:** "Every transaction records the cashier who processed it. This creates an audit trail for accountability. If cash is missing, we can trace which user was responsible."

#### 2. **Product & Inventory (The Heart of Retail)**

```
┌──────────────┐       1:1        ┌─────────────┐
│   Product    │─────────────────▶│  Inventory  │
├──────────────┤                  ├─────────────┤
│ product_id PK│                  │ current_stock│
│ product_name │                  │ reorder_level│
│ retail_price │                  │ lead_time    │
│ cost_price   │                  └─────────────┘
│ barcode      │                         │
│ category     │                         │ 1:N
└──────────────┘                         ▼
       │                         ┌───────────────┐
       │ 1:N                     │ StockMovement │
       ▼                         ├───────────────┤
┌────────────────┐               │ movement_type │ (RESTOCK, SALE, RETURN, etc.)
│ InventoryBatch │               │ quantity_change│
├────────────────┤               │ previous_stock │
│ quantity       │               │ new_stock      │
│ expiry_date    │               └───────────────┘
│ cost_price     │
│ supplier_id FK │───────▶ Supplier
└────────────────┘
```

**Key Relationships:**
- **Product → Inventory (1:1):** Each product has exactly ONE inventory record tracking aggregate stock.
- **Product → InventoryBatch (1:N):** Each product can have MULTIPLE batches (different expiry dates, costs).
- **Inventory → StockMovement (1:N):** Every stock change creates an immutable audit record.

**Defense:** "We separated `Inventory` (aggregate totals) from `InventoryBatch` (granular tracking) to support **FEFO** (First-Expired, First-Out). When you sell a product, the system deducts from the batch expiring soonest, not just a single counter."

#### 3. **Supplier Management (Vendor Relationships)**

```
┌─────────────┐
│  Supplier   │
├─────────────┤
│ id PK       │
│ name        │───────────┐
│ contact     │           │
│ email       │           │ 1:N
│ status      │           ▼
└─────────────┘    ┌────────────────┐
       │           │ InventoryBatch │  "Who supplied this batch?"
       │           └────────────────┘
       │ 1:N              
       ▼                  
┌───────────────┐         
│ StockMovement │         "Returns to this supplier"
└───────────────┘         (movement_type = SUPPLIER_RETURN)
```

**Defense:** "By linking batches and returns to suppliers, the system can generate **Supplier Ledgers**—showing total purchases from and returns to each vendor. This is critical for negotiating better terms or identifying unreliable suppliers."

#### 4. **Sales Transaction Flow**

```
┌──────────────┐      1:N      ┌─────────────────┐
│ Transaction  │──────────────▶│ TransactionItem │
├──────────────┤               ├─────────────────┤
│ receipt_no   │               │ quantity        │
│ total_amount │               │ price_at_sale   │
│ user_id FK   │               │ cost_at_sale    │──▶ Enables profit calculation
│ customer_id  │               │ product_id FK   │
└──────────────┘               └─────────────────┘
       │
       │ 1:1
       ▼
┌─────────────┐
│   Payment   │
├─────────────┤
│ method      │  (CASH, GCASH, CREDIT)
│ amount_tendered │
│ change      │
│ gcash_ref   │
└─────────────┘
```

**Defense:** "We store `cost_at_sale` at the moment of transaction. This freezes the profit margin calculation even if product costs change later. This is standard **point-in-time accounting**."

#### 5. **Audit & Compliance**

```
┌─────────────┐
│  AuditLog   │
├─────────────┤
│ action      │  (CREATE, UPDATE, DELETE, BATCH_RETURN, etc.)
│ entity_type │  ("Product", "InventoryBatch", etc.)
│ entity_id   │
│ details     │
│ metadata    │  JSON: { oldValue, newValue }
│ username    │
│ created_at  │
└─────────────┘
```

**Defense:** "The `AuditLog` is **immutable**—there is no UPDATE or DELETE operation on this table. Every administrative action (price change, stock adjustment, batch return) is permanently recorded. This prevents fraud and enables forensic analysis."

#### 6. **Forecasting Support Tables**

```
┌─────────────────────┐
│ DailySalesAggregate │  Pre-computed daily totals
├─────────────────────┤
│ product_id          │
│ date                │
│ quantity_sold       │
│ revenue             │
│ is_event_day        │───────▶ Was this affected by a promotion?
└─────────────────────┘
           │
           │ References
           ▼
┌─────────────┐       N:M       ┌─────────────────┐
│  EventLog   │◄───────────────▶│ EventLogProduct │
├─────────────┤                 └─────────────────┘
│ name        │  "Summer Promo"
│ multiplier  │  1.5 (50% boost expected)
│ start_date  │
│ end_date    │
│ source      │  (STORE_DISCOUNT, HOLIDAY, MANUFACTURER)
└─────────────┘
```

**Defense:** "The `EventLog` table allows the forecasting engine to **distinguish organic demand from artificial spikes**. If a TV ad caused 200% sales, we don't want to over-order next week expecting that to continue."

---

## Data Flow Diagram (DFD) Explanation

### Context Diagram (Level 0)

The attached diagram shows the **Level 0 DFD**—a high-level view of the entire system as a single process interacting with three external entities.

```
                                    ┌─────────────────────────────────────┐
                                    │                                     │
   ┌──────────┐                     │     MINIMART STOCK AND SALES       │
   │ CUSTOMER │◄── Receipt/Invoice ─┤     OPTIMIZATION SYSTEM            │
   │          │── Order Details ───▶│              (0)                   │
   │          │── Payment ─────────▶│                                     │
   └──────────┘                     │                                     │
                                    │                                     │
   ┌──────────┐◄─ Inventory Reports │                                     │
   │ CASHIER  │◄─ Low Stock Alerts ─┤                                     │
   │          │── POS Transaction ─▶│                                     │
   └──────────┘                     │                                     │
                                    │                                     │
   ┌───────────┐                    │                                     │
   │ ADMIN/    │◄─ Restock Decisions┤                                     │
   │ OWNER     │◄─ Sales & Reports ─┤                                     │
   │           │◄─ Demand Forecast ─┤                                     │
   └───────────┘                    └─────────────────────────────────────┘
```

### External Entities

| Entity | Role | Data Sent TO System | Data Received FROM System |
|--------|------|---------------------|---------------------------|
| **CUSTOMER** | End buyer | Order Details, Payment | Receipt/Invoice |
| **CASHIER** | Store operator | POS Transaction data | Inventory Reports (Daily), Low Stock Alerts |
| **ADMIN/OWNER** | Decision maker | (Configuration, Approvals) | Restock Decisions, Sales & Stock Reports, Demand Forecasts |

### Data Flows Explained

#### 1. **Customer → System: Order Details**
- **What:** Product selections, quantities, customer info (if loyalty member)
- **Where it goes:** Creates `Order` record, then `OrderItem` records
- **System Response:** Validates stock availability, calculates totals

#### 2. **Customer → System: Payment**
- **What:** Payment method (Cash/GCash), amount tendered
- **Where it goes:** Creates `Payment` record linked to `Transaction`
- **Triggers:** 
  - Stock deduction from `InventoryBatch` (FEFO)
  - `StockMovement` audit record (type: SALE)
  - `DailySalesAggregate` update for forecasting

#### 3. **System → Customer: Receipt/Invoice**
- **What:** Printed/digital receipt with itemized list, VAT breakdown, change
- **Generated from:** `Transaction` + `TransactionItem` + `Payment` + `StoreSettings`

#### 4. **Cashier → System: POS Transaction Data**
- **What:** Barcode scans, manual entries, void requests
- **Where it goes:** Real-time cart (Zustand store), then persisted as `Transaction`
- **Validation:** System checks current stock before allowing sale

#### 5. **System → Cashier: Inventory Reports (Daily)**
- **What:** Product stock levels, items below reorder point
- **Generated from:** `Inventory` + `Product` JOIN queries
- **Purpose:** Cashier can alert owner about low stock during shift

#### 6. **System → Cashier: Low Stock Alerts**
- **What:** Real-time notifications when stock falls below ROP
- **Generated from:** `Inventory.current_stock < Inventory.reorder_level`
- **Delivery:** Dashboard badges, toast notifications

#### 7. **System → Admin: Restock Decisions**
- **What:** Recommended order quantities, priority rankings
- **Formula:** `(Daily Velocity × Lead Time) + Safety Buffer - Current Stock`
- **Generated from:** `DailySalesAggregate` → WMA calculation → Recommendation

#### 8. **System → Admin: Sales & Stock Reports**
- **What:** Revenue, profit margins, top sellers, slow movers, expiry warnings
- **Generated from:** Aggregated queries on `Transaction`, `TransactionItem`, `InventoryBatch`
- **Formats:** Dashboard cards, exportable CSV, printable Z-Read

#### 9. **System → Admin: Demand Forecast**
- **What:** Predicted sales for next 7/14/30 days per product
- **Algorithm:** Outlier-Corrected Weighted Moving Average (see Forecasting Engine section)
- **Uses:** `DailySalesAggregate` history + `EventLog` adjustments

### Level 1 DFD (Process Decomposition)

The central "Minimart Stock and Sales Optimization System" decomposes into these sub-processes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SYSTEM INTERNALS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ 1.0 POS      │───▶│ 2.0 Inventory│───▶│ 3.0 Reporting &     │  │
│  │ Transaction  │    │ Management   │    │ Forecasting         │  │
│  │ Processing   │    │              │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                   │                      │               │
│         ▼                   ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    D1: PostgreSQL Database                   │   │
│  │  (Products, Inventory, Batches, Transactions, Forecasts)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                   │                      │               │
│         ▼                   ▼                      ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ 4.0 Audit    │    │ 5.0 Supplier │    │ 6.0 User & Access    │  │
│  │ Logging      │    │ Management   │    │ Control              │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Process Descriptions

| Process | Input | Output | Data Store |
|---------|-------|--------|------------|
| **1.0 POS Transaction** | Cart items, Payment | Receipt, Stock updates | Transactions, TransactionItems, Payment |
| **2.0 Inventory Management** | Restocks, Returns, Adjustments | Stock levels, Batch records | Inventory, InventoryBatch, StockMovement |
| **3.0 Reporting & Forecasting** | Historical sales | Forecasts, Reports | DailySalesAggregate, SalesForecast |
| **4.0 Audit Logging** | All system actions | Immutable log | AuditLog |
| **5.0 Supplier Management** | Vendor info, Deliveries | Ledger, Returns | Supplier, InventoryBatch |
| **6.0 User & Access Control** | Login credentials | Session, Permissions | User |

### Defense Summary for DFD

**"The DFD shows clear separation of concerns:**
- **Customers** only interact with the POS (ordering, paying, receiving receipts)
- **Cashiers** operate the system and receive operational alerts
- **Admins** receive strategic insights (forecasts, reports) to make decisions

**Data never flows 'backwards' inappropriately:**
- Customers cannot access inventory data
- Cashiers cannot modify forecasting parameters
- All actions are logged immutably for audit compliance"


