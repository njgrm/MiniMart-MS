# Changelog

All notable changes to Christian Minimart POS System will be documented in this file.

---

## [Unreleased] - 2026-01-15

### Suppliers Module & Audit Config Fixes

**Verdict:** Added comprehensive Suppliers module with entity management, ledger tracking, and sidebar navigation. Fixed critical audit log configuration issues.

#### 1. New Suppliers Module

**User Request:** "You absolutely need a Suppliers Page... In a professional ERP/POS system, Audit Logs are for security, while Supplier Ledgers are for business"

**Files Created:**
- `prisma/schema.prisma` - Added `Supplier` model with relations to `InventoryBatch` and `StockMovement`
- `src/actions/supplier.ts` - Full CRUD: `getSuppliers`, `getSupplierDetails`, `createSupplier`, `updateSupplier`, `toggleSupplierStatus`, `getSuppliersForSelect`, `backfillSuppliersFromBatches`
- `src/app/admin/suppliers/page.tsx` - Suppliers list page (server component)
- `src/app/admin/suppliers/suppliers-client.tsx` - Suppliers table with search, status filter, summary cards
- `src/app/admin/suppliers/add-supplier-dialog.tsx` - Create new supplier dialog
- `src/app/admin/suppliers/[id]/page.tsx` - Supplier details page (server component)
- `src/app/admin/suppliers/[id]/supplier-details-client.tsx` - Details with Deliveries & Returns tabs
- `src/app/admin/suppliers/[id]/edit-supplier-dialog.tsx` - Edit supplier dialog

**Schema Changes:**
- Added `Supplier` model: `id`, `name` (unique), `contact_person`, `contact_number`, `email`, `address`, `notes`, `status`, relations
- Added `supplier_id` FK to `InventoryBatch` (links deliveries to supplier)
- Added `supplier_id` FK to `StockMovement` (links returns to supplier)
- Added indexes on `supplier_id` for both tables

**UI Features:**
- Summary cards: Active suppliers, Archived, Total deliveries, Total returns
- Search by name/contact/email
- Status filter (All/Active/Archived)
- "Sync from Batches" button to backfill suppliers from existing `supplier_name` fields
- Supplier details with tabbed view: Deliveries | Returns
- Edit/Archive/Reactivate actions

**Files Modified:**
- `src/components/app-sidebar.tsx` - Added "Suppliers" nav item with `Building2` icon

#### 2. Audit Log Configuration Fixes

**Problem:** Missing `BATCH_RESTOCK` and `BATCH_RETURN` audit actions in config maps causing TypeScript errors

**Files Modified:**
- `src/app/admin/audit-logs/audit-logs-client.tsx` - Added `BATCH_RESTOCK` and `BATCH_RETURN` to `ACTION_CONFIG`
- `src/components/audit/log-details-modal.tsx` - Added `BATCH_RESTOCK` and `BATCH_RETURN` to `ACTION_CONFIG`

#### 3. Batch Return Dialog Fix

**Problem:** Missing `advise_return` in `urgencyOrder` causing TypeScript error

**Files Modified:**
- `src/app/admin/reports/expiring/batch-return-dialog.tsx` - Added `advise_return: 4` to urgencyOrder map, added fallback for unknown urgency types

---

## [Previous] - 2026-01-15

### UX Improvements, 45-Day Expiry Workflow & Batch Return Enhancements

**Verdict:** Comprehensive UX improvements including Touch POS quantity controls, payment modal cleanup, auto-cancel stale orders, and a professional ERP-style "Marked for Return" workflow with 45-day advance notice.

#### 1. Payment Modal: Removed Preset Buttons

**User Request:** "Remove preset numbers for payment confirm modal... make input instantly active so admin can instantly type"

**Files Modified:**
- `src/components/pos/payment-dialog.tsx`

**Changes:**
- Removed `quickAmounts` array and all preset amount buttons (₱20, ₱50, ₱100, etc.)
- Removed "Exact Amount" button
- Input field remains auto-focused with keyboard hint "Type amount or press Enter for exact"
- Cleaner, faster checkout experience

#### 2. Touch POS: Added Quantity Input Fields

**User Request:** "Add text input fields for quantity in touch POS, both in product card and cart"

**Files Modified:**
- `src/components/pos/cart-panel.tsx`
- `src/components/pos/product-card.tsx`

**Changes:**
- Cart: Replaced span with `<Input type="number">` for direct quantity editing
- Product Card: Added full quantity control (minus/input/plus) replacing simple +1 counter
- Added `stopPropagation` to prevent card click when editing quantity
- Now matches Legacy POS and Vendor ordering experience

#### 3. Active Orders Card: Truncation & Auto-Cancel

**User Request:** "Truncate the active orders card... orders not processed after 48 hours get automatically cancelled"

**Files Modified:**
- `src/components/dashboard/active-orders-card.tsx`
- `src/actions/orders.ts`

**Changes:**
- Added `max-h-[400px]` constraint to prevent card overflow
- Added `autoCancelExpiredOrders(hoursThreshold: number = 48)` function
- Integrated auto-cancel into `getIncomingOrders()` (fire-and-forget on each fetch)
- Cancelled orders release allocated stock and log via `logOrderCancel` with "System" actor

#### 4. 45-Day Expiry Workflow: "Advise Return" Status

**User Request:** "Expiry reports logic should adjust to advise admin to return items 45 days before... adding the marked for return status"

**Files Modified:**
- `src/actions/reports.ts` - Extended ExpiringItem type and getExpiringReport
- `src/actions/inventory.ts` - Added batch status management functions
- `src/app/admin/reports/expiring/expiring-client.tsx` - Added new UI elements
- `src/app/admin/reports/expiring/batch-return-dialog.tsx` - Added advise_return config

**New Urgency Level:**
- `advise_return` (31-45 days): Stone-colored badge for early warning
- Allows admin time to consider returns before items become critical

**New Batch Status Workflow (ERP Best Practice):**
1. **ACTIVE** → Normal inventory
2. **MARKED_FOR_RETURN** → Excluded from FEFO, visible in "Marked for Return" filter
3. **RETURNED** → Soft-deleted with `deletedAt`, stock removed

**New Server Actions:**
- `markBatchForReturn(batchId, reason)` - Stage 1: Mark for supplier pickup
- `confirmBatchesReturned(batchIds, supplierName?, reference?)` - Stage 2: Confirm pickup, remove stock
- `getBatchesMarkedForReturn()` - Get all marked batches for pickup list

**New UI Elements:**
- Purple "Marked for Return" badge in Status column
- "Mark for Return" action in dropdown menu
- "Confirm Pickup" toolbar button (appears when batches are marked)
- "Marked for Return" filter option
- Urgency breakdown shows marked batch count

#### 5. Inventory Page: Enhanced Batch Return Dialog

**User Request:** "Add batch return for non-expiry reasons (damaged, recalled)"

**Files Modified:**
- `src/app/admin/inventory/[id]/batches/batch-audit-client.tsx`

**Changes:**
- Added quick reason buttons: Expired, Damaged, Recalled, Wrong Item
- Each button pre-fills the reason textarea with appropriate text
- Detailed toast on success: "Returned Batch #X to supplier - Y units of 'Product' to Supplier Z"
- Imported `markBatchForReturn` and `BATCH_STATUS` for future workflow integration

---

## [Previous] - 2026-01-15

### Critical Bug Fixes & Batch Return Feature Improvements

**Verdict:** Fixed critical stock calculation bug, Decimal serialization errors, infinite loop in checkbox, scroll issues, and added single-batch return from expiry table.

#### 1. CRITICAL: Fixed Stock Disappearing on Batch Operations

**Root Cause:** Products created with initial stock did NOT create an `InventoryBatch` record. When any batch operation (restock, return) called `syncProductFromBatches()`, it would sum batches (0 units) and overwrite `current_stock`, erasing the initial stock.

**Files Modified:**
- `src/actions/product.ts` - Added initial batch creation

**Changes:**
- Now creates `InventoryBatch` record alongside `Inventory` when product has initial stock
- This ensures `syncProductFromBatches()` includes the initial stock in its calculation
- Without this fix, restocking 1 unit would show stock = 1 instead of initial + 1

**Backfill Script Created:**
- `scripts/backfill-inventory-batches.ts` - Run `npx tsx scripts/backfill-inventory-batches.ts`
- Creates "Legacy Stock" batches for existing products with stock but no batches
- MUST run this script to fix existing data

#### 2. Fixed Decimal Serialization Error

**Error:** "Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported."

**Files Modified:**
- `src/actions/inventory.ts` - Convert Decimal to Number in returnBatchToSupplier

**Changes:**
- Changed `costPrice: batch.cost_price` to `costPrice: batch.cost_price ? Number(batch.cost_price) : null`
- Prisma Decimal objects cannot be serialized to client components

#### 3. Fixed Infinite Loop in Batch Return Dialog

**Error:** "Maximum update depth exceeded" when clicking checkbox or scrolling

**Files Modified:**
- `src/app/admin/reports/expiring/batch-return-dialog.tsx`

