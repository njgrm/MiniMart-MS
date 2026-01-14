# Changelog

All notable changes to Christian Minimart POS System will be documented in this file.

---

## [Unreleased] - 2026-01-16

### Next.js Configuration Fix
- **Fixed:** `next.config.ts` now includes all external image hostnames from products.csv
- Added 15+ domains to `images.remotePatterns` including:
  - marilenminimart.com, imartgrocersph.com, shopmetro.ph, shopsuki.ph
  - store.iloilosupermart.com, static.wixstatic.com, i0.wp.com
  - ddmmw-assets.s3.ap-southeast-1.amazonaws.com, sigemart.com
  - scontent.filo3-1.fna.fbcdn.net, ph-test-11.slatic.net
- Prevents runtime error when navigating to POS with product images

### Analytics Dashboard Data Sync & Bug Fixes

#### Fixed NaN Values in Forecasting Table (`src/lib/forecasting.ts`)
- **Problem:** Most products showed NaN for Forecasted, Recommended, and Est. Cost columns
- **Root Cause:** WMA calculation had off-by-one error when data exceeded 30 days
  - `WMA_WEIGHTS` has 30 elements (indices 0-29)
  - When `values.length = 31`, the loop accessed `normalizedWeights[30]` which was `undefined`
  - `value * undefined = NaN`, which propagated to all dependent calculations
- **Solution:** Cap values array to weights length before calculation:
  ```typescript
  const effectiveValues = values.slice(0, weights.length);
  const effectiveWeights = weights.slice(0, effectiveValues.length);
  ```
- Added defensive NaN handling in UI (shows "—" instead of NaN)

#### Added Tooltips for Forecast Table Columns (`src/app/admin/analytics/analytics-dashboard.tsx`)
- **Forecasted column:** Explains 7-day demand forecast using WMA with seasonality adjustment
- **Rec column:** Explains recommended order quantity calculation with 7-day target + safety buffer
- **Est. Cost column:** Explains cost calculation for budgeting purchase orders

#### Intelligence Feed Now Uses DailySalesAggregate (`src/app/admin/analytics/actions.ts`)
- **Problem:** `getSmartInsights()` was querying `TransactionItem` directly, not synced with pre-aggregated data
- **Solution:** Updated to query `DailySalesAggregate` instead:
  - Velocity calculations now use `dailySalesAggregate.quantity_sold`
  - Monthly revenue comparisons use `dailySalesAggregate.revenue`
  - Much faster query performance (pre-aggregated vs raw transactions)

#### Fixed "27 Years No Sales" Bug
- **Problem:** Products without recent sales showed "No sales for Over 27 years" (9999 days default)
- **Root Cause:** Last sale date was only queried from last 14 days of aggregates
- **Solution:** Added separate query to get actual last sale date for each product:
  ```typescript
  const lastSaleDates = await prisma.dailySalesAggregate.groupBy({
    by: ["product_id"],
    _max: { date: true },
    where: { quantity_sold: { gt: 0 } },
  });
  ```
- Now correctly shows days since actual last sale from full history

#### Demand Forecast Card Requires Backfill
- **Issue:** Demand Forecast card shows no data if `DailySalesAggregate` table is empty
- **Solution:** Run the backfill script to populate aggregates from transaction history:
  ```bash
  npx tsx scripts/backfill-aggregates.ts
  ```
- This populates the last 90 days of sales data into the aggregates table

### Reports Layout Fixes

#### Main Reports Page Now Scrolls (`src/app/admin/layout-client.tsx`)
- **Problem:** Reports index page (`/admin/reports`) couldn't scroll to see all report cards
- **Solution:** Distinguished between main reports page and individual report pages:
  - `isReportPage = pathname?.startsWith("/admin/reports/") && pathname !== "/admin/reports"`
  - Main reports page now uses normal `overflow-auto` like other pages
  - Individual report pages keep `overflow-hidden` for sticky header + single scroll

#### Fixed Background Color
- **Problem:** Report pages used `bg-background` which is not the design standard
- **Solution:** Changed to `bg-[#f5f3ef] dark:bg-muted/30` to match other pages

### Reports Module Complete Redesign

#### ReportShell Component Rewrite (`src/components/reports/report-shell.tsx`)
- **Pattern:** Now follows POS page layout pattern (full-height, no padding)
- **Layout Structure:**
  - Full-height container with `overflow-hidden`
  - Control bar: `shrink-0 bg-card border-b shadow-sm`
  - Scrollable content: `flex-1 overflow-auto p-4 md:p-6 space-y-4`
- **Header:** Uses Shadcn Card with CardHeader/CardTitle/CardDescription
- **Design Tokens:** All components now use proper tokens (`bg-card`, `text-foreground`, `text-muted-foreground`)
- **ReportSummaryCard:** Updated with proper `tabular-nums font-mono` for numeric values

#### Design Token Standardization (All Report Client Pages)
- **Replaced:** `bg-[#F8F6F1]` → `bg-card`
- **Replaced:** `text-[#2d1b1a]` → `text-foreground`
- **Replaced:** `bg-[#FAFAF9]` → `bg-background`
- **Replaced:** `hover:bg-[#F5F3EE]` → `hover:bg-muted/30`
- **Table Headers:** Now use `bg-muted/50` for consistent styling
- **Table Rows:** Use `bg-card/50 hover:bg-muted/30`
- **Numbers:** Added `tabular-nums` class for proper numeric alignment

#### Updated Files:
- `src/components/reports/report-shell.tsx` - Complete rewrite
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/z-read/z-read-client.tsx`
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/app/admin/reports/sales-category/sales-category-client.tsx`
- `src/app/admin/reports/spoilage/spoilage-client.tsx`

---

## [Unreleased] - 2026-01-15

### Reports Module UI/UX Overhaul

#### 1. Print Preview Mode (`src/components/reports/report-shell.tsx`)
- **Problem:** Kiosk Mode causes silent printing without dialog - users can't preview or Save as PDF
- **Solution:** Added fullscreen "Preview Mode" overlay with:
  - Dark backdrop with centered white "paper" preview
  - Floating control bar: "Exit Preview" and "Print Now" buttons
  - Shows exactly what will print before committing
  - Preview controls hidden during actual print via CSS
- New "Preview" button in toolbar (Eye icon) triggers preview mode

#### 2. ReportShell Sticky Header Fix (`src/components/reports/report-shell.tsx`)
- **Root Cause:** Parent layout applies `p-4 md:p-6` padding, sticky header sat inside this padding creating a gap
- **Solution:** Wrap entire ReportShell in negative margin container (`-m-4 md:-m-6`) to break out of parent padding
- Sticky toolbar now uses `z-20` and `px-4 md:px-6` internal padding
- Report content section has `px-4 md:px-6 py-6 bg-[#FAFAF9]` for proper spacing
- Header now sits flush against top navigation bar with no gaps

#### 3. Design System Color Enforcement (All Report Pages)
- **Forbidden:** Pure white (`#FFFFFF`, `bg-white`), emerald-600 for success
- **Page Background:** `bg-[#FAFAF9]` (Stone-50 / Warm White)
- **Table/Card Surfaces:** `bg-[#F8F6F1]` (Soft Off-White)
- **Primary Text:** `text-[#2d1b1a]` (Dark Coffee Brown)
- **Success/Stock:** `#2EAFC5` (Teal) - replaces emerald-600
- **Warning:** `#F1782F` (Orange) - replaces amber-600
- **Danger:** `#AC0F16` (Deep Red) - replaces red-600
- Export/Preview buttons use `bg-[#F8F6F1]` with `border-stone-300`
- Updated `ReportSummaryCard` variants to use design system colors
- Fixed status badges in Velocity, Profit Margin reports
- Fixed profit text colors in Z-Read, Sales by Category reports

