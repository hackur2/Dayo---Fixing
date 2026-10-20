import {
  getCustomerNameError,
  getNotesError,
  getGcashReferenceError,
  getFeedbackCommentError,
} from "./contentValidationUtils";

export function getCheckoutValidation(checkoutForm, cartItems) {
  const errors = {};
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    errors.cart = "Please add at least one item before checkout.";
  }
  const nameError = getCustomerNameError(checkoutForm.customerName);
  if (nameError) errors.customerName = nameError;
  if (!String(checkoutForm.orderType ?? "").trim()) {
    errors.orderType = "Order type is required.";
  }
  const referenceError = getGcashReferenceError(
    checkoutForm.paymentReferenceNumber,
    checkoutForm.paymentMethod === "GCash"
  );
  if (referenceError) errors.paymentReferenceNumber = referenceError;
  const notesError = getNotesError(checkoutForm.notes);
  if (notesError) errors.notes = notesError;
  return { errors, isValid: Object.keys(errors).length === 0 };
}

export function getManualPosValidation(posForm, cartItems) {
  const errors = {};
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    errors.cart = "Please add at least one item to the order.";
  }
  // POS allows a blank name, which is saved as "Walk-in Customer".
  const nameError = getCustomerNameError(posForm.customerName, { required: false });
  if (nameError) errors.customerName = nameError;
  const notesError = getNotesError(posForm.notes);
  if (notesError) errors.notes = notesError;
  const referenceError = getGcashReferenceError(
    posForm.paymentReferenceNumber,
    posForm.paymentMethod === "GCash"
  );
  if (referenceError) errors.paymentReferenceNumber = referenceError;
  return { errors, isValid: Object.keys(errors).length === 0 };
}

export function getFeedbackValidation(feedbackForm, hasCurrentOrder) {
  const errors = {};
  if (!hasCurrentOrder) {
    const nameError = getCustomerNameError(feedbackForm.customerName);
    if (nameError) errors.customerName = nameError;
  }
  if (!Number.isInteger(Number(feedbackForm.rating)) ||
      Number(feedbackForm.rating) < 1 || Number(feedbackForm.rating) > 5) {
    errors.rating = "Please select a rating from 1 to 5.";
  }
  const commentError = getFeedbackCommentError(feedbackForm.comment);
  if (commentError) errors.comment = commentError;
  return { errors, isValid: Object.keys(errors).length === 0 };
}
