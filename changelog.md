# Changelog

All notable changes to Christian Minimart POS System will be documented in this file.

---

## [Unreleased] - 2026-01-10

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