#### 4. VelocityReportClient Refactored with Tanstack Table (`src/app/admin/reports/velocity/velocity-client.tsx`)
- Complete rewrite using `@tanstack/react-table`
- Added sorting: Status, Days Left, Capital Tied Up columns
- Added filtering: Status dropdown, Category dropdown
- Added DataTablePagination component (10 items per page)
- Status badges use design system colors (Teal for healthy, Orange for slow, Red for dead)

#### 4. New Report: Z-Read History (`src/app/admin/reports/z-read/`)
- Created `page.tsx` (Server Component) + `z-read-client.tsx` (Client Component)
- Tanstack Table with columns: Date, Transactions, Gross Sales, Voids, Net Profit, Cash, GCash, Closed By
- Sorting enabled on all numeric columns
- DataTablePagination with 10 items per page

#### 5. New Report: Profit Margin Analysis (`src/app/admin/reports/profit-margin/`)
- Created `page.tsx` (Server Component) + `profit-margin-client.tsx` (Client Component)
- Sorted by margin_percent ascending (lowest margins first - needs attention)
- Visual margin progress bar with color coding (red <20%, orange <35%, teal ≥35%)
- Category filter dropdown
- DataTablePagination with 10 items per page

#### 6. New Report: Sales by Category (`src/app/admin/reports/sales-category/`)
- Created `page.tsx` (Server Component) + `sales-category-client.tsx` (Client Component)
- Aggregates 30-day sales data by product category
- Revenue share progress bar visualization
- Sorting on all columns (Revenue, Units, Profit, Margin)
- DataTablePagination with 10 items per page

#### 7. Server Action Fix: `getSalesByCategory()` (`src/actions/reports.ts`)
- Fixed TypeScript errors from attempting to use non-existent `product` relation on `DailySalesAggregate`
- Changed from `include: { product }` to product_id lookup via map
- Corrected field name from `agg.cogs` to `agg.cost`

---

## [2026-01-14]

### Wholesale Product Categories & Analytics Sync Automation

#### 1. Category Separation: Soda vs Softdrinks Case (`scripts/products.csv`, `scripts/generate_history_v3.py`)
- **Soda Category:** Individual bottles (295ml, 500ml, 1L, 1.5L) - retail customers
- **Softdrinks Case Category:** Case/bundle items only - wholesale/vendor customers
- Updated `PRODUCTS` list with proper category assignments
- Added `wholesale_only: True` flag to 8 case/bundle products

#### 2. Wholesale Products Now Generate Sales (`scripts/generate_history_v3.py`)
- Added 8 wholesale-only products to the generator:
  - Coke Swakto 195ml (1 Case) - ₱125
  - Royal Swakto 195ml (1 Case) - ₱120
  - Sprite Swakto 195ml (1 Case) - ₱120
  - Mountain Dew 290ml (1 Case) - ₱252
  - Juicy Lemon 355ml (1 Bundle) - ₱145
  - Coke 1L (1 Case) - ₱345
  - Sprite 1L (1 Case) - ₱330
  - Royal 1L (1 Case) - ₱330

#### 3. Smart Product Selection by Customer Profile (`scripts/generate_history_v3.py`)
- **SNACKER/HOUSEHOLD:** Only retail products (excludes `wholesale_only` items)
- **VENDOR:** Includes both retail bulk AND wholesale case/bundle products
- Wholesale products have 3x selection weight for VENDOR profile
- Case products use smaller qty (1-3 cases) vs retail bulk (3-12 units)

#### 4. Automatic Analytics Sync After Import (`src/components/sales/import-sales-dialog.tsx`)
- After successful CSV import, automatically calls `backfillSalesAggregates()`
- Shows progress toast: "Syncing analytics data..."
- Shows completion toast with days/records processed
- Eliminates need for manual terminal command

#### 5. Manual "Sync Analytics" Button (`src/app/admin/sales/sales-history-client.tsx`)
- Added **Sync Analytics** button to Sales History toolbar (next to Import CSV)
- Shows database icon, changes to spinner while syncing
- Tooltip explains: "Rebuild analytics aggregates from transaction data"
- Can be used anytime without running terminal commands

#### 6. New Server Action: `backfillSalesAggregates()` (`src/actions/settings.ts`)
- Processes last 90 days of completed transactions
- Populates `DailySalesAggregate` table for forecasting
- Returns: `{ success, message, daysProcessed, recordsCreated }`
- Automatically revalidates analytics pages after completion

---

## [Unreleased] - 2026-01-14

### Sales History UI Improvements

#### 1. Dynamic Date Range in Generator (`scripts/generate_history_v3.py`)
- Changed `END_DATE` from hardcoded `2026-01-03` to `datetime.now()`
- Generator now automatically simulates up to the current date when run

#### 2. Number Formatting in Sales History (`src/app/admin/sales/sales-history-client.tsx`)
- Added `toLocaleString()` formatting for transaction counts
- KPI chip now shows "108,153 Sales" instead of "108153 Sales"
- Pagination footer shows "Showing 1 to 20 of 108,153 transactions"

#### 3. Pagination Button Width Fix (`src/app/admin/sales/sales-history-client.tsx`)
- Changed from fixed `w-8` to `min-w-8 px-2` for page number buttons
- 4+ digit page numbers (e.g., "5,408") now display properly without cramping
- Added `toLocaleString()` to page numbers for comma formatting

#### 4. Restock Recommendations Fix
- **Root Cause:** `DailySalesAggregate` table was empty after CSV import
- **Solution:** Ran `npx tsx scripts/backfill-aggregates.ts` to populate 3,440 records
- Backfill covers last 90 days of transaction data for velocity calculations
- After backfill, restock recommendations should show actual daily sales velocity

---

### Realistic Sales Transaction Generator (`scripts/generate_history_v3.py`)

Complete overhaul of the sales history generator to produce realistic consumer purchase patterns.

#### Problem Statement
- Previous generator produced only ~2,000 large bulk transactions
- All transactions were ₱2,500-₱30,000 (vendor-scale), missing typical retail patterns
- Customer profile distribution was not being applied correctly

#### Solution: Transaction-Count-Driven Generation

**1. Updated Customer Profile Ranges:**
| Profile | Transactions | Items/Tx | Ticket Range | Qty/Item |
|---------|-------------|----------|--------------|----------|
| SNACKER (70%) | ~74,000 | 1-2 | ₱15-150 | 1 |
| HOUSEHOLD (20%) | ~21,000 | 3-8 | ₱300-1,500 | 1-2 |
| VENDOR (10%) | ~10,000 | 5-15 | ₱1,500-8,000 | 3-12 |

**2. New Transaction Count Logic:**
- Base: 110 transactions/day × 734 days = ~80,000+ transactions
- Added `BASE_DAILY_TRANSACTIONS` constant (110)
- `get_daily_transaction_count()` applies seasonality/holiday multipliers

**3. Improved Product Selection:**
- Snackers prefer cheap items (₱7-30 sodas, snacks)
- Separate product pools by price tier (cheap/mid/expensive)
- No duplicate products within single transaction
- Proper quantity caps per profile

