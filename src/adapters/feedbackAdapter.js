export function normalizeFeedback(feedback) {
  return {
    id: feedback.id,
    orderNumber:
      feedback.orderNumber ?? feedback.order_number ?? "No Order Number",
    customerName:
      feedback.customerName ?? feedback.customer_name ?? "Customer",
    rating: Number(feedback.rating ?? 0),
    feedbackType:
      feedback.feedbackType ?? feedback.feedback_type ?? "Feedback",
    message: feedback.message ?? feedback.comment ?? "",
    status: feedback.status ?? "New",
    submittedDate:
      feedback.submittedDate ??
      feedback.submitted_date ??
      feedback.date ??
      "",
    submittedTime:
      feedback.submittedTime ??
      feedback.submitted_time ??
      feedback.time ??
      "",
  };
}

export function normalizeFeedbackList(data) {
  const rawFeedback = Array.isArray(data)
    ? data
    : data?.feedback ?? data?.items ?? data?.data ?? [];

  if (!Array.isArray(rawFeedback)) {
    return [];
  }

  return rawFeedback.map(normalizeFeedback);
}