export function createManualOrderPayload(posForm, cartItems) {
  return {
    customerName: posForm.customerName.trim() || "Walk-in Customer",
    orderType: posForm.orderType,
    paymentMethod: posForm.paymentMethod,
    paymentReferenceNumber:
      posForm.paymentMethod === "GCash"
        ? posForm.paymentReferenceNumber.trim()
        : null,
    notes: posForm.notes.trim(),
    items: cartItems.map((item) => ({
      menuItemId: item.id,
      selectedVariantId: item.selectedVariant?.id || null,
      variantLabel: item.variantLabel || null,
      price: Number(item.price),
      quantity: Number(item.quantity),
    })),
  };
}