**4. Results (106,583 transactions generated):**
- SNACKER: 74,451 tx (69.9%), Avg ₱37.84/tx
- HOUSEHOLD: 21,511 tx (20.2%), Avg ₱432.36/tx
- VENDOR: 10,621 tx (10.0%), Avg ₱4,559.78/tx

---

## [2026-01-13]

### Sales Simulation & Inventory Data Improvements

#### 1. Hero Product Boost Reduction (`scripts/generate_history_v3.py`)
- Reduced Lucky Me Pancit Canton hero_boost from **10.0 → 3.0**
- Previously hero product dominated ~40% of sales, now balanced at ~15%
- More realistic sales distribution across product catalog

#### 2. Product Pool Distribution Fix (`scripts/generate_history_v3.py`)
- Updated weighted_pool logic to ensure ALL products participate in sales
- Each product now appears at least once before boost duplicates are added
- Dead stock (UFC Ketchup) still correctly excluded via `never_sell: True`

#### 3. Warehouse-Level Stock Quantities (`scripts/products.csv`)
- Updated all stock levels to realistic warehouse quantities (45-800 units)
- **Sachets/high-turnover items:** 550-800 units (Milo, Downy, Joy sachets, Energen)
- **500ml softdrinks:** 250-480 units
- **1.5L softdrinks:** 130-220 units
- **Case/Bundle wholesale:** 65-120 units
- **Dairy products:** 150-320 units
- **Canned goods:** 380-480 units
- **Personal care:** 180-250 units
- **Hero product (Lucky Me):** 750 units
- **Dead stock (UFC Ketchup):** 45 units

#### 4. Realistic Expiry Dates by Category (`scripts/products.csv`)
- **Softdrinks:** 2027 (6-12 months shelf life)
- **Dairy (Evap/Condensed):** 2026-2027 (shorter shelf life)
- **Canned Goods:** 2028 (2-3 year shelf life)
- **Snacks/Instant Noodles:** 2026 (3-8 months)
- **Personal Care:** 2028-2029 (long shelf life)
- **Household chemicals:** 2028 (long shelf life)

---

## [2026-01-12]

### Reports Module: "Digital First, Paper Ready"

Implements the automated reporting objective from thesis documentation. Replaces manual logbooks with interactive, printable, and exportable reports.

#### 1. Report Server Actions (`src/actions/reports.ts`)
- **Spoilage & Wastage Report:** Queries StockMovement for DAMAGE, SUPPLIER_RETURN types with estimated loss calculations
- **Inventory Velocity Report:** Identifies Dead Stock (0 sales in 30 days) vs Fast Movers using DailySalesAggregate
- **Z-Read History:** Daily closure summaries with gross sales, payment breakdown, void tracking
- **Profit Margin Analysis:** Cost vs retail price comparison with margin status classification
- All reports include typed interfaces and summary aggregations

#### 2. Reports Gallery Page (`src/app/admin/reports/page.tsx`)
- Grid layout with grouped report cards
- **Categories:** Sales & Financial, Inventory Health, Audit & Security
- Card components with icons, descriptions, and badges
- Links to 9 report types (Spoilage, Velocity, Z-Read, Profit Margin, etc.)
- "Digital First, Paper Ready" banner explaining the approach

#### 3. Report Shell Component (`src/components/reports/report-shell.tsx`)
- Reusable wrapper for all printable reports
- **Print Mode:** CSS @media print rules hide sidebar/nav, optimize for A4
- **Excel Export:** Built-in ExcelJS integration with formatted headers
- **Metadata Header:** Title, date range, generated by, store name
- **Helper Components:** `ReportSummaryCard`, `ReportSection`

#### 4. Spoilage Report (`src/app/admin/reports/spoilage/`)
- Server component page with client interactivity
- Date range picker for filtering
- Summary cards: Total Incidents, Units Lost, Estimated Loss
- Breakdown by movement type (Damage, Supplier Return)
- Detailed table with product info, reason, and logged by

#### 5. Velocity Report (`src/app/admin/reports/velocity/`)
- Dead Stock vs Fast Movers analysis
- Status filters: Dead Stock, Slow Mover, Moderate, Fast Mover
- Capital efficiency analysis with at-risk percentage
- Days of supply calculations
- Recommendations panel for dead stock action items

---

## [2026-01-11]

### Return to Supplier Feature for Batch Management

#### 1. Added SUPPLIER_RETURN Stock Movement Type
- **File:** `prisma/schema.prisma`
- Added `SUPPLIER_RETURN` to `StockMovementType` enum
- Tracks when batches are returned to suppliers (expired, damaged, wrong item)

#### 2. Return to Supplier Server Action
- **File:** `src/actions/inventory.ts`
- Added `returnBatchToSupplier(batchId, reason, supplierName?)` function
- Removes batch from inventory
- Creates SUPPLIER_RETURN stock movement with audit trail
- Syncs product stock via `syncProductFromBatches`
- Logs detailed audit entry with metadata

#### 3. Return to Supplier UI in Batch Management
- **File:** `src/app/admin/inventory/[id]/batches/batch-audit-client.tsx`
- Added "Return to Supplier" button (Undo2 icon) in batch table actions
- Button highlighted orange for expired batches
- AlertDialog with supplier name and reason fields
- Shows expiry warning for expired batches
- Proper validation and toast notifications

---

### UI/UX Improvements: Batch Restock Dialog & Products Table

#### 1. Removed Action Column from Products Table
- **File:** `src/app/admin/inventory/products-table.tsx`
- Removed the dropdown menu "Actions" column entirely
- Cleaner table layout with focus on data

#### 2. Redesigned Batch Restock Dialog (Fullscreen)
- **File:** `src/app/admin/inventory/batch-restock-dialog.tsx`
- **Fullscreen Layout:** Uses 95vw × 90vh for maximum screen utilization
- **Two-Column Design:**
  - **Left Panel (380px):** Product search with scrollable list
    - Search by name or barcode
    - Stock status badges (Out/Critical/Low)
    - **Product images** in search results
    - Click to add product instantly
  - **Right Panel:** Delivery info + cart
    - **Collapsible Delivery Information** section with toggle
    - Full-height scrollable items list
    - **Collapsible Notes** section with toggle
    - Each item card with **product image**
- **Collapsible Sections:**
  - Delivery Information: Shows "Filled" badge when data entered
  - Notes: Shows "Added" badge when notes exist
  - Both can be collapsed to maximize products area
- **Product Images:**
  - Left panel: 40x40px thumbnails
  - Cart items: 56x56px images with fallback Package icon
- **Confirmation Modal:**
  - Shows before batch processing
  - Displays summary: products count, total units, estimated cost
  - Shows supplier and reference if provided
  - Warning about inventory level changes
  - Prevents accidental submissions
- **Fixed Scrolling Issues:** 
  - Left panel: `overflow-y-auto` on product list
  - Right panel: `overflow-y-auto` on items list
  - No more needing to drag scrollbar
- **Fixed Input Issues:**
  - Quantity: Larger buttons (h-10) with proper input field
  - Expiry Date: Calendar popover works correctly
  - Cost Price: Full-width input field
- **Better UX:**
  - Items show line totals
  - Header shows running totals (units, cost)

---

### NEW FEATURE: Batch Restock Dialog for Supplier Deliveries