**Changes:**
- Fixed checkbox double-toggle: parent div onClick + checkbox onCheckedChange both fired
- Checkbox now only prevents propagation, toggle handled by parent div
- Added `min-h-0` and `overflow-auto` to flex containers for proper scroll behavior

#### 4. Added Single-Batch Return from Expiry Table

**Files Modified:**
- `src/app/admin/reports/expiring/expiring-client.tsx` - Added actions column
- `src/app/admin/reports/expiring/batch-return-dialog.tsx` - Added preSelectedBatchId prop

**Changes:**
- New "Actions" column in expiry table with dropdown menu
- "Return Batch" action opens dialog with batch pre-selected
- "View Batches" links to batch audit page
- Dialog auto-fills reason and supplier based on selected batch
- Implements ERP best practice: actionable reports, not just read-only

---

## [Previous] - 2026-01-15

### Bug Fixes & Batch Return Feature

**Verdict:** Fixed multiple TypeScript errors, added batch return functionality for expired products, and improved reports UI with filters in toolbar.

#### 1. Fixed Authentication Error (prisma.staff undefined)

**Files Modified:**
- `src/actions/auth.ts` - Changed prisma.staff to prisma.user

**Changes:**
- Fixed runtime error when logging in as admin via port forwarding
- Changed `prisma.staff.findUnique` to `prisma.user.findUnique`
- Updated field references from `staff_id` to `user_id`

#### 2. Fixed ExpiringItem.quantity Error

**Files Modified:**
- `src/app/admin/reports/expiring/expiring-client.tsx` - Changed quantity to current_quantity

**Changes:**
- Fixed 3 locations referencing `item.quantity` to use `item.current_quantity`
- Matches the ExpiringItem interface from actions/reports.ts

#### 3. Fixed Product created_at Error in Analytics

**Files Modified:**
- `src/app/admin/analytics/actions.ts` - Updated product query and fallback logic

