export function getStockStatus(item) {
  if (item.currentStock <= 0) {
    return "Out of Stock";
  }

  if (item.currentStock <= item.reorderLevel) {
    return "Low Stock";
  }

  return "In Stock";
}

export function getMenuItemAvailability(menuItem, ingredients) {
  const requirements = menuItem.ingredientRequirements || [];

  if (requirements.length === 0) {
    return "Unavailable";
  }

  const hasAllIngredients = requirements.every((requirement) => {
    const ingredient = ingredients.find(
      (item) => item.id === Number(requirement.ingredientId)
    );

    if (!ingredient) {
      return false;
    }

    return ingredient.currentStock >= Number(requirement.quantity);
  });

  return hasAllIngredients ? "Available" : "Unavailable";
}

export function getInventoryTimestamp() {
  return new Date().toISOString();
}

export function formatInventoryDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${dateParts.year}/${dateParts.month}/${dateParts.day}`;
}

export function getStatusClassName(value) {
  return String(value || "").toLowerCase().replaceAll(" ", "-");
}

export function getTodayDateInputValue() {
  return formatDateForInput(new Date());
}

export function parseRelativeExpirationInput(value, baseDate = new Date()) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return "";
  }

  const match = normalizedValue.match(
    /^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/
  );

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const resultDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );

  if (unit.startsWith("day")) {
    resultDate.setDate(resultDate.getDate() + amount);
  } else if (unit.startsWith("week")) {
    resultDate.setDate(resultDate.getDate() + amount * 7);
  } else if (unit.startsWith("month")) {
    addMonthsSafely(resultDate, amount);
  } else if (unit.startsWith("year")) {
    addMonthsSafely(resultDate, amount * 12);
  }

  return formatDateForInput(resultDate);
}

export function formatExpirationDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = parseDateInputValue(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseDateInputValue(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addMonthsSafely(date, monthAmount) {
  const originalDay = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + monthAmount);

  const lastDayOfTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();

  date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
}