**Purpose:** Handle supplier deliveries where multiple different products arrive at once with a single receipt.

#### New Files Created:
- `src/app/admin/inventory/batch-restock-dialog.tsx` - Complete batch restock dialog component

#### Components Added:
1. **BatchRestockDialog** (`batch-restock-dialog.tsx`)
   - Search and add multiple products to a single delivery
   - Shared delivery info (supplier name, reference/invoice #, receipt image)
   - Per-product fields: quantity, cost price, expiry date
   - Totals summary (products, units, estimated cost)
   - Product search with stock status badges

2. **Server Action** (`src/actions/inventory.ts`)
   - `batchRestockProducts()` function for atomic batch operations
   - Single transaction for all products (all or nothing)
   - Creates `InventoryBatch` records per product (FEFO tracking)
   - Creates `StockMovement` records for each item
   - Updates product expiry dates
   - Comprehensive audit logging

3. **UI Integration**
   - Added "Batch Restock" button to inventory toolbar (Truck icon)
   - Button triggers BatchRestockDialog
   - Success toast with count of products and total units restocked

#### Files Modified:
- `src/app/admin/inventory/products-table.tsx` - Added Truck icon import, Batch Restock button, `onBatchRestockClick` prop
- `src/app/admin/inventory/inventory-client.tsx` - Added batch restock state and dialog integration
- `src/actions/inventory.ts` - Added `batchRestockProducts` function with `BatchRestockInput` interface

---

## [Previous] - 2026-01-11

### CRITICAL FIX: Complete Data Sync Across All Stock Displays

**Problem:** Different parts of the app showed conflicting stock status:
- Inventory page: "Low Stock" for 555 Sardine
- Analytics page: "Critical (2d left)" for same product
- Dashboard Inventory Health Card: Different calculation
- Top Nav badges: Different calculation

**Root Cause:** Each component used different data sources:
- Inventory: `TransactionItem` (7-day)
- Analytics: `DailySalesAggregate` (30-day)
- Dashboard: `TransactionItem` (7-day)
- Nav: `TransactionItem` (7-day)

**Solution:** Unified ALL stock calculations to use `DailySalesAggregate` (30-day lookback).

#### 1. Product Actions (`src/actions/product.ts`)
- Uses `DailySalesAggregate` with 30-day lookback
- Added `Math.floor()` to match Analytics rounding (2.88 days → 2 days → CRITICAL)

#### 2. Dashboard Inventory Health (`src/actions/dashboard.ts`)
- Changed from `TransactionItem` to `DailySalesAggregate`
- Now shows same critical/low counts as Analytics

#### 3. Top Nav Badges (`src/actions/inventory.ts` + `src/components/kokonutui/top-nav.tsx`)
- Changed from `TransactionItem` to `DailySalesAggregate`
- **New:** Separate "critical" badge (out of stock + ≤2 days) with pulse animation
- Shows breakdown: "X critical" (red) + "Y low stock" (orange)
- Clicking navigates to filtered inventory view

#### 4. Inventory Page Filter (`src/app/admin/inventory/products-table.tsx`)
- Added "Critical (≤2d)" filter option
- Supports URL params: `?status=critical`, `?status=low`, `?status=out`
- Top nav badges deep-link to filtered view

#### 5. Restock Table Alignment (`src/app/admin/analytics/analytics-dashboard.tsx`)
- Split "Restock" column into separate "Rec" and "Add" columns
- "Rec" column: Right-aligned quantity (fixed width)
- "Add" column: Center-aligned button (fixed width)
- Buttons now aligned in a clean column regardless of quantity length

---

### Previous: Inventory Status Sync

**Earlier Fix (superseded by above):** Changed `getProducts()` to use `DailySalesAggregate` - the **exact same data source** as Analytics forecasting.

#### Cleaner Stock Column
- **Simplified layout:** Stock number + days of coverage below
- **Removed clutter:** No more ROP/Auto badges inline
- **Color-coded text:** Red for critical, orange for low, default for healthy
- **Tooltip:** Shows velocity and coverage details on hover

#### Cleaner Action Column
- **Renamed from "Smart Tip" to "Action"** (clearer purpose)
- **Badge style matches Analytics:** Same colors and format

---

### Inventory Health & Analytics Improvements (Part 2)

#### 1. Increased Low Stock Items Limit (`src/actions/dashboard.ts`)
- **Before:** Limited to 10 items in Inventory Health card
- **After:** Shows up to 50 items (matches analytics "Restock Immediately" count of 43)
- **Rationale:** Users need to see all critical items, not just top 10

#### 2. Auto-Scroll on Add to PO (`src/app/admin/analytics/analytics-dashboard.tsx`)
- **New Feature:** When clicking "Add to PO" from Inventory Health, page auto-scrolls to Restock Recommendations table
- **Implementation:** Added `tableContainerRef` and `scrollIntoView({ behavior: "smooth", block: "center" })` on `initialAddToPO` change

#### 3. Stock/ROP Column - Replaced Emoji with Icon (`src/app/admin/inventory/products-table.tsx`)
- **Before:** Used ⚡ emoji for dynamic ROP indicator
- **After:** Uses `<Zap>` Lucide React icon (consistent with design system)

#### 4. Smart Tips - Unified Logic with Analytics (`src/app/admin/inventory/products-table.tsx`)
- **Before:** Used inconsistent simulated trend data
- **After:** Uses clear stock/ROP-based logic matching analytics dashboard:
  - **Critical Restock:** Out of stock (stock === 0)
  - **Restock Now:** Stock ≤ 50% of reorder level
  - **Restock Soon:** Stock ≤ reorder level
  - **Healthy:** Stock > reorder level (shows checkmark)
- **Updated Tooltips:**
  - Clear action labels with stock status
  - Suggested quantity calculation (target: 2x reorder level)
  - Note: "View Analytics for velocity-based forecasts"

---

### Analytics & Inventory Integration

#### 1. Favicon Update
- **Replaced:** Default Next.js favicon with Christian Minimart logo
- **File:** `src/app/icon.png` (from `assets/christian_minimart_logo_collapsed.png`)

#### 2. Low Stock Labels - Actionable Text (`src/components/dashboard/inventory-health-card.tsx`)
- **Before:** "Out of Stock", "2d left", "5d left" (vague)
- **After:** "Critical Restock", "Restock Now (2d)", "Restock Soon (5d)" (actionable)
- **Rationale:** Matches analytics dashboard urgency language

#### 3. Add to PO - Analytics Integration (`src/components/dashboard/inventory-health-card.tsx`)
- **Before:** Navigated to `/admin/vendor?addProduct=X` (broken)
- **After:** Navigates to `/admin/analytics?addToPO=X` with pre-selected item
- **New:** `initialAddToPO` prop on ForecastingTable to pre-select items from URL

#### 4. PO Footer - Selection Only Mode (`src/app/admin/analytics/analytics-dashboard.tsx`)
- **Before:** Always showed "Total Recommended Order" with all items cost
- **After:** Only shows when user explicitly selects items
- **Rationale:** Don't confuse users with phantom PO they didn't create

#### 5. Avg Daily Sales Arrows - Fixed Logic + Tooltip (`src/app/admin/analytics/analytics-dashboard.tsx`)
- **Before:** Always showed arrow based on simple predicted vs velocity comparison
- **After:** 
  - Only shows trend if >10% difference (avoids noise)
  - ↑ Green = demand rising (forecast >10% above current)
  - ↓ Orange = demand falling (forecast >10% below current)
  - → Gray = stable (within ±10%)
- **Added:** Tooltip explaining: "Demand rising: Forecast X% above current"

---

### �📊 Velocity-Based Inventory Alerts

Unified low stock detection logic between Dashboard and Analytics to use sales velocity instead of static reorder levels.

#### 1. Inventory Health Card - Velocity Logic (`src/actions/dashboard.ts`)
- **Before:** Used static `current_stock <= reorder_level` comparison
- **After:** Uses sales velocity from last 7 days to calculate "days of stock"
- **Logic:**
  - **OUT_OF_STOCK:** `currentStock === 0` AND `dailyVelocity >= 0.1` (item was selling)
  - **CRITICAL:** ≤2 days of supply
  - **LOW:** 2-7 days of supply
  - **HEALTHY:** >7 days of supply (not shown in alerts)
  - **DEAD_STOCK:** `velocity < 0.1` (not selling - excluded from alerts)
- **New Fields on LowStockItem:** `daily_velocity`, `days_of_stock`, `stock_status`

#### 2. Global Stock Alerts - Velocity Logic (`src/actions/inventory.ts`)
- **Updated:** `getInventoryAlerts()` now uses same velocity-based logic
- **Impact:** Top nav badges now match analytics dashboard numbers
- **Excludes:** Dead stock items (no velocity) from counts

#### 3. Inventory Health Card UI (`src/components/dashboard/inventory-health-card.tsx`)
- **Updated LowStockRow:** Displays days of stock, daily velocity, and stock status
- **Progress Bar:** Shows days of coverage (7 days = 100%)
- **Badge Colors:** Red (CRITICAL/OUT), Orange (LOW)
- **New Display:** "X units • Y.Z/day" velocity info

---

### 🎨 UI/UX Improvements

#### 4. X-Read & Z-Read Report - Clean Monochrome Style (`src/components/dashboard/cash-register-card.tsx`)
- **Before:** Multiple colors (green for cash, blue for GCash, red for expenses)
- **After:** Clean monochrome receipt style matching thermal printer output
- **Changes:**
  - Removed colored text (emerald, blue, destructive)
  - All text now uses `text-foreground` for consistency
  - Background changed to `bg-[#F8F6F1]` (soft off-white)
  - Border changed to `border-stone-300` for subtle separation
  - Icons changed from colored to `text-muted-foreground`
  - Z-Read confirmation banner changed from amber to emerald (success state)

#### 5. Human-Readable Days Format (`src/lib/utils.ts`)
- **New Utility:** `formatDaysToHumanReadable(days: number)` function
- **Converts:** Large day counts to readable format (e.g., 9999 → "Over 27 years")
- **Examples:**
  - 450 days → "1 year 2 months"
  - 45 days → "1 month 15 days"  
  - 7 days → "7 days"
  - 1 day → "1 day"
  - 0 days → "Today"

#### 6. Dead Stock Display Fix (`src/components/sales/insight-cards.tsx`)
- **Before:** "No sales for 9999 days" (raw number)
- **After:** "No sales for Over 27 years" (human-readable)
- **Updated:** `getShortIssue()` function now uses `formatDaysToHumanReadable()`

#### 7. Animated Tab Toggle - Inventory Health Card (`src/components/dashboard/inventory-health-card.tsx`)
- **Added:** Smooth animated indicator using Framer Motion
- **Animation:** Spring-based transition (stiffness: 400, damping: 30)
- **Visual:** Orange background slides between tabs on selection
- **Badge Styling:** Active tab badges now have `bg-white/20` for better contrast
- **Removed:** Shadcn Tabs dependency in favor of custom animated toggle

#### 8. Return Window - Expiring Items Query (`src/actions/dashboard.ts`)
- **Fixed:** `getInventoryHealthData()` now queries actual expiring products
- **Logic:** Fetches products with `nearest_expiry_date` within 45 days
- **Calculation:** Days until expiry computed from today's date
- **Sorting:** Expiring items sorted by soonest expiry first
- **Limit:** Returns top 10 expiring items

---

### ⚡ Offline Performance Optimizations

Major performance improvements for offline/slow network scenarios. Addresses 45-48 second delays from external image fetching and reduces repeated API calls.

#### 1. Next.js Image Configuration (`next.config.ts`)
- **Restricted Remote Patterns:** Only allow localhost images by default
- **24-hour Cache TTL:** Increased `minimumCacheTTL` to 24 hours for cached images
- **Environment Toggle:** Added `DISABLE_IMAGE_OPTIMIZATION=true` env var option
- **Reduced Device Sizes:** Optimized `deviceSizes` and `imageSizes` arrays

#### 2. SafeImage Component (`src/components/ui/safe-image.tsx`)
- **New Component:** Wrapper around Next/Image with graceful offline handling
- **Auto-detect External URLs:** Automatically adds `unoptimized` prop for external URLs
- **Error Fallback:** Shows Package or ImageOff icon when images fail to load
- **ProductImage Helper:** Pre-configured component for product thumbnails
- **Loading Skeleton:** Optional loading state with skeleton animation

#### 3. Analytics Dashboard Batched Queries
- **Before:** 7 sequential server action calls (~500-2000ms each = 3.5-14s total)
- **After:** 1 batched call with parallel DB queries (~500-800ms total)
- **New Action:** `getBatchedAnalyticsData()` in `actions.ts`
- **Parallel Execution:** Uses `Promise.all()` to run all queries simultaneously:
  - `getDashboardChartDataByDateRange` (current & previous period)
  - `getTopMovers`
  - `getCategorySalesShare`
  - `getPeakTrafficData`
  - `getForecastData`
  - `getSmartInsights`

#### 4. Auth Session Caching
- **SessionProvider Config:** Added `refetchInterval={5 * 60}` (5 minutes)
- **Reduced API Calls:** Set `refetchOnWindowFocus={false}`
- **Affected Files:** `admin/layout-client.tsx`, `vendor/layout-client.tsx`
- **Impact:** Reduces `/api/auth/session` calls from every navigation to once per 5 minutes

#### 5. Image Error Handling in Analytics Dashboard
- **Lazy Loading:** Added `loading="lazy"` to product images
- **Error Fallback:** Added `onError` handler to show Package icon fallback
- **Prevents Timeouts:** Images that fail to load don't block the UI

#### 6. Sharp Module Graceful Fallback (`src/lib/process-image.ts`, `src/actions/upload.ts`)
- **Problem:** Sharp native bindings (libvips/GLib) broken on Windows causing GLib-GObject-CRITICAL errors
- **Solution:** Dynamic Sharp import with graceful fallback
- **Behavior When Sharp Works:** Full AI background removal + WebP conversion + trim
- **Behavior When Sharp Broken:** Save original file as-is (jpg/png/gif detected from magic bytes)
- **No Crashes:** Image upload now works even with broken Sharp installation
- **Files Modified:**
  - `process-image.ts`: Added `getSharp()` lazy loader, `detectImageType()` helper
  - `upload.ts`: `uploadImageRaw()` now falls back to saving original file

### Performance Impact Summary
| Metric | Before | After |
|--------|--------|-------|
| External image timeout | 45-48s | Instant fallback |
| Analytics page load (initial) | 11-16s | ~1-2s |
| Analytics date range change | 7 API calls | 1 batched call |
| Auth session checks | Every navigation | Every 5 min |
| Image upload with broken Sharp | Crash | Works (saves original) |

---

## [Unreleased] - 2026-01-10

### � Production-Ready Business Logic Fixes

Fourth round of improvements focusing on making the dashboard production-ready with proper business logic and actionable features.

#### 1. Days Left Display Logic Improvements
- **Edge Case Handling:** Properly handles all stock/velocity combinations
- **Out of Stock (stock=0):** Displays red "Out of Stock" badge
- **Less than 1 Day (0<days<1):** Displays urgent red "< 1 Day Left" with minimal progress bar
- **Dead Stock (velocity=0, stock>0):** Displays gray "No Movement" badge with stagnant inventory tooltip
- **Formula Fix:** Changed daily rate calculation from `/30` to `/7` (since velocity is 7-day based)
- **Enhanced Tooltip:** Added contextual advice for dead stock items

#### 2. Intelligence Feed Logic Fixes
- **Dead Stock Alert:** Changed title from "Frozen Inventory" to "Dead Stock Alert"
- **Action Button:** Changed from "Create Discount" to "Reduce Price" for dead stock items
- **Contextual Messages:** `getShortIssue()` now provides meaningful context:
  - Dead stock: "No sales for X days" or "No sales in 30+ days"
  - Frozen inventory: "Stagnant for X days"
  - Low demand: "Monitor: Low demand" (instead of generic "Monitor closely")
- **Metadata Enhancement:** Added `isDeadStock: true` flag to dead stock insight metadata

#### 3. Action Button Destinations (Deep-Linking)
- **Reduce Price Action:** Links to `/admin/inventory?editPrice={productId}` 
- **Restock Action:** Links to `/admin/inventory?restock={productId}`
- **URL Parameter Handling:** Added useSearchParams hook to InventoryClient
- **Modal Auto-Open:** Inventory page now auto-opens appropriate modal based on URL params:
  - `?restock=123` → Opens RestockDialog pre-filled with product
  - `?editPrice=123` → Opens ProductDialog (edit mode) for price adjustment
- **Clean URLs:** Parameters cleared from URL after modal opens (no page reload)

#### 4. Export Purchase Order Feature
- **Library:** Replaced vulnerable `xlsx` (SheetJS) with secure `exceljs`
  - Removed `xlsx` due to Prototype Pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9) vulnerabilities
  - `exceljs` has 0 known vulnerabilities and is actively maintained
