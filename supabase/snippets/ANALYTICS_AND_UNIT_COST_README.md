# Analytics and inventory pricing

Run the **entire** `ingredient_unit_cost_setup.sql` file in Supabase SQL Editor on the primary database and the cloud mirror (if used), then refresh the app. This adds an optional `unit_cost` field and preserves stock and expiry behavior. The setup can be run again without resetting entered costs.

Enter the purchase cost of **one inventory unit** in Add Ingredient or Edit Ingredient. For example, use ₱100 for one kg when the stock unit is kg, or ₱0.02 for one ml when stock is recorded in ml. Inventory Total Price is the sum of current stock × unit cost across active ingredients. A missing cost remains unknown; the card identifies partial totals and the number of stocked ingredients still needing a cost. Zero-stock ingredients contribute zero value.

Revenue Breakdown has Category, Menu Items and Ingredients grouping, with a dropdown for selecting individual entries in each group. Percentages and the pie chart use only the selected entries. The Ingredients view is an **estimate**: it allocates a menu item's recorded revenue in proportion to each recipe ingredient's quantity × current unit cost. It includes combo component quantities. Missing recipes, missing costs, and deleted menu references leave the full affected revenue Unallocated. It does not represent direct ingredient sales or historical profit.

The Sales Graph page keeps only Daily Sales Trend and Revenue Breakdown. Hour combines sales by hour of day across the selected dates in Philippine time; Day uses calendar dates, Week starts Monday, and Month uses calendar months. Summary cards follow the Daily Sales Trend range, while Revenue Breakdown retains its own date filter. Daily averages include zero-sales days between the range endpoints.

Top-card percentages use these formulas:

| Card | Percentage |
| --- | --- |
| Dashboard revenue | Today's completed revenue ÷ all completed revenue |
| Dashboard orders | Completed orders ÷ all orders |
| Dashboard low stock | Low-stock ingredient count ÷ active ingredient count |
| Sales total sales | Selected-period completed sales ÷ all-time completed sales |
| Sales total orders | Selected-period completed orders ÷ all-time completed orders |
| Sales daily average | Average daily sales ÷ highest daily sales in the selected period |
| Sales highest day | Highest daily sales ÷ total selected-period sales |

All ratios are multiplied by 100. An unavailable denominator shows a dash. Each card labels what its percentage represents.

Ingredients, Menu Items, Shelf Life, and both Order Summary views show 15 rows per page. Filtering and sorting happen before pagination. Filter or sort changes return to page 1; deletions clamp the page to the remaining results. Inventory selection and Select All apply to the visible page, and changing pages clears the selection.
