import { useState } from "react";

import { feedbackService } from "../services/feedbackService";
import { getFeedbackCommentError } from "../utils/contentValidationUtils";
import { getValidQrSession } from "../utils/qrSessionUtils";

export function useSubmitCustomerFeedback() {
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [submitFeedbackError, setSubmitFeedbackError] = useState("");

  async function submitCustomerFeedback(feedbackForm, currentOrder) {
    // Recheck at the submission boundary as well as in the UI.
    const validationError = getFeedbackCommentError(feedbackForm.comment);
    if (validationError) {
      setSubmitFeedbackError(validationError);
      throw new Error(validationError);
    }
    try {
      setIsSubmittingFeedback(true);
      setSubmitFeedbackError("");

      const qrSession = getValidQrSession();
      if (!qrSession) throw new Error("Your QR access session expired. Scan again.");
      const feedbackPayload = {
        qrToken: qrSession.qrToken,
        orderNumber: currentOrder?.orderNumber || null,
        rating: Number(feedbackForm.rating),
        comment: feedbackForm.comment.trim(),
      };

      return await feedbackService.submitCustomerFeedback(feedbackPayload);
    } catch (error) {
      console.error("Unable to submit customer feedback:", error.message);
      setSubmitFeedbackError(
        "Unable to submit your feedback right now. Please try again."
      );
      throw error;
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  return {
    submitCustomerFeedback,
    isSubmittingFeedback,
    submitFeedbackError,
  };
}