- **Excel Format:** Generates professional `.xlsx` file with:
  - Store header with generation timestamp
  - Summary totals (Total Items, Total Order Value)
  - Detailed columns: Product Name, Category, Current Stock, Daily Sales Rate, Days Left, Forecasted Demand, Suggested Order Qty, Cost Price, Total Cost, Priority
  - Color-coded priority cells (red for CRITICAL, amber for LOW)
  - Proper column widths for readability
- **Filename:** `Purchase_Order_YYYY-MM-DD.xlsx`
- **Export Buttons:**
  - Header "Export PO" button: Exports all items needing restock
  - Table toolbar button: Exports only selected items (appears when items selected)
- **Smart Filtering:** Only includes CRITICAL and LOW urgency items (excludes healthy stock)

#### Files Modified:
- `src/app/admin/analytics/analytics-dashboard.tsx` - Days Left logic, Export PO function
- `src/components/sales/insight-cards.tsx` - getShortIssue(), getActionText() functions
- `src/lib/insights.ts` - Dead stock title and action updates
- `src/app/admin/inventory/inventory-client.tsx` - URL parameter handling for modals
- `package.json` - Added xlsx dependency

---

## [Previous] - 2026-01-10

### �🔧 Analytics Dashboard Bug Fixes & UI Polish

