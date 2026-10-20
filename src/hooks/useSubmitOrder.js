import { useState } from "react";

import { orderService } from "../services/orderService";
import { createOrderPayload, normalizeOrder } from "../adapters/orderAdapter";
import { getCheckoutValidation } from "../utils/validationUtils";
import { getValidQrSession } from "../utils/qrSessionUtils";

export function useSubmitOrder() {
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitOrderError, setSubmitOrderError] = useState("");

  async function submitOrder(checkoutForm, cartItems) {
    try {
      setIsSubmittingOrder(true);
      setSubmitOrderError("");

      const validation = getCheckoutValidation(checkoutForm, cartItems);
      if (!validation.isValid) {
        const message = Object.values(validation.errors)[0];
        throw Object.assign(new Error(message), { isValidationError: true });
      }

      const session = getValidQrSession();
      if (!session) throw new Error("Your QR access session expired. Scan the QR code again.");
      const orderPayload = { ...createOrderPayload(checkoutForm, cartItems), qrToken: session.qrToken };
      const createdOrder = await orderService.createOrder(orderPayload);

      const normalizedOrder = normalizeOrder(createdOrder);
      const cartSources = new Map(cartItems.map((item) => [
        `${item.id}-${item.selectedVariant?.id || "regular"}`,
        item.recommendationSource || null,
      ]));
      return {
        ...normalizedOrder,
        items: normalizedOrder.items.map((item) => ({
          ...item,
          recommendationSource: item.recommendationSource || cartSources.get(
            `${item.menuItemId}-${item.selectedVariantId || "regular"}`
          ),
        })),
      };
    } catch (error) {
      console.error("Unable to submit order:", error.message);
      setSubmitOrderError(
        error.isValidationError ? error.message : error.message || "Unable to submit your order right now. Please try again."
      );

      throw error;
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return {
    submitOrder,
    isSubmittingOrder,
    submitOrderError,
  };
}
