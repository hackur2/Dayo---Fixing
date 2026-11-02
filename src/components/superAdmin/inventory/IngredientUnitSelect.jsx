import { INGREDIENT_UNIT_OPTIONS } from "../../../constants/inventory";

export default function IngredientUnitSelect({ value, onChange }) {
  return <label>
    Unit of Measure
    <select name="unit" aria-label="Unit of Measure" value={value} onChange={onChange} required>
      <option value="" disabled hidden>Select unit</option>
      {INGREDIENT_UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
    </select>
  </label>;
}