Second round of improvements focusing on functionality and removing remaining UX issues.

#### 1. Time Left Column Sorting Fix
- **Critical Bug Fix:** Sorting by "Time Left" column now works correctly based on actual days remaining
- **Previous Issue:** Was sorting by raw stock count instead of calculated days of supply
- **Solution:** Added `getDaysLeft()` helper function that calculates: `currentStock / (velocity7Day / 7)`
- **Special Cases:** Out of stock items sort to top (ascending), no-sales-data items sort to bottom

#### 2. Replaced All Emojis with Lucide Icons
- **Narrative Header Icons:** AlertCircle (critical), Zap (warning), TrendingUp (forecast), CheckCircle (healthy), Lightbulb (info)
- **Tooltip Icons:** AlertTriangle, BarChart3, Flame, Zap, CheckCircle for different stock states
- **Chart Markers:** Event reference lines now use "★" symbol instead of 📅 emoji

#### 3. Intelligence Feed Product Images
- **InsightCard Enhancement:** Now displays product image (Avatar) when available
- **Fallback:** Shows icon-based fallback if no image
- **Data Pipeline:** Added `productImage` field to Insight interface and VelocityData
- **Backend Update:** getSmartInsights() now fetches `image_url` from Product table

#### 4. Forecast Card Image Fix
- **Problem:** Product image in forecast side panel appeared stretched/thin
- **Solution:** Added `className="object-cover"` to AvatarImage component
- **Result:** Images maintain aspect ratio and fill container properly

#### 5. Restock Table Scrollability
- **Mobile Support:** Added `overflow-x-auto` wrapper around ScrollArea
- **Min Width:** Increased table min-width from 750px to 850px
- **Horizontal Scroll:** Table now scrolls horizontally on smaller screens

#### 6. Forecasted Need Column Alignment
- **Column Header:** Renamed from "Forecasted Need" to just "Forecasted"
- **Alignment:** Changed from right-align to center-align for better readability
- **Width:** Increased column widths for better spacing (Product: 180px, Time Left: 120px, etc.)

---

### 🎨 Analytics Dashboard UX Overhaul - "Store Assistant" Style

Comprehensive refactoring of the Analytics Dashboard to prioritize **Clarity** and **Actionability** over raw data density. Shifted design from "Financial Spreadsheet" to "Store Assistant" with plain English and visual indicators.

#### 1. Restock Recommendations Table Improvements

**Column Renaming for Clarity:**
- `Velocity (30d)` → **"Avg. Daily Sales"** (now shows X.X/day format)
- `Demand` → **"Forecasted Need"**
- `Stock` → **"Time Left"**
- `Order` → **"Restock"**

**New "Days Remaining" Visualization:**
- Replaced raw stock numbers with human-readable labels: "2 Days Left", "Out of Stock", "30+ Days"
- Color-coded urgency: Red (< 3 days), Yellow/Orange (< 7 days), Green (≥ 7 days)
- Visual progress bar showing supply level
- Hover tooltip shows: current stock, avg daily sales rate

**Clearer Action Buttons:**
- Changed confusing `+564` badge to clear text: "Rec: 564"
- Added "Add" button with ShoppingCart icon for adding to PO
- Button turns items on for PO selection workflow

#### 2. Forecasting Side Panel Enhancements

**Narrative Header (Dynamic Smart Summary):**
- Added context-aware text at top of forecast card
- Examples:
  - 🚨 "Out of stock! Immediate restock needed to avoid lost sales."
  - ⚠️ "Stock will run out by Friday if not replenished."
  - ⚡ "Running low — about 5 days of stock remaining."
  - 📈 "Forecasted demand (150 units) exceeds current stock. Consider restocking."
  - ✅ "Stock levels healthy — 15 days of supply on hand."
