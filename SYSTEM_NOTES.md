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