**Changes:**
- Removed `created_at` from Product select (field doesn't exist on model)
- Added `last_restock` from inventory as proxy for product age
- Updated daysSinceLastSale fallback to use last_restock date or default 30 days

#### 4. Fixed Profit Margin Category Dropdown

**Files Modified:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx` - Format category names

**Changes:**
- Categories now display as "Softdrinks Case" instead of "SOFTDRINKS_CASE"
- Applied `formatCategoryName()` helper to dropdown items

#### 5. Moved Expiry Report Filters to Toolbar

**Files Modified:**
- `src/app/admin/reports/expiring/expiring-client.tsx` - Restructured filters

**Changes:**
- Search bar and dropdowns moved to `toolbarFilters` prop
- Consistent styling with other report pages (h-9 inputs, text-xs)
- Removed redundant Filter icon from urgency dropdown

#### 6. Added Batch Return to Supplier Feature

**Files Created:**
- `src/app/admin/reports/expiring/batch-return-dialog.tsx` - Full-featured dialog

**Files Modified:**
- `src/actions/inventory.ts` - Added `batchReturnProducts` action
- `src/app/admin/reports/expiring/expiring-client.tsx` - Added button and dialog
- `prisma/schema.prisma` - Added BATCH_RESTOCK, BATCH_RETURN to AuditAction enum

**Changes:**
- New BatchReturnDialog with:
  - Multi-select batch list sorted by urgency (expired first)
  - Search/filter by product name, supplier, barcode
  - Quick actions: "Select All Expired", "Select All Visible"
  - Return details: supplier name, reference/RMA#, reason
  - Live totals: units, batches, value at risk
  - Confirmation dialog with detailed summary
- batchReturnProducts server action:
  - Atomic transaction (all succeed or all fail)
  - Creates SUPPLIER_RETURN stock movements
  - Syncs inventory totals after batch removal
  - Comprehensive audit logging
- "Batch Return" button in expiry report toolbar

#### 7. Added AuditAction Enum Values

**Files Modified:**
- `prisma/schema.prisma` - Extended AuditAction enum

**Changes:**
- Added BATCH_RESTOCK for batch restock operations
- Added BATCH_RETURN for batch supplier return operations
- Regenerated Prisma client

---

## [Unreleased] - 2026-01-15

### Analytics & Reports UX Improvements

**Verdict:** Comprehensive fixes to analytics charts, data grouping, and reports UI. Added animated sorting to restock table, fixed chart performance on sidebar hover, and improved Intelligence Feed integration with velocity reports.

#### 1. Fixed Weekly Data Grouping (Full Weeks Only)

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Rewrote `groupedChartData` useMemo

**Changes:**
- Weekly view now uses ISO weeks with `eachWeekOfInterval` from date-fns
- Only includes weeks where all 7 days fall within the selected range
- Tooltips now show date range labels (e.g., "Jan 6 - Jan 12")
- Prevents partial week data from skewing averages

#### 2. Fixed Hourly View for All Time Periods

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Updated hourly aggregation logic

**Changes:**
- Hourly view now works for multi-day date ranges
- Averages data across all hours of the day
- Distributes metrics proportionally with peak hour simulation
- Valid for any date range (previously single-day only)

#### 3. Fixed Granularity Toggle Logic

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Updated `getValidGranularities()`

**Changes:**
- Granularity options now based on actual date range, not preset labels
- New logic: 1 day = hourly only; 2-7 days = hourly+daily; <30 = hourly+daily; 30-59 = +weekly; 60+ = all
- Auto-switches granularity when date range changes

#### 4. Fixed Dead Stock "27 Years" Bug

**Files Modified:**
- `src/app/admin/analytics/actions.ts` - Updated `getSmartInsights()` query

**Changes:**
- `daysSinceLastSale` now uses `product.created_at` as fallback instead of hardcoded 9999
- Added `created_at` to product query select
- Products with no sales show days since creation, not impossible values

#### 5. Intelligence Feed Investigate Link

**Files Modified:**
- `src/lib/insights.ts` - Updated `detectSlowMovers()` actionHref

**Changes:**
- "Investigate" button now links to `/admin/reports/velocity?search=<productName>`
- Clicking navigates directly to velocity report with product pre-searched

#### 6. Velocity Report URL Search Integration

**Files Modified:**
- `src/app/admin/reports/velocity/velocity-client.tsx` - Added useSearchParams support

**Changes:**
- Added `useSearchParams` to read initial search query from URL
- Uses `useEffect` to set table filter when URL param is present
- Enables deep linking to specific product searches

#### 7. Reports Page UI Refactoring

**Files Modified:**
- `src/components/reports/report-shell.tsx` - Added `toolbarFilters` prop
- `src/app/admin/reports/velocity/velocity-client.tsx` - Moved filters to toolbar
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx` - Moved filters to toolbar
- `src/app/admin/reports/spoilage/spoilage-client.tsx` - Moved filters to toolbar

**Changes:**
- Report shell now supports `toolbarFilters` slot in nested nav
- Removed title/description from toolbar display
- Search and filter controls now in toolbar area for cleaner layout

#### 8. Animated Sorting for Restock Table

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Updated `SortButton` component

**Changes:**
- Added framer-motion imports (motion, AnimatePresence)
- Added ChevronUp, ChevronDown, ChevronsUpDown icons
- Sort icons now animate with direction indicators matching inventory table

#### 9. Chart Performance on Sidebar Hover

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - All ResponsiveContainer components

**Changes:**
- Added `debounce={100}` to all 3 ResponsiveContainer components
- Prevents frame drops when hovering over collapsing sidebar
- Charts now only resize after 100ms of stable container width

#### 10. Replaced Emoji Arrows with Lucide Icons

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Financial Hub trend display

**Changes:**
- Replaced `📈` / `📉` / `→` with `TrendingUp` / `TrendingDown` / `ArrowRight` icons
- Consistent with design system icon usage

---

## [Unreleased] - 2026-01-15

### Reports UI Restoration & Dashboard Enhancements

**Verdict:** Restored date range preset badges to reports pages, cleaned up reports menu, enhanced Financial Hub with dynamic granularity toggles including hourly view, and expanded date presets with 90 days, 6 months, and yearly options.

#### 1. Restored Date Range Badges for Reports Pages

**Files Created:**
- `src/components/ui/date-range-picker-with-presets.tsx` - New picker with 30 Days, 90 Days, This Year badges

**Files Modified:**
- `src/app/admin/reports/z-read/z-read-client.tsx` - Changed to DateRangePickerWithPresets
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx` - Changed to DateRangePickerWithPresets
- `src/app/admin/reports/velocity/velocity-client.tsx` - Changed to DateRangePickerWithPresets
- `src/app/admin/reports/spoilage/spoilage-client.tsx` - Changed to DateRangePickerWithPresets
- `src/app/admin/reports/sales-category/sales-category-client.tsx` - Changed to DateRangePickerWithPresets

**Changes:**
- Created separate DateRangePickerWithPresets component specifically for reports pages
- Reports pages now have quick access to 30 Days, 90 Days, This Year presets
- Dashboard date pickers remain clean without duplicate badges

#### 2. Cleaned Up Reports Menu

**Files Modified:**
- `src/app/admin/reports/layout-client.tsx` - Removed Audit Logs, Users, Stock from sidebar
- `src/app/admin/reports/page.tsx` - Removed same items from main reports page sidebar

**Changes:**
- Removed 3 audit-related links from reports navigation:
  - Audit Logs (FileText icon)
  - User Activity (Users icon)
  - Stock Movements (Archive icon)
- These are system logs, not business reports - moved to admin-only section
- Cleaned up unused imports (FileText, Users, Archive)

#### 3. Increased Reports Sidebar Font & Icon Sizes

**Files Modified:**
- `src/app/admin/reports/layout-client.tsx` - Updated nested sidebar styling
- `src/app/admin/reports/page.tsx` - Updated main reports page sidebar styling

**Changes:**
- Sidebar width: w-44 → w-48 (more room for text)
- Font size: text-xs → text-sm (better readability)
- Icon size: h-3.5 w-3.5 → h-4 w-4 (clearer icons)
- Padding adjustments for better spacing
- Back button height: h-7 → h-9/h-10 (easier to click)

#### 4. Financial Hub Dynamic Granularity Toggles

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Enhanced granularity controls

**Changes:**
- Added "Hourly" as a new granularity option for single-day views
- Granularity toggles now dynamically enable/disable based on date range:
  - 1 day: Hourly only
  - 2-7 days: Hourly + Daily
  - 8-30 days: Daily + Weekly
  - 31-90 days: Daily + Weekly + Monthly
  - 90+ days: Weekly + Monthly only
- Disabled toggles appear grayed out with cursor-not-allowed
- Auto-selects first valid granularity when date range changes

#### 5. Expanded Date Presets for Dashboards

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Added new presets
- `src/app/admin/dashboard-client.tsx` - Added new presets + imports

**Changes:**
- Added 4 new date presets to both dashboards:
  - Last 90 days (for quarterly analysis)
  - Last 6 months (for trend analysis)
  - 2026 (current year full view)
  - 2025 (previous year for YoY comparison)
- Added `startOfYear` and `endOfYear` imports where needed
- Total presets now: Today, Yesterday, Last 7 days, Last 30 days, Last 90 days, Last 6 months, This Month, Last Month, 2026, 2025

---

## [Unreleased] - 2026-01-15

### UI/UX Improvements & Cache Optimization

**Verdict:** Removed duplicate date range badges, added hourly chart views for single-day ranges, updated peak traffic heatmap to use AM/PM format, added vendor products cache revalidation, and enhanced restock recommendation tooltips.

#### 1. Removed Duplicate Date Range Badges

**Files Modified:**
- `src/components/ui/date-range-picker.tsx` - Removed preset badges (30 Days, 90 Days, This Year)
- `src/app/admin/analytics/analytics-dashboard.tsx` - Removed Year 2024/2025/2026 presets

**Changes:**
- Removed quick preset badges from DateRangePicker component since pages already have their own presets
- Removed Year 2024/2025/2026 options from analytics dashboard presets (redundant with date picker)
- Cleaned up unused imports (Badge, startOfYear, isSameDay, isAfter)

#### 2. Hourly Chart Data for Single-Day Views

**Files Modified:**
- `src/app/admin/analytics/actions.ts` - Updated `getDashboardChartDataByDateRange()`

**Changes:**
- When viewing a single day (Today, Yesterday), charts now show hourly data points
- X-axis displays business hours: 8AM, 9AM, 10AM, 11AM, 12PM, 1PM, 2PM, 3PM, 4PM, 5PM, 6PM, 7PM
- Transactions outside business hours are clamped to nearest hour (before 8AM → 8AM, after 7PM → 7PM)
- Enables better granularity for analyzing daily sales patterns

#### 3. Peak Traffic Heatmap AM/PM Format

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Updated `PeakTrafficHeatmap` component

**Changes:**
- Hour labels now display in AM/PM format (8AM, 9AM, ..., 12PM, 1PM, ..., 7PM)
- Tooltip hover also shows AM/PM format instead of 24-hour time
- Added `formatHourLabel()` helper function for consistent formatting

#### 4. Vendor Products Cache Revalidation

**Files Modified:**
- `src/actions/product.ts` - Added `revalidateTag()` calls

**Changes:**
- Added `revalidateTag("vendor-products")` in:
  - `createProduct()` - When new products are added
  - `updateProduct()` - When product details change
  - `deleteProduct()` - When products are archived
  - `restoreProduct()` - When products are restored from archive
  - `bulkDeleteProducts()` - When multiple products are deleted/archived
- Ensures vendor portal always shows current product catalog
- Works with the `unstable_cache` wrapper added to `getVendorProducts()`

#### 5. Restock Recommendation Tooltips

**Files Modified:**
- `src/app/admin/analytics/analytics-dashboard.tsx` - Updated `ForecastingTable` component

**Changes:**
- Added individual tooltips to **Forecasted** column data cells showing:
  - Average daily sales rate
  - 7-day projection
  - Confidence level (HIGH/MEDIUM/LOW)
- Added individual tooltips to **Rec** (Recommended) column data cells showing:
  - Current stock level
  - Daily velocity
  - 7-day demand forecast
  - Order quantity calculation
  - Estimated cost (if cost price available)
- Tooltips provide transparency into how each value was calculated

---

## [Previous] - 2026-01-15

### Security & Performance Enhancements

**Verdict:** Added failed login attempt tracking for security monitoring, integrated logout logging across all app paths, added vendor registration auditing, implemented Server-Sent Events (SSE) for real-time updates, and added caching for vendor products.

#### 1. Failed Login Attempt Logging

**Files Modified:**
- `prisma/schema.prisma` - Added `LOGIN_FAILED` to AuditAction enum
- `src/lib/logger.ts` - Added `logLoginFailed()` function
- `src/actions/auth.ts` - Enhanced login action with failure tracking

**Changes:**
- New `logLoginFailed()` function captures: identifier (email/username), failure reason, attempt timestamp
- Failure reasons tracked: `user_not_found`, `wrong_password`, `account_disabled`, `unknown`
- Login action now validates credentials BEFORE calling signIn, enabling failure logging
- Failed attempts are logged for security monitoring and brute-force detection

#### 2. Vendor Registration Logging

**Files Modified:**
- `prisma/schema.prisma` - Added `VENDOR_REGISTER` to AuditAction enum
- `src/lib/logger.ts` - Added `logVendorRegister()` function
- `src/actions/auth.ts` - Integrated registration logging

**Changes:**
- New `logVendorRegister()` function captures: vendor_id, vendor_name, email, contact_details
- vendorRegister() action now creates audit log entry on successful registration
- Enables tracking of complete vendor lifecycle from registration to orders

#### 3. Logout Integration Across All Paths

**Files Modified:**
- `src/app/vendor/layout-client.tsx`
- `src/app/vendor/profile/profile-client.tsx`
- `src/components/kokonutui/top-nav.tsx`

**Changes:**
- All 3 logout buttons now use the centralized `logout()` server action
- Replaced direct `signOut()` calls with `logout()` then router.push("/login")
- Complete audit trail for all user sessions (login → actions → logout)

#### 4. Server-Sent Events (SSE) for Real-Time Updates

**Files Created:**
- `src/app/api/notifications/stream/route.ts` - SSE endpoint for notifications
- `src/app/api/orders/stream/route.ts` - SSE endpoint for order status
- `src/hooks/use-event-source.ts` - Custom React hook for SSE connections

**Files Modified:**
- `src/components/ui/notification-bell.tsx` - Integrated SSE with polling fallback
- `src/components/vendor/live-order-status.tsx` - Integrated SSE with reduced polling

**Changes:**
- Notifications now update in real-time via SSE (10s server-side polling)
- Order status updates pushed instantly when status changes
- useEventSource hook handles connection lifecycle, auto-reconnect, visibility changes
- Polling reduced from 5s/30s to 30s/60s as fallback only
- Significantly reduced server load while improving responsiveness

#### 5. Vendor Products Caching

**Files Modified:**
- `src/actions/vendor.ts`

**Changes:**
- Wrapped `getVendorProducts()` with `unstable_cache` from next/cache
- 60-second revalidation period to reduce database queries
- Tagged with "vendor-products" for manual revalidation when products change
- Improves vendor portal load times significantly

#### 6. Audit Logs UI Updates

**Files Modified:**
- `src/app/admin/audit-logs/audit-logs-client.tsx`
- `src/components/audit/log-details-modal.tsx`

**Changes:**
- Added ShieldAlert icon for LOGIN_FAILED (high-risk red styling)
- Added UserPlus icon for VENDOR_REGISTER (emerald styling)
- DiffSummary and modal metadata display for new action types
- LOGIN_FAILED shows: identifier, failure reason, attempt timestamp
- VENDOR_REGISTER shows: vendor name, email, contact, registration time

---

## [Previous] - 2026-01-15

### Comprehensive Audit Logging Enhancements

**Verdict:** Fixed product image changes not being tracked in audit logs, added LOGIN/LOGOUT tracking, and added Z-Read (end of day) close logging for complete operational audit trail.

#### 1. Fixed Product Image Change Tracking

**Files Modified:**
- `src/actions/product.ts`

**Problem:** Updating a product's image showed "0 field" change in audit logs because `image_url` was not included in oldData/newData objects.

**Solution:**
- Added `image_url` field to both `oldData` and `newData` objects in `updateProduct()` function
- The logger's `generateChangeDiff()` now correctly detects image URL changes

#### 2. Authentication Logging (Login/Logout)

**Files Modified:**
- `prisma/schema.prisma` - Added `LOGIN`, `LOGOUT` to AuditAction enum
- `src/lib/logger.ts` - Added `logLogin()` and `logLogout()` functions
- `src/actions/auth.ts` - Integrated login logging, added `logout()` server action

**Changes:**
- New `logLogin()` function captures: username, user_type, email, ip_address, session_status
- New `logLogout()` function captures: username, user_type, ip_address, session_status
- Login action now creates audit log entry on successful authentication
- New `logout()` server action that logs the event before calling signOut()

#### 3. Z-Read (End of Day) Close Logging

**Files Modified:**
- `prisma/schema.prisma` - Added `ZREAD_CLOSE` to AuditAction enum
- `src/lib/logger.ts` - Added `logZReadClose()` function
- `src/actions/sales.ts` - Added `closeZRead()` server action
- `src/components/dashboard/cash-register-card.tsx` - Integrated closeZRead with toast feedback

**Changes:**
- New `logZReadClose()` function captures: total_sales, total_transactions, cash_sales, gcash_sales, expected_drawer, actual_drawer, variance, starting_cash
- Cash register Z-Read confirmation now calls `closeZRead()` server action
- Shows success/error toast notifications on completion

#### 4. Audit Logs UI Updates

**Files Modified:**
- `src/app/admin/audit-logs/audit-logs-client.tsx`
- `src/components/audit/log-details-modal.tsx`

**Changes:**
- Added new icons: LogIn, LogOut, Receipt
- Added ACTION_CONFIG entries for LOGIN, LOGOUT, ZREAD_CLOSE with appropriate colors
- Added DiffSummary display handlers for new action types
- Log details modal now shows metadata for:
  - LOGIN/LOGOUT: User type, email, IP address, session status
  - ZREAD_CLOSE: Total sales, transactions, cash/gcash breakdown, drawer variance

#### 5. Database Migration

**Migration:** `20260115101651_add_audit_action_types`

- Added `LOGIN`, `LOGOUT`, `ZREAD_CLOSE` to AuditAction enum in PostgreSQL

---

### Reports & Date Range Picker Improvements - Phase 4

**Verdict:** Enhanced date range picker with independent calendar controls, added loading overlays to report content areas, and added date range support to all report pages.

#### 1. Customer Avatar URL Field

**Files Modified:**
- `prisma/schema.prisma`
- `src/actions/vendor.ts`

**Changes:**
- Added `avatar_url` field to Customer model via Prisma migration
- Enabled avatar persistence in `updateVendorProfile()` server action
- Vendor profile photos now persist to database

#### 2. Date Range Picker - Independent Controls

**Files Modified:**
- `src/components/ui/date-range-picker.tsx`

**Problem:** Year/month controls in calendar were linked - changing one side affected the other.

**Solution:**
- Split into two separate Calendar components with independent state
- `leftMonth` and `rightMonth` states for each calendar side
- Users can now navigate each calendar independently for complete date selection freedom
- Added preset badges with active state indicator (primary color when selected)

#### 3. Loading Indicators - Content Areas

**Files Modified:**
- `src/components/ui/loading-overlay.tsx` (NEW)
- `src/components/reports/report-shell.tsx`
- All report client components

**Changes:**
- Created `LoadingOverlay` component with semi-transparent overlay and spinner
- Removed loading indicator from toolbar (was too cramped)
- Added loading overlays to summary cards and data tables
- Provides instant visual feedback during data fetching

#### 4. Date Range Support - All Reports

**Files Modified:**
- `src/actions/reports.ts` - Updated `getVelocityReport()`, `getSalesByCategory()`, and `getMarginAnalysis()` to accept dateRange
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/sales-category/sales-category-client.tsx`
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/app/admin/reports/spoilage/spoilage-client.tsx`

**Implementation:**
- Moved `DateRangePicker` to `toolbarContent` prop in all report pages for consistent placement
- Added `useTransition` for async data fetching with loading states
- Reports now support dynamic date ranges instead of hardcoded 30-day window
- Added `LoadingOverlay` to summary cards and data tables
- Consistent UX across all report pages

#### 5. Profit Margin - Sortable Columns

**Files Modified:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`

**Changes:**
- Added `SortableHeader` to Cost Price column
- Added `SortableHeader` to Retail Price column
- Users can now sort by cost, price, or margin percentage

#### 6. Preset Badge Active State

**Files Modified:**
- `src/components/ui/date-range-picker.tsx`

**Changes:**
- Added `isPresetActive()` helper to detect when current date matches a preset
- Active preset shows primary background color
- Non-active presets show outline variant with hover effect

---

## [Unreleased] - 2026-01-15

### Vendor Portal & Reports UX Improvements - Phase 3

**Verdict:** Enhanced vendor profile with camera upload, improved navigation, added logout confirmations, and standardized category name formatting across all report pages.

#### 1. Vendor Profile Camera Upload

**Files Modified:**
- `src/app/vendor/profile/profile-client.tsx`

**Features:**
- Clickable avatar with camera icon overlay
- Hidden file input with `accept="image/*" capture="environment"` for mobile camera access
- Loading state during upload with `Loader` icon animation
- Uses `uploadImageRaw()` action for server-side storage
- Note: Database persistence pending Customer model migration (avatar_url field)

#### 2. My Profile in Vendor Navigation

**Files Modified:**
- `src/app/vendor/layout-client.tsx`

**Changes:**
- Added "My Profile" option to both desktop and mobile dropdowns
- Links to `/vendor/profile` page
- User icon added for visual consistency

#### 3. Logout Confirmation Modals

**Files Modified:**
- `src/app/vendor/profile/profile-client.tsx`
- `src/app/vendor/layout-client.tsx`

**Implementation:**
- AlertDialog confirmation for all logout buttons
- Consistent styling with destructive action button
- "Are you sure you want to log out?" message
- Cancel and Logout options

#### 4. Profit Margin Report - Price Header Fix

**Files Modified:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/actions/reports.ts`

**Changes:**
- Changed "Retail" table header to "Price" to accommodate wholesale pricing
- Updated wholesale price fetch logic: uses wholesale_price when retail_price is 0 (for softdrinks cases)
- Applied `formatCategoryName()` helper for consistent category display

#### 5. Category Name Formatting (All Reports)

**Files Modified:**
- `src/app/admin/reports/spoilage/spoilage-client.tsx`
- `src/app/admin/reports/expiring/expiring-client.tsx`
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/sales-category/sales-category-client.tsx`

**Implementation:**
- Added `formatCategoryName()` helper function to each report
- Converts SNAKE_CASE to Title Case (e.g., SOFT_DRINKS → Soft Drinks)
- Applied to:
  - Table cell displays
  - Category filter dropdowns
  - Print table data
  - Excel export rows

#### 6. Date Range Picker Enhancements

**Files Modified:**
- `src/components/ui/date-range-picker.tsx`

**Features:**
- Added preset badges: "30 Days", "90 Days", "This Year"
- Each preset auto-sets date range on click
- Added `captionLayout="dropdown"` to Calendar for quick year selection
- Users can now select year from dropdown instead of clicking through months

---

## [Unreleased] - 2026-01-15

### Vendor Portal UX Improvements - Phase 2

**Verdict:** Fixed database field mapping, redesigned profile page with mobile-first design, and fixed duplicate notification toasts.

#### 1. Database Field Fix

**Files Modified:**
- `src/actions/vendor.ts`

**Problem:** Server action used `contact` but database field is `contact_details`.

**Fix:** Changed `{ contact: data.contact }` to `{ contact_details: data.contact }` in `updateVendorProfile()`.

#### 2. Profile Page Redesign (Mobile-First)

**Files Modified:**
- `src/app/vendor/profile/profile-client.tsx`

**Design Changes:**
- Dark header section with large avatar and camera icon overlay
- Name and email displayed in header
- Content area with rounded top corners that overlaps header
- Grouped menu sections with consistent row styling
- Inline editing for email and contact with save/cancel buttons
- Quick Actions section (Browse Products, Order History)
- Destructive logout button with red styling
- Full dark mode support

**UX Pattern:**
- Touch-friendly row items (44px+ height)
- Visual hierarchy with section labels
- Consistent icon styling in circular containers

#### 3. Notification Polling Fix (Duplicate Toast Prevention)

**Files Modified:**
- `src/components/ui/notification-bell.tsx`

**Problem:** Polling caused same notifications to show toast repeatedly.

**Solution:**
- Added `toastedIdsRef` Set to track which notification IDs have been shown as toasts
- Added `isInitialFetchRef` to skip toasting on first load
- Only new notifications that haven't been toasted will trigger a toast
- Existing notifications are added to the "seen" set on initial fetch

**Behavior Change:**
- First page load: No toasts (existing notifications silently loaded)
- Subsequent polls: Only truly NEW notifications trigger toasts
- Each notification ID can only trigger one toast ever

---

## [Previous] - 2026-01-15

### Vendor Portal UX Improvements
- `src/app/vendor/order/order-client.tsx`

**Changes:**
- **Removed category dropdown** - Wholesale products are now the only category, no filter needed
- **Added direct quantity editing** - Users can now type exact quantities in both product cards and cart items
- **Number input styling** - Clean inputs with hidden spinners for professional look
- **Added `setQuantity()` function** - Allows setting exact quantity values rather than just +/- buttons

#### 2. Profile Page Editable Fields

**Files Created:**
- `updateVendorProfile()` server action in `src/actions/vendor.ts`

**Files Modified:**
- `src/app/vendor/profile/profile-client.tsx`

**Changes:**
- **Email editing** - Click edit icon to modify email with validation
- **Contact editing** - Click edit icon to modify phone number with Philippine format validation
- **Toast feedback** - Success/error notifications for all profile updates
- **Inline edit UX** - Save/cancel buttons appear during editing mode

#### 3. Warm White Design System Implementation

**Files Modified:**
- `src/app/vendor/vendor-dashboard.tsx` - Quick Stats and Quick Actions sections
- `src/app/vendor/layout-client.tsx` - Main layout background
- `src/app/vendor/order/order-client.tsx` - Product cards and cart
- `src/app/vendor/history/history-client.tsx` - Order history cards
- `src/app/vendor/profile/profile-client.tsx` - Profile card
- `src/components/vendor/live-order-status.tsx` - Order status cards
- `src/components/vendor/quick-reorder-row.tsx` - Quick reorder section
- `src/components/vendor/recent-orders-list.tsx` - Recent orders list

**Design System Applied:**
| Element | Old Class | New Class |
|---------|-----------|-----------|
| Card backgrounds | `bg-card`, `bg-white` | `bg-[#F8F6F1] dark:bg-zinc-900` |
| Page backgrounds | `bg-zinc-50` | `bg-[#FAFAF9]` |
| Borders | `border-border` | `border-stone-200 dark:border-zinc-700` |
| Primary text | `text-foreground` | `text-[#2d1b1a] dark:text-white` |
| Muted text | `text-muted-foreground` | `text-stone-500 dark:text-zinc-400` |
| Hover states | `hover:bg-muted` | `hover:bg-stone-100 dark:hover:bg-zinc-800` |

---

## [Previous] - 2026-01-15

### Reports Command Center Fixes & Performance Optimizations

**Verdict:** Fixed critical Server Component error blocking site access, optimized database queries, and added caching.

#### 1. Server Component onClick Fix

**Problem:** WidgetCard component passed onClick handler to Button, which is not allowed in React Server Components.

**Files Created:**
- `src/components/reports/widget-export-button.tsx` - New Client Component for export functionality

**Files Modified:**
- `src/app/admin/reports/page.tsx` - Extracted interactive export button to client component

**Changes:**
- Created `WidgetExportButton` client component with proper event handling
- Removed inline onClick from WidgetCard (now RSC-compatible)
- Cleaned up unused imports (Download icon, Tooltip components)

#### 2. Query Performance Optimization

**File Modified:** `src/actions/reports.ts`

**Problem:** `getEnhancedDashboardData` ran 7 sequential database queries for sparkline data.

**Optimizations:**
- Single batch query fetches all 7 days of transactions at once
- Sparkline data built from in-memory filtering (not additional queries)
- Used `aggregate()` for same-day-last-week comparison instead of fetching full records
- Reduced database round trips from ~10+ to ~5

#### 3. Caching Layer Added

**File Modified:** `src/actions/reports.ts`

**Changes:**
- Wrapped `fetchEnhancedDashboardData` with `unstable_cache`
- Cache duration: 60 seconds
- Cache tags: `["dashboard", "reports"]` for targeted invalidation
- Renamed internal function to `fetchEnhancedDashboardData`, exported cached wrapper as `getEnhancedDashboardData`

---

## [Previous] - 2026-01-15

### Reports Module UI/UX Standardization (Phase 12) - Z-Read Pattern Rollout

**Verdict:** Standardized all report pages to follow Z-Read "Golden Standard" pattern with consistent styling, peso formatting, and Card-based layouts.

#### 1. Report Pages Standardized

**Files Modified:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/spoilage/spoilage-client.tsx`
- `src/app/admin/reports/expiring/expiring-client.tsx`
- `src/app/admin/reports/sales-category/sales-category-client.tsx`

**Changes Applied:**
- **formatPeso Helper:** Normal weight peso sign (`₱`) with bold numbers
- **CompactCard Component:** Replaced `ReportSummaryCard` with `CompactCard` supporting trend indicators
- **Card Wrappers:** Replaced `ReportSection` with `Card`/`CardHeader`/`CardContent` for tables
- **Left-Aligned Columns:** Changed numeric columns from right-aligned to left-aligned per design standards
- **TrendingUp/TrendingDown Icons:** Added for trend visualization support

#### 2. Report Shell Widget Cards

**File Modified:** `src/app/admin/reports/page.tsx`

**Changes:**
- WidgetCard now fully clickable (entire card is a Link)
- Added hover effects: `hover:border-primary/30`, `hover:shadow-md`, `hover:bg-muted/20`
- Added ExternalLink icon and "View Report →" text for click affordance
- Improved accessibility with cursor-pointer

#### 3. Dashboard Peso Formatting

**File Modified:** `src/app/admin/dashboard-client.tsx`

**Changes:**
- Added `formatPeso()` helper function
- Applied to: Estimated Profit, Total Revenue, Total Cost metric cards
- Peso sign uses normal weight while numbers remain bold

#### 4. TypeScript Bug Fixes

**File Modified:** `src/actions/reports.ts`

**Fix:** Changed InventoryBatch property references:
- `batch.current_quantity` → `batch.quantity`
- `batch.batch_id` → `batch.id`
- `batch.inventory.product` → `batch.product`

#### 5. Vendor Products Filter

**File Modified:** `src/actions/vendor.ts`

**Change:** Added category filter to `getVendorProducts()` to only return `SOFTDRINKS_CASE` items (wholesale only)

#### 6. Image Upload Warning Suppression

**File Modified:** `src/lib/process-image.ts`

**Fix:** Added stderr suppression for GLib-GObject warnings during AI background removal
- Warnings from native ONNX runtime no longer clutter console
- Processing functionality unchanged
- Logged count of suppressed warnings for debugging

---

## [Previous] - 2026-01-15

### Reports Module UI/UX Enhancement (Phase 11) - Control Logic & Data Fixes

**Verdict:** Added date range filtering, fixed data bugs, improved typography for Peso sign.

#### 1. Date Range Control (Z-Read/Daily Sales Log)

**New Feature:** `DateRangePicker` in toolbar
- Default range: "This Month" (1st of current month to Today)
- NOT "All Time" to avoid performance issues
- Reactivity: Changing date range re-fetches summary cards AND table data
- Print/Export: Date range included in PDF header ("Report Period: Jan 1, 2026 - Jan 15, 2026")
- Loading indicator in toolbar during data fetch

**Files Modified:**
- `src/app/admin/reports/z-read/z-read-client.tsx` - Added `DateRangePicker`, `useTransition` for loading state
- `src/app/admin/reports/z-read/page.tsx` - Changed prop from `data` to `initialData`
- `src/components/reports/report-shell.tsx` - Added `toolbarContent` and `isLoading` props

#### 2. Dead Stock Bug Fix

**Bug:** "Unknown Product" displayed in Dead Stock Alert card
**Root Cause:** Query used `p.name` instead of `p.product_name`
**Fix:** `src/actions/reports.ts` line 1083 - Changed to `productName: p.product_name`

#### 3. Closed By Column Capitalization

**Before:** "admin" (lowercase)
**After:** "Admin" (capitalized)
**Implementation:** Added `capitalizeWords()` helper function

#### 4. Peso Sign Typography

**Design Principle:** Bold Peso signs look bad when paired with bold numbers
**Fix:** Peso sign (₱) uses `font-normal` weight while numbers remain bold
**Applied to:**
- Today's Snapshot (Gross Sales, Cash, GCash, Est. Profit)
- Dead Stock Alert (capital tied values)
- Profit Trend (7-Day Total)
- Spoilage & Loss (monthly value)
- Z-Read table (all currency columns)

**Implementation Pattern:**
```tsx
<span className="font-normal">₱</span>{amount.toLocaleString()}
```

#### 5. Print Layout Enhancement

**Date Range in Header:** PDF prints now include:
- "Report Period: Jan 1, 2026 - Jan 15, 2026 | Generated on..."
- Provides context for which period the report covers

#### 6. Files Modified
- `src/app/admin/reports/z-read/z-read-client.tsx` - DateRangePicker, capitalizeWords, formatPeso
- `src/app/admin/reports/z-read/page.tsx` - Initial data uses "This Month" range
- `src/components/reports/report-shell.tsx` - toolbarContent slot, dateRange in print
- `src/actions/reports.ts` - Fixed productName bug
- `src/app/admin/reports/page.tsx` - formatPeso helper, applied to all currency values

---

### Reports Module UI/UX Enhancement (Phase 10) - Animated Sorting & Final Polish

**Verdict:** Implemented animated sorting indicators, fixed layout padding, and containerized tables for production-ready reports.

#### 1. Animated Sorting Indicators (Global Feature)

**New Component:** `src/components/ui/sortable-header.tsx`
- Uses Framer Motion for smooth icon transitions
- ChevronUp (ascending), ChevronDown (descending), ChevronsUpDown (unsorted)
- Spring animation with opacity/y-axis transition
- Applied to ALL sortable tables system-wide

**Applied to:**
- Inventory Products Table (`src/app/admin/inventory/products-table.tsx`)
- Daily Sales Log (Z-Read) Table
- Profit Margin Analysis Table
- Sales by Category Table
- Inventory Velocity Table
- Spoilage & Wastage Table
- Expiry Tracker Table

#### 2. Layout & Padding Fixes

**Problem:** Nested sidebar and toolbar appeared "sunk in" with incorrect padding
**Solution:**
- Removed negative margins from `layout-client.tsx`
- Adjusted `AdminLayoutClient` to properly handle report page layout
- Reports Shell page now uses same `ReportsLayoutClient` as individual pages

#### 3. Summary Card Sizing (Z-Read)

**Grid Layout:** Changed to `grid grid-cols-4 gap-4`
- Gross Sales: `col-span-2` (wider card, `text-3xl` value)
- Profit: `col-span-2` (wider card, `text-3xl` value)
- Days Tracked: `col-span-1` (compact)
- Transactions: `col-span-1` (compact)

#### 4. Table Containerization

**Problem:** Tables merged visually with page container
**Solution:** 
- Tables now wrapped in `Card` component within `ReportShell`
- Creates distinct visual separation (matches Inventory golden standard)
- Table header row uses `bg-muted/50` for clear column demarcation

#### 5. Header Card Removal

**Removed from ALL report pages:**
- Redundant header card with title/description/"Admin" badge
- Title now in toolbar beside navigation
- Description in toolbar after `|` separator
- Cleaner, denser layout

#### 6. Files Modified/Created
- `src/components/ui/sortable-header.tsx` - **NEW** animated sorting component
- `src/components/reports/report-shell.tsx` - Card wrapper for tables, re-exports SortableHeader
- `src/app/admin/inventory/products-table.tsx` - Uses new SortableHeader
- `src/app/admin/reports/z-read/z-read-client.tsx` - Summary card sizing, SortableHeader
- `src/app/admin/reports/*/[all-clients].tsx` - SortableHeader integration
- `src/app/admin/reports/layout-client.tsx` - Fixed padding/margins
- `src/app/admin/layout-client.tsx` - Report page layout handling

---

### Reports Module UI/UX Enhancement (Phase 9) - Visual Consistency & Table Standards

**Verdict:** Fixed sidebar consistency, removed redundant cards, standardized tables to Inventory golden pattern.

#### 1. Sidebar Consistency

**Reports Shell Page:**
- Sidebar now matches individual report pages exactly
- Same positioning (next to main sidebar)
- Same styling and navigation links
- Added toolbar with title + description

**Individual Report Pages:**
- Sidebar and toolbar remain consistent across all reports
- "All Reports" back button matches "Dashboard" button style

#### 2. Removed Redundant Info Cards

**Before:** Each report had a header card showing:
- Title + Icon
- Description
- "Admin" badge
- "Christian Minimart" badge

**After:** This card is removed from ALL report pages. Information is now:
- Title: In toolbar
- Description: In toolbar (after `|` separator)

#### 3. Table Design - Inventory Golden Standard

**Applied to Z-Read and all report tables:**
- All headers: LEFT-aligned with `-ml-4` offset
- All data cells: LEFT-aligned
- Header style: `uppercase text-[11px] font-semibold tracking-wider`
- Uses `ArrowUpDown` icon for sortable columns
- Proper `px-4` cell padding for consistent spacing
- Removed all `text-right` alignment from numeric columns

**Specific fixes:**
- TXN column: No longer floating far from Date
- Gross Sales, Profit, Cash, GCash: All LEFT-aligned (was RIGHT)
- Headers sit directly above data (visual separation)

#### 4. Summary Card Sizing (Z-Read)

- Days Tracked: Smaller card (`col-span-1`)
- Transactions: Smaller card (`col-span-1`)
- Gross Sales: Shows full value (₱3,419,266.50)
- Profit: Shows full value (₱344,746.32)

#### 5. Files Modified
- `src/app/admin/reports/page.tsx` - Added sidebar + toolbar, matches individual pages
- `src/app/admin/reports/layout-client.tsx` - Updated wrapper for reports shell
- `src/components/reports/report-shell.tsx` - Removed header card, description in toolbar
- `src/app/admin/reports/z-read/z-read-client.tsx` - LEFT-aligned tables, sizing fix

---

### Reports Module UI/UX Enhancement (Phase 8) - Brutally Honest Fixes

**Verdict:** Fixed all UI/UX issues identified in brutal audit for production-ready ERP.

#### 1. Reports Shell - Complete Overhaul

**Today's Snapshot Redesign:**
- Removed dark/disconnected background
- Now uses standard card style (`bg-[#F8F6F1]`) matching app theme
- Dark text for numbers, brand color only for header icon
- Integrates visually with rest of dashboard

**Sidebar Navigation:**
- **ADDED** sidebar to Reports Shell page (was only on drill-down pages)
- Users can now see all report links immediately without clicking
- Links: Daily Sales, Profit Margin, Sales by Category, Velocity, Spoilage, Expiry, Audit Log, Users, Stock

**Text Sizing Fixed:**
- Increased sub-headers from `text-[10px]` to `text-xs` (12px)
- Labels like "LAST 7 DAYS REVENUE" and "TOP CATEGORIES" now readable

**Ghost Buttons:**
- Changed Export/View buttons from `variant="outline"` to `variant="ghost"`
- Buttons now blend into cards (no white background "stickers")

**Data Formatting:**
- `formatCategoryName()` helper converts database names to Title Case
- `SOFTDRINKS_CASE` → "Softdrinks Case"
- `SODA` → "Soda"

**Dead Stock Card Fixed:**
- Product names now render properly (was showing rank only)
- Shows "1. Product Name ... ₱Value" format

#### 2. Daily Sales Log (Z-Read) - Accounting & Logic Fixes

**Number Formatting:**
- `formatCurrency()` helper for proper K/M notation
- **Rule:** >1M uses "M" (e.g., ₱3.42M), >1K uses "K" (e.g., ₱344.7K)
- Fixed confusing "3419.3K" → now "₱3.42M"

**Table Alignment:**
- All numeric headers now RIGHT-ALIGNED
- Headers align directly above data columns
- Creates clean vertical lines for scanning

**Date Sorting Bug Fixed:**
- Records now pre-sorted by date DESC (newest first)
- `sortedRecords = [...data.records].sort((a, b) => new Date(b.date) - new Date(a.date))`
- Wed Jan 14 → Tue Jan 13 → Mon Jan 12 (chronologically correct)

**Admin Column:**
- Removed Avatar bubbles (visual noise)
- Shows text names: "admin", "John D." (truncated if >8 chars)
- Better for audit purposes and scanning

#### 3. Files Modified
- `src/app/admin/reports/page.tsx` - Added sidebar, redesigned snapshot, ghost buttons
- `src/app/admin/reports/z-read/z-read-client.tsx` - Number formatting, alignment, sorting, text names

---

### Reports Module UI/UX Enhancement (Phase 7) - Logic Audit & Production Fixes

**Verdict:** Fixed "Fake Data" patterns and logic issues identified in ERP audit.

#### 1. Reports Shell - Logic & Density Fixes

**Today's Snapshot Redesign:**
- Removed solid brown background (was "off-putting")
- New light, modern design with subtle dot pattern
- Metric cards with frosted glass effect (`bg-white/60`)
- Est. Profit highlighted in teal accent color

**Recharts Sparklines:**
- Replaced CSS-based bars with actual Recharts AreaChart
- Revenue and Profit curves now show DIFFERENT patterns (not mirrored)
- Smooth gradient fills with proper scaling
- Client component extracted to `src/components/reports/mini-sparkline.tsx`

**Segmented Inventory Health Bar:**
- Replaced single progress bar with 3-segment bar (Fast/Slow/Dead)
- **Minimum width enforced (5%)** for small segments so Dead Stock is always visible
- Color-coded legend: Teal=Fast, Orange=Slow, Red=Dead

**Dead Stock Card:**
- Now shows Top 3 items (not just 1)
- Numbered list with capital value for each
- "Total at risk" sum displayed at bottom

**Action Buttons:**
- Changed from text links to distinct icon buttons (`variant="outline" size="icon"`)
- Export button disabled (grayed) when nothing to export (e.g., zero spoilage)

#### 2. Z-Read Report → "Daily Sales Log" (Accounting Logic Fixes)

**Renamed Report:**
- Changed from "Z-Read History" to "Daily Sales Log"
- Updated title, description, and export filename

**Fixed Trend Calculation:**
- **Before:** All trends showed ~35% (Date Range Mismatch bug)
- **After:** Uses "Same Period Previous Month" comparison (Jan 1-14 vs Dec 18-31)
- Trend label now shows "vs previous 14 days" for clarity
- Each metric now has independent trend percentage

**Conditional Voids Column:**
- **If totalVoids === 0:** Column hidden entirely (saves horizontal space)
- Section description shows "No voids recorded" note
- Excel export also excludes void columns when not needed

#### 3. Files Modified/Created
- `src/app/admin/reports/page.tsx` - Complete redesign with all fixes
- `src/components/reports/mini-sparkline.tsx` - New client component for Recharts
- `src/app/admin/reports/z-read/z-read-client.tsx` - Fixed trends, conditional columns

---

### Reports Module UI/UX Enhancement (Phase 6) - "Command Center" Transformation

**Verdict:** Transformed Reports from "Pretty Links" to "High-Utility Dashboard" meeting professional ERP standards.

#### 1. Reports Shell → Live Dashboard (`src/app/admin/reports/page.tsx`)

**Today's Snapshot Hero Section:**
- Full-width dark gradient card at top showing live Z-Read data
- Displays: Gross Sales, Transactions, Cash, GCash, Est. Profit
- Trend indicator (e.g., "▲ 8% vs same day last week")
- Date badge and "Full Report" quick action button

**Widgetized Report Cards:**
- **Sales Trend Widget:** CSS sparkline showing last 7 days revenue + Top 3 categories list
- **Profit Margin Widget:** CSS sparkline showing last 7 days profit + avg margin display
- **Spoilage Widget:** Loss amount with "Zero loss!" badge when applicable
- **Inventory Velocity Widget:** Health progress bar + Fast/Slow/Dead breakdown
- **Dead Stock Widget:** Top 3 items by capital at risk
- **Expiry Tracker Widget:** Critical count (≤7 days) with alert indicator

**Footer Actions:**
- Removed "Click to view report" text (redundant)
- Added `[Export]` and `[View]` buttons in card footer

#### 2. Z-Read Report Analytical Upgrades (`src/app/admin/reports/z-read/z-read-client.tsx`)

**Summary Cards with Trend Indicators:**
- Added trend badges (▲/▼ XX%) showing period-over-period comparison
- Each metric now answers "Compared to what?"
- Values formatted as K/M for readability (e.g., ₱3596.9K)

**Table Data Visualization:**
- **Data Bars:** Gross Sales column has subtle colored background bars proportional to value
- Highest sales days visually "pop out" instantly
- **Voids Column:** Zero values show faint gray dash `—`, non-zero in bold red badge
- **User Avatars:** Replaced repetitive "admin" text with colored avatar circles (initials)
- Reduced column widths for denser data display

#### 3. New Server Action (`src/actions/reports.ts`)

**getEnhancedDashboardData():**
- Returns comprehensive data for live widgets:
  - `todaySnapshot`: Live Z-Read data with same-day-last-week comparison
  - `salesSparkline`: Last 7 days revenue/profit for sparklines
  - `topCategories`: Top 3 categories by revenue
  - `topDeadStock`: Top 3 dead stock items by capital tied
  - `inventoryHealth`: Healthy/Dead/Slow/Fast breakdown
  - `spoilageLossThisMonth`, `expiringCriticalCount`

**Design Philosophy Applied:**
- Every pixel earns its place
- Numbers always have context (trends)
- Empty columns de-emphasized
- Visual scanning optimized with data bars and color coding

---

### Reports Module UI/UX Enhancement (Phase 5) - Cards, Progress Bars & Table Fixes

Addressed user feedback on card sizes, progress bar colors, and table overflow.

#### 1. Reports Gallery Cards - Larger & Fill Space (`src/app/admin/reports/page.tsx`)

**Expanded Card Design:**
- Cards now use `min-h-[100px]` to fill more vertical space
- Larger icons (6x6 instead of 5x5) with bigger padding (p-2.5)
- Font size increased to `text-base` for titles
- Two-line layout: Icon+Title row, then Metric/CTA row below
- Rounded corners changed to `rounded-xl` for modern look
- Cards without metrics show "Click to view report →" placeholder
- Responsive grid: 1 column mobile, 2 columns tablet, 3 columns desktop

#### 2. Progress Bars - Neutral Background (`src/components/ui/progress.tsx`)

**Problem:** Orange accent color for progress bar background clashed with red primary indicator

**Solution:**
- Changed default background from `bg-secondary` to `bg-stone-200` (neutral)
- Added `indicatorClassName` prop to customize indicator color per-use
- Updated all report tables to use:
  - `bg-stone-200` background (neutral gray)
  - Dynamic indicator colors based on value (red/orange/blue/teal)

**Files Updated:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/expiring/expiring-client.tsx`
- `src/app/admin/reports/sales-category/sales-category-client.tsx`

#### 3. Product Name Truncation - No Horizontal Scroll

**Problem:** Long product names caused table horizontal overflow

**Solution:**
- Added `max-w-[200px]` container to product name cells
- Applied `truncate` class to product names and category lines
- Added `title` attribute to show full name on hover
- Column width constrained to `size: 200` (down from 220)

**Files Updated:**
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx`
- `src/app/admin/reports/velocity/velocity-client.tsx`
- `src/app/admin/reports/spoilage/spoilage-client.tsx`
- `src/app/admin/reports/expiring/expiring-client.tsx`

---

### Reports Module UI/UX Enhancement (Phase 4) - Layout & Print Fixes

Critical fixes for layout, scrolling, and print preview issues in the Reports module.

#### 1. Reports Gallery Compact Redesign (Superseded by Phase 5)

**Previous Changes:**
- Removed page header (title "Reports" and subtitle)
- Removed pinned reports section entirely
- All 9 reports now in a dense 3x3 grid layout
- Whole card is now clickable (not just small "Open" button)
- Cards are compact with icon, title, and optional metric on one line
- Removed "Export" button from cards (use Export in individual report toolbar)

#### 2. Fixed Layout/Scrolling Issues

**Problem:** Content had excess whitespace, sidebars not accounting for padding properly

**Solution (`src/app/admin/reports/layout-client.tsx`):**
- Changed `h-full` to `flex flex-1 min-h-0` for proper flex layout
- Sidebar now uses `overflow-hidden` to prevent double scrollbars
- Main content area properly fills available space

**Solution (`src/components/reports/report-shell.tsx`):**
- Changed `h-full` to `flex-1 min-h-0` for flex-based sizing
- Reduced padding from `p-4` to `p-3` for denser layout
- Reduced grid gaps from `gap-4` to `gap-3`

#### 3. Fixed Print Preview Auto-Print Issue

**Problem:** Print button immediately triggered browser's print dialog

**Solution (`src/components/reports/report-shell.tsx`):**
- Print preview now opens in popup window WITHOUT auto-calling `window.print()`
- Added "🖨️ Print This Report" button in the preview window
- User must manually click to print, allowing review first
- Improved print CSS with proper table formatting
- Removed Lucide icon dependencies in print (icons don't render in popup)

#### 4. Removed Duplicate Print Button (`src/app/admin/reports/z-read/z-read-client.tsx`)

**Problem:** "Print Official Ledger" button at bottom called `window.print()` directly

**Solution:**
- Removed duplicate print button from Z-Read client component
- Print functionality is now only in ReportShell toolbar
- Cleaned up unused Printer import

---

### Reports Module UI/UX Enhancement (Phase 3) - "Command Center" Redesign

Comprehensive refactor of the Reports module to transform it from a passive "Table of Contents" to an active "Command Center" with glanceable metrics and quick actions.

#### 1. Reports Gallery Page Redesign (`src/app/admin/reports/page.tsx`)

**Removed Fluff & Increased Density:**
- Removed the "Digital First, Paper Ready" banner (too much vertical space)
- Condensed descriptions to 1 line with tooltip on hover for full text
- Moved global settings to a Settings cog icon in header

**Glanceable Metrics (Hero Feature):**
- Cards now show live metrics BEFORE clicking:
  - **Z-Read Card:** Shows "Last Close: X hours ago"
  - **Inventory Velocity Card:** Shows "Dead Stock: X items" in red
  - **Spoilage Card:** Shows "This Month: ₱X loss" in red
  - **Expiry Tracker Card:** Shows "Critical: X expiring soon" in orange
- Metrics fetched via RSC with `<Suspense>` fallback skeletons

**Quick Actions on Cards:**
- Footer row with icon-only buttons: Open, Export
- Reduces clicks for power users (Export directly triggers download)

**Pinned Reports Section:**
- Added "Pinned" section at top for favorite reports
- Hardcoded Z-Read and Sales by Category as pinned (star icons)

#### 2. New Dashboard Summary Server Action (`src/actions/reports.ts`)

Added `getReportsDashboardSummary()` for lightweight metric fetching:
- `deadStockCount`: Products with 0 sales in 30 days
- `deadStockCapital`: Capital tied up in dead stock
- `spoilageLossThisMonth`: Total loss from DAMAGE/SUPPLIER_RETURN this month
- `lastZReadDate`: Most recent completed transaction timestamp
- `expiringCriticalCount`: Batches expiring within 7 days

Uses parallel queries via `Promise.all()` for fast loading.

#### 3. Reports Layout with Sidebar Navigation

**New Files:**
- `src/app/admin/reports/layout.tsx` - Server component wrapper
- `src/app/admin/reports/layout-client.tsx` - Client component with sidebar

**Sidebar Features:**
- Appears only on individual report pages (not on main gallery)
- Lists all reports grouped by category (Sales, Inventory, Audit)
- Active report highlighted with primary color
- "Back to All Reports" button at top
- "Reports Dashboard" button at bottom

#### 4. Fixed Double Scrollbar Issue (`src/app/admin/layout-client.tsx`)

**Problem:** Individual report pages had two scrollbars (main content + report shell)

**Solution:** 
- Detect individual report pages via pathname check
- Apply `overflow-hidden` to main element for report pages
- Let only ReportShell handle scrolling
- Removed extra padding from report pages (handled by ReportShell)

#### 5. Fixed Sticky Header Issue (`src/components/reports/report-shell.tsx`)

**Problem:** Sticky toolbar had gap below top nav

**Solution:**
- Removed outer padding from ReportShell
- Toolbar now spans full width, touches sidebar
- Height reduced to h-11 for compact look
- Content area has proper padding inside

#### 6. Print Preview Popup Window

**Problem:** Kiosk printing mode bypasses print dialog, no preview possible

**Solution:**
- New `openPrintPreview()` function opens a popup window
- Window contains formatted HTML with proper print styles
- Includes store header, report title, timestamp
- Triggers `window.print()` after content loads
- Users can preview, Save as PDF, or print

#### 7. Bug Fixes

- Fixed `InventoryBatch` queries to use `quantity` instead of non-existent `current_quantity`
- Updated `ExpiringItem` interface and expiring report client to match
- Fixed Excel export column mappings for expiring report

#### Files Modified:
- `src/app/admin/reports/page.tsx` - Complete rewrite as Command Center
- `src/app/admin/reports/layout.tsx` - NEW: Layout wrapper
- `src/app/admin/reports/layout-client.tsx` - NEW: Sidebar navigation
- `src/actions/reports.ts` - Added dashboard summary action, fixed expiring report
- `src/components/reports/report-shell.tsx` - Fixed sticky header, added print popup
- `src/app/admin/layout-client.tsx` - Fixed double scrollbar
- `src/app/admin/reports/expiring/expiring-client.tsx` - Fixed quantity field name

---

### Reports Module UI/UX Enhancement (Phase 2)

Critical fixes based on user feedback addressing layout, styling, and functionality issues:

#### Layout & Spacing Fixes
- **Fixed Content Area Padding:** Removed negative margins from ReportShell that caused content to touch sidebar/top nav
- **Proper Background Color:** Changed from pure white (`#FAFAF9`) to warm background (`#f5f3ef`) to maintain "Clean & Organic" aesthetic
- **Fixed Overflow Issues:** Eliminated extra scrollable space below content area
- **Z-Index Fix:** Top nav header now properly shows above content (z-30)

#### Table Column Alignment Fixes
- **SortableHeader Component:** Created new `SortableHeader` component for consistent column header alignment
- **Replaced Button Headers:** Replaced `Button variant="ghost"` with inline button elements that align properly with cell content
- **Fixed Width Columns:** Added explicit column widths (`size` property) to ensure header/cell alignment
- **Consistent Typography:** All headers now use uppercase `text-[11px]` tracking-wide styling

#### Excel Export Improvements
- **Better Formatting:**
  - Header row with dark background and white text
  - Alternating row colors for readability
  - Frozen header row for easier navigation
  - Borders on all data cells
- **Number Formatting:**
  - Currency columns use `#,##0.00` format with thousands separator
  - Percentage columns use `0.00%` format
  - Integer columns use `#,##0` format
- **Column Width:** Improved default widths with currency indicator in header (e.g., "Gross Sales (₱)")

#### Print Preview Simplification
- **Removed Modal Approach:** Removed confusing print preview modal that didn't work with kiosk printing
- **Direct Print:** Print button now triggers `window.print()` directly
- **Print Styles:** Clean print output with proper page breaks, hidden controls, and A4 formatting

#### Files Modified
- `src/app/admin/layout-client.tsx` - Fixed z-index and removed overflow-hidden
- `src/components/reports/report-shell.tsx` - Complete rewrite with proper layout and SortableHeader
- `src/app/admin/reports/z-read/z-read-client.tsx` - Fixed table alignment
- `src/app/admin/reports/velocity/velocity-client.tsx` - Fixed table alignment
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx` - Fixed table alignment
- `src/app/admin/reports/sales-category/sales-category-client.tsx` - Fixed table alignment
- `src/app/admin/reports/expiring/expiring-client.tsx` - Fixed table alignment

---

### Reports Module UI/UX Enhancement (Phase 1)

Comprehensive UI/UX improvements to the Reports module following design system guidelines and reference implementations from Analytics Dashboard and Inventory pages.

#### 1. Reports Gallery Page Redesign (`src/app/admin/reports/page.tsx`)
- **Toolbar-Style Header:** Replaced simple title with toolbar header featuring quick actions and metadata
- **Digital First, Paper Ready Banner:** Added prominent banner explaining the report philosophy
- **Enhanced Report Cards:** 
  - Cards now use design system colors (`bg-card`, `text-foreground`)
  - Improved hover effects with subtle shadow transitions
  - Category badges with proper design token colors
  - Consistent icon sizing and spacing
- **Grouped Report Categories:** Clear visual separation between Sales & Financial, Inventory Health, and Audit & Security reports

#### 2. ReportShell Component Enhancement (`src/components/reports/report-shell.tsx`)
- **Proper Content Padding:** Content area now has proper spacing from sidebar and top nav
- **Warm Background:** Uses `bg-[#f5f3ef]` for consistent "Clean & Organic" aesthetic
- **Sticky Toolbar:** Toolbar stays fixed while content scrolls  
- **SortableHeader Component:** Reusable component for consistent table header alignment
- **Clean Print Styles:** Proper print output without modals

#### 3. New Expiry Tracker Report (`src/app/admin/reports/expiring/`)
- **Server Action:** `getExpiringProductsReport()` in `src/actions/reports.ts`
  - Fetches products with upcoming expiry dates
  - Calculates days until expiry with status classification
  - Supports date range filtering
- **Client Component:** Full Tanstack Table implementation
  - Sortable columns: Product, Category, Expiry Date, Days Left, Stock, Status
  - Status badges: Expired (red), Critical (orange), Warning (yellow), OK (teal)
  - Date range picker for custom filtering
  - Summary cards showing total expiring items by urgency level

#### 4. Report Client Pages Polish (Design System Consistency)
All report client pages updated for consistency:
- `velocity-client.tsx` - Inventory Velocity Report
- `z-read-client.tsx` - Z-Read History Report
- `spoilage-client.tsx` - Spoilage & Wastage Report
- `profit-margin-client.tsx` - Profit Margin Analysis Report
- `sales-category-client.tsx` - Sales by Category Report

**Common Updates:**
- Badge styling updated to use design system colors
- Sorting indicators now use ChevronUp/ChevronDown icons
- Column headers have consistent hover states
- Table rows use `hover:bg-muted/30` for subtle feedback
- Numeric values use `tabular-nums font-mono` for alignment
- All hardcoded colors replaced with design tokens

#### Files Modified:
- `src/app/admin/reports/page.tsx` - Gallery redesign
- `src/components/reports/report-shell.tsx` - Shell enhancement
- `src/actions/reports.ts` - New expiry tracker action
- `src/app/admin/reports/expiring/page.tsx` - New report page
- `src/app/admin/reports/expiring/expiring-client.tsx` - New client component
- `src/app/admin/reports/velocity/velocity-client.tsx` - Polish
- `src/app/admin/reports/z-read/z-read-client.tsx` - Polish
- `src/app/admin/reports/spoilage/spoilage-client.tsx` - Polish
- `src/app/admin/reports/profit-margin/profit-margin-client.tsx` - Polish
- `src/app/admin/reports/sales-category/sales-category-client.tsx` - Polish

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