- Default prompt when no product selected: "Select a product from the table to see detailed demand insights."

**Chart Styling Improvements:**
- Added visual legend: Purple bars = "History (Actual)", Orange line = "Forecast (Predicted)"
- Summary stats now color-coded: Purple background for history, Orange for forecast
- Changed labels from "units" to "sold" (history) and "expected" (forecast)

#### 3. Intelligence Feed Simplification

**Card Redesign - Reduced Text Density:**
- Bold product name as primary element (truncated with title tooltip)
- Short, plain English issue text: "Empty in 1 day", "Low stock (5d left)", "Top seller!"
- Color-coded issue text matches severity (Red/Amber/Green/Blue)
- Inline action button instead of full-width footer button
- Critical alerts use destructive button variant for urgency

**Smarter Issue Detection:**
- Parses insight messages to extract days remaining
- Converts verbose messages to scannable phrases
- Action buttons simplified: "Restock", "View" instead of full sentences

---

### 📋 Audit Log Table & Modal Improvements

Comprehensive fixes for audit log display, column ordering, and modal data completeness.

#### Table Column Reordering
- **New Column Order:** When → Who → Action → Target → Change → Reference
- **Change Column Moved:** Now directly after Target for easy visual scanning of what changed
- **Reference Column:** Moved to end as it's supplementary information

#### Module Filter Fix
- **Hardcoded Module Options:** Module filter now shows all 5 modules (INVENTORY, CATALOG, POS, ORDERS, AUTH) even if no data exists yet
- **Ensures Usability:** Filter works immediately without waiting for data to populate

#### Expiry Badge Enhancement
- **Added Context:** Expiry date badges in the Change column now show "Exp" prefix (e.g., "Exp Jan 15") for clarity

#### Restock Modal - Full Stock History Parity
Modal now shows all fields available in Stock History view:
- **Date & Time:** Full timestamp of when restock occurred
- **Performed By:** Username who performed the action
- **Supplier:** Supplier name
- **Reference #:** Reference number from restock form
- **Cost Price:** Per-unit cost (e.g., "₱11.00 per unit")
- **Batch ID:** If applicable
- **Movement ID:** Entity ID for traceability
- **Expiry Date:** With days remaining indicator
- **Receipt Image:** With zoom functionality (if uploaded)
- **Reason/Notes:** Dedicated section at bottom

#### Archive/Restore Snapshot Fixes
- **Barcode Priority:** Now shows `barcode` field first, falls back to `sku`, then entity ID
- **Null-Safe Checks:** Using `!= null` instead of `!== undefined` to catch both null and undefined
- **Number Formatting:** Stock now shows with locale formatting (e.g., "1,000 units")

---

### 📋 Audit Log Final Fixes (Earlier Today)

Additional fixes to complete the audit log system improvements.

#### Modal Header Layout
- **Module Badge Repositioned:** Moved module badge from header (where it overlapped X button) to the meta bar below
- **Cleaner Header:** Header now only shows action icon, label, and entity name for a cleaner look

#### Restock Data Completeness
- **Previous Stock Added:** `logRestock()` now captures `previous_stock` from the actual transaction, not just calculated
- **Cost Price Tracking:** `logRestock()` now logs `cost_price` in metadata for full traceability
- **Modal Reads Actual Data:** RESTOCK modal now uses actual `previous_stock` from metadata (if available) instead of calculating it

#### Archive/Restore Snapshots
- **Full Product Snapshot:** Both `archiveProduct` and `restoreProduct` now capture complete product state:
  - SKU / Barcode
  - Retail Price, Wholesale Price, Cost Price
  - Category
  - Current Stock (queried from inventory relation)
  - Timestamp of archive/restore
- **Category Display Fixed:** Snapshot section now reads `metadata.category` first, falls back to `log.product_category`

#### Metadata Grid Enhancements
- **Cost Price Display:** Added Cost Price to metadata grid for RESTOCK actions (shows as "₱XX.XX")

---

### 📋 Audit Log UI Final Polish

Comprehensive improvements to the Audit Log interface including new columns, data formatting, and enhanced modals.

#### Table Columns
- **"Who" Column Added:** New column between "When" and "Action" showing Avatar (user initials) + username for quick scanning
- **Reference Column Fixed:** Now shows Batch ID for inventory actions, SKU for product actions, or reference field
- **Target Column Flexible:** Target column now takes remaining space for balanced table layout
- **Compact Badges:** Action badges are now smaller (`text-[10px]`) for better density

#### Data Formatting
- **Category Badge Formatting:** Added `formatCategory()` helper to convert enum keys (e.g., `CANNED_GOODS`) to Title Case ("Canned Goods")
- **Module Categorization:** Updated logger functions to set correct modules:
  - `logRestock`, `logStockAdjust`, `logExpiryEdit`, `logBatchEdit` → "INVENTORY"
  - `logProductCreate`, `logProductUpdate`, `logProductDelete` → "CATALOG"
- **Reference Helper:** New `getReference()` function that intelligently extracts batch_id, sku, or reference from metadata

#### Restock Modal Improvements
- **Receipt Image Section:** Added "Receipt Proof" section with image preview and zoom functionality (from Stock History)
- **Reason/Notes Section:** Added dedicated "Reason / Notes" section with proper formatting
- **Stock Math Hero:** Shows previous → change → new stock with visual indicators

#### Archive/Restore Modal Enhancement
- **Snapshot Summary:** Instead of "No additional details", now shows a comprehensive product snapshot:
  - Product image and name
  - SKU/Barcode
  - Retail price at time of action
  - Final stock level
  - Entity ID
- **Context Message:** Footer explains this is a record of product state at time of archive/restore

#### Helper Components Added
- `formatCategory()` - Enum to Title Case converter
- `getUserInitials()` - Extract initials for Avatar
- `getReference()` - Smart reference extraction from metadata
- `SnapshotItem` - Compact detail row for Archive/Restore modals

---

### 🎨 Inventory Toolbar UI Improvements (v2)

Enhanced the inventory page toolbar for single-row layout on all screen sizes with proper framer-motion animations.

#### Single-Row Toolbar (No Wrapping)
- **No-Wrap Layout:** Changed from `flex-wrap` to `flex` with `overflow-x-auto` to ensure toolbar stays on one row
- **Shrinkable Elements:** All KPI cards and buttons have `shrink-0` to maintain minimum size
- **Auto-Adjusting Widths:** Filters shrink from `w-[140px]` to `w-[120px]/w-[110px]` on smaller screens

#### Toggle Component Animation Fix
- **Proper Sliding Background:** Moved animated div outside conditional rendering - now uses `animate={{ left, right }}` props
- **Always-Rendered Motion Div:** The background pill is always present, just animates position
- **Spring Physics:** Smooth `bounce: 0.2, duration: 0.4` transition when switching tabs

#### Responsive Text with Tooltips
- **KPI Labels:** "Products", "Out", "Low" hidden below `lg` breakpoint with tooltips shown on hover
- **Action Buttons:** "Import CSV" and "Add Product" text hidden below `lg` with tooltips
- **Preserved Functionality:** All buttons/cards remain functional with just icons on smaller screens

#### Removed Scale Animations from KPI Cards
- **No Hover/Tap Scale:** Removed `whileHover` and `whileTap` scale effects from KPI cards
- **Cleaner Interactions:** Cards now use standard hover states without jarring scale animations
- **Consistent Feel:** All toolbar elements behave predictably

