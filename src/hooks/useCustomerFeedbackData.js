import { useEffect, useState } from "react";
import { feedbackService } from "../services/feedbackService";
import { normalizeFeedback, normalizeFeedbackList } from "../adapters/feedbackAdapter";

export function useCustomerFeedbackData() {
  const [feedbackList, setFeedbackList] = useState([]);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackActionError, setFeedbackActionError] = useState("");

  async function loadFeedback() {
    try {
      setIsFeedbackLoading(true);
      setFeedbackError("");
      setFeedbackList(normalizeFeedbackList(await feedbackService.getCustomerFeedback()));
    } catch (error) {
      console.error("Unable to load feedback:", error.message);
      setFeedbackError("Unable to load feedback from Supabase.");
    } finally {
      setIsFeedbackLoading(false);
    }
  }

  useEffect(() => { loadFeedback(); }, []);

  async function markFeedbackAsReviewed(feedbackId) {
    try {
      setFeedbackActionError("");
      const response = await feedbackService.markFeedbackAsReviewed(feedbackId);
      const updated = normalizeFeedback(response);
      setFeedbackList((items) => items.map((item) => item.id === feedbackId ? updated : item));
    } catch (error) {
      setFeedbackActionError("Unable to update feedback in Supabase.");
      throw error;
    }
  }

  return { feedbackList, isFeedbackLoading, feedbackError, feedbackActionError, markFeedbackAsReviewed };
}
