import { useState } from "react";

import { orderService } from "../services/orderService";
import { createManualOrderPayload } from "../adapters/manualOrderAdapter";
import { normalizeOrder } from "../adapters/orderAdapter";
import { getManualPosValidation } from "../utils/validationUtils";

export function useSubmitManualOrder() {
  const [isCreatingManualOrder, setIsCreatingManualOrder] = useState(false);
  const [manualOrderError, setManualOrderError] = useState("");

  async function submitManualOrder(posForm, cartItems) {
    try {
      setIsCreatingManualOrder(true);
      setManualOrderError("");

      const validation = getManualPosValidation(posForm, cartItems);
      if (!validation.isValid) {
        throw Object.assign(new Error(Object.values(validation.errors)[0]), {
          isValidationError: true,
        });
      }

      const orderPayload = createManualOrderPayload(posForm, cartItems);
      const createdOrder = await orderService.createManualOrder(orderPayload);

      return normalizeOrder(createdOrder);
    } catch (error) {
      console.error("Unable to create manual order:", error.message);

      setManualOrderError(
        error.isValidationError ? error.message : "Unable to create manual order right now. Please try again."
      );

      throw error;
    } finally {
      setIsCreatingManualOrder(false);
    }
  }

  return {
    submitManualOrder,
    isCreatingManualOrder,
    manualOrderError,
  };
}