---

### 🗄️ Soft Delete (Archiving) System Implementation

A comprehensive refactor replacing "Hard Deletes" with "Soft Deletes" to preserve data integrity and allow for restoration.

#### Database Schema Changes
- **User Model:** Added `status` (default: "ACTIVE"), `deletedAt` (nullable DateTime), and index on `deletedAt`
- **Customer Model:** Added `status` (default: "ACTIVE"), `deletedAt` (nullable DateTime), and index on `deletedAt`
- **Product Model:** Added `status` (default: "ACTIVE"), `deletedAt` (nullable DateTime), and index on `deletedAt`. Kept `is_archived` for backward compatibility.
- **InventoryBatch Model:** Added `status` (default: "ACTIVE"), `deletedAt` (nullable DateTime), and index on `deletedAt`

#### New Server Actions (`src/actions/archive.ts`)
- **archiveProduct / restoreProduct:** Archive/restore products with Ghost SKU fix
- **archiveUser / restoreUser:** Archive/restore users with username suffix
- **archiveCustomer / restoreCustomer:** Archive/restore customers/vendors with email suffix
- **archiveInventoryBatch / restoreInventoryBatch:** Archive/restore batches (blocks archiving batches with stock > 0)
- **bulkArchiveProducts:** Bulk archive multiple products
- **bulkArchiveEmptyBatches:** Bulk archive empty batches for a product
- **Query Helpers:** `getArchivedProducts`, `getArchivedUsers`, `getArchivedCustomers`, `getArchivedBatches`

#### Ghost SKU Fix (Critical)
When archiving, unique fields are renamed with a timestamp suffix:
- Example: `"COKE-ZERO"` → `"COKE-ZERO__ARCHIVED_1736521200000"`
- This frees up the original SKU/barcode/email for immediate reuse
- On restore, the suffix is stripped and conflicts are checked

#### Inventory Batch Special Rules
- **Empty Batches (qty=0):** Can be archived immediately
- **Active Batches (qty>0):** BLOCKED from archiving - must dispose/adjust to 0 first

#### Updated Queries (Soft Delete Filter)
- `getProducts()`: Now filters by `deletedAt: null` instead of `is_archived: false`
- `getVendorProducts()`: Now filters by `deletedAt: null`
- `getProductBatches()`: Now filters by `deletedAt: null` (optional `includeArchived` param)
- `deductStockFEFO()`: Now only considers active batches

#### UI Changes (Inventory Page)
- **Tabbed Interface:** Added `[Active] | [Archived]` tabs to the inventory page using Shadcn Tabs
- **Archive Product Dialog:** Renamed `DeleteProductDialog` to `ArchiveProductDialog` with updated messaging
- **Restore Product Dialog:** New dialog for restoring archived products with conflict detection
- **Archived Products Table:** New table component showing archived products with "Restore" action
- **Bulk Archive:** Updated bulk delete to bulk archive with new messaging
- **Icon Changes:** Replaced `Trash2` icon with `Archive` icon throughout

#### Files Changed

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `status`, `deletedAt` fields and indexes to User, Customer, Product, InventoryBatch |
| `src/actions/archive.ts` | **NEW** - All archive/restore actions with Ghost SKU logic |
| `src/actions/product.ts` | Updated `getProducts`, `deleteProduct`, `restoreProduct` with new soft delete logic |
| `src/actions/inventory.ts` | Updated `deductStockFEFO`, `getProductBatches` to filter archived batches |
| `src/actions/vendor.ts` | Updated `getVendorProducts` to filter archived products |
| `src/app/admin/inventory/page.tsx` | Fetch both active and archived products |
| `src/app/admin/inventory/inventory-client.tsx` | Added tabs, archived state, restore handlers |
| `src/app/admin/inventory/delete-product-dialog.tsx` | Renamed to `ArchiveProductDialog`, added `RestoreProductDialog` |
| `src/app/admin/inventory/archived-products-table.tsx` | **NEW** - Table for archived products with restore action |
| `src/app/admin/inventory/products-table.tsx` | Changed "Delete" to "Archive", updated bulk actions |

---

## [Unreleased] - 2025-01-XX

### Audit Logs UI Overhaul
- **Enhanced Table Layout:** Increased font sizing for better readability.
- **Rich Target Details:** Added product thumbnails (40x40px) and category badges to the audit log table.
- **Reference Column:** Added a dedicated column for Batch IDs and References.
- **Detailed Modal:**
  - Added **Receipt Image** proof display for Restock events (matches Stock History view).
  - Added **Reason/Notes** display.
  - Improved **Before vs After** visualization for field updates with clear diff highlights.
- **Backend Improvements:** 
  - Updated `logRestock` to capture receipt images and reasons.
  - Optimized `getAuditLogs` to efficiently join product details.

### Audit Logs Page Enhancements

#### Bug Fixes
- **Fixed +0 Display Bug**: The DiffSummary component was looking for `metadata?.quantity` but the logger stores different field names:
  - `RESTOCK` actions: Now correctly reads `quantity_added` and `new_stock_level`
  - `ADJUST_STOCK` actions: Now correctly reads `previous_stock`, `new_stock`, and `quantity_change`
  - `EDIT_BATCH` actions: Now correctly reads `old_quantity`, `new_quantity`, and `quantity_change`

- **Fixed Table Layout**: Changed table to use `table-fixed` layout for proper column distribution. Target column no longer truncates prematurely.

#### New Features
- **Date Range Filter**: Added DateRangePicker to the toolbar for filtering audit logs by date range.
  - Filters are passed to all query handlers (Module, Action, Entity Type, Search, Pagination)
  - Clear date range with the Reset Filters button

#### Modal Improvements
- **Fixed Stock Math Hero Section**: Updated `LogDetailsModal` to use correct metadata field names for stock calculations:
  - RESTOCK: Calculates `oldStock = newStockLevel - quantityAdded`
  - ADJUST_STOCK: Uses `previous_stock` and `quantity_change`
  - EDIT_BATCH: Uses `old_quantity` and `quantity_change`

---

### Files Changed

| File | Changes |
|------|---------|
| `src/app/admin/audit-logs/audit-logs-client.tsx` | Fixed DiffSummary data binding, added DateRangePicker, updated table layout |
| `src/components/audit/log-details-modal.tsx` | Fixed stock math calculations to use correct metadata field names |

---

### Metadata Field Reference

For future reference, here are the metadata fields stored by the logger (`src/lib/logger.ts`):

| Action | Fields |
|--------|--------|
| **RESTOCK** | `quantity_added`, `new_stock_level`, `supplier_name`, `expiry_date`, `batch_id` |
| **ADJUST_STOCK** | `previous_stock`, `new_stock`, `quantity_change`, `movement_type`, `reason` |
| **EDIT_BATCH** | `old_quantity`, `new_quantity`, `quantity_change`, `batch_id`, `reason` |
| **EDIT_EXPIRY** | `old_expiry`, `new_expiry`, `batch_id` |

---

## Previous Optimizations

### Performance Improvements
- Added loading skeletons for better perceived performance
- Implemented navigation progress bar
- Fixed N+1 queries in admin pages
- Added database indexes for frequently queried columns

### UI Refactoring
- Changed Audit Logs from "reading" style to "scanning" style
- Compact DiffSummary with +/- visualizations
- Removed MODULE column (moved to inline display)
- Sentence-form summaries for better scannability
