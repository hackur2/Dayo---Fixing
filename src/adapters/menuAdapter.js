function getValue(object, camelCaseKey, snakeCaseKey, fallbackValue = "") {
  return object[camelCaseKey] ?? object[snakeCaseKey] ?? fallbackValue;
}

function normalizeVariant(variant, index) {
  return {
    id: String(variant.id ?? variant.variantId ?? variant.variant_key ?? variant.sizeId ?? index),
    name: variant.name ?? variant.variantName ?? variant.sizeName ?? "Regular",
    price: Number(variant.price ?? 0),
  };
}

export function normalizeMenuItem(item) {
  const variants = Array.isArray(item.variants)
    ? item.variants.map(normalizeVariant)
    : [];

  const available = Number(
    item.available ?? item.stock ?? item.stockCount ?? item.stock_count ?? item.quantityAvailable ?? 0
  );

  const normalizedItem = {
    id: item.id,
    name: item.name ?? "Unnamed Item",
    description: item.description ?? "No description available.",
    mainCategory: getValue(item, "mainCategory", "main_category", "Uncategorized"),
    subCategory: getValue(item, "subCategory", "sub_category", "Uncategorized"),
    brand: item.brand ?? "DaYo",
    available,
    imageUrl: getValue(item, "imageUrl", "image_url", ""),
    isAvailable: item.isAvailable ?? item.is_available ?? available > 0,
    isFeatured: item.isFeatured ?? item.is_featured ?? false,
  };

  if (variants.length > 0) {
    normalizedItem.variants = variants;
  } else {
    normalizedItem.price = Number(item.price ?? 0);
  }

  return normalizedItem;
}

export function normalizeMenuItems(data) {
  const rawItems = Array.isArray(data)
    ? data
    : data?.items || data?.menuItems || data?.data || [];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map(normalizeMenuItem);
}
