import { calculateIngredientReorderPoint } from "../../../utils/ingredientReorderUtils";

const formatQuantity = (value, digits = 6) => value.toLocaleString("en-PH", { maximumFractionDigits: digits });

export default function IngredientReorderFields({ quantitySold30Days = 0, unit = "units" }) {
  const values = calculateIngredientReorderPoint(quantitySold30Days);
  return <section className="ingredient-reorder-fields" aria-label="Automatic reorder point">
    <div className="ingredient-reorder-heading"><strong>Automatic Reorder Point</strong><span>Lead time: 1 day · Buffer: 1 day</span></div>
    <div className="ingredient-reorder-values">
      <label>Average Daily Sales (ADS)<input type="text" value={`${formatQuantity(values.averageDailySales)} ${unit}/day`} readOnly /></label>
      <label>Safety Stock<input type="text" value={`${formatQuantity(values.safetyStock)} ${unit}`} readOnly /></label>
      <label>Reorder Point (ROP)<input type="text" value={`${formatQuantity(values.reorderLevel, 3)} ${unit}`} readOnly /></label>
    </div>
  </section>;
}
