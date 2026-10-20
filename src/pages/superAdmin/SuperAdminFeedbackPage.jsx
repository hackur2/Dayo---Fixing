
import { useMemo, useState } from "react";

import { useCustomerFeedbackData } from "../../hooks/useCustomerFeedbackData";

import "../../styles/superAdminFeedback.css";

const RATING_OPTIONS = ["All", "5", "4", "3", "2", "1"];
const STATUS_OPTIONS = ["All", "New", "Reviewed"];

function getBadgeClassName(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}

function getRatingStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function SuperAdminFeedbackPage() {
  const {
    feedbackList,
    isFeedbackLoading,
    feedbackError,
    feedbackActionError,
    markFeedbackAsReviewed,
  } = useCustomerFeedbackData();

  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const feedbackSummary = useMemo(() => {
    const totalFeedback = feedbackList.length;

    const averageRating =
      totalFeedback > 0
        ? feedbackList.reduce((total, feedback) => total + feedback.rating, 0) /
          totalFeedback
        : 0;

    const newFeedback = feedbackList.filter(
      (feedback) => feedback.status === "New"
    ).length;

    const lowRatings = feedbackList.filter(
      (feedback) => feedback.rating <= 2
    ).length;

    return {
      totalFeedback,
      averageRating,
      newFeedback,
      lowRatings,
    };
  }, [feedbackList]);

  const filteredFeedback = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return feedbackList.filter((feedback) => {
      const matchesSearch =
        searchValue === "" ||
        feedback.orderNumber.toLowerCase().includes(searchValue) ||
        feedback.customerName.toLowerCase().includes(searchValue) ||
        feedback.message.toLowerCase().includes(searchValue);

      const matchesRating =
        ratingFilter === "All" || feedback.rating === Number(ratingFilter);

      const matchesStatus =
        statusFilter === "All" || feedback.status === statusFilter;

      return matchesSearch && matchesRating && matchesStatus;
    });
  }, [feedbackList, searchTerm, ratingFilter, statusFilter]);

  async function handleMarkAsReviewed(feedbackId) {
    try {
      await markFeedbackAsReviewed(feedbackId);

      setSelectedFeedback((currentFeedback) =>
        currentFeedback?.id === feedbackId
          ? {
              ...currentFeedback,
              status: "Reviewed",
            }
          : currentFeedback
      );
    } catch (error) {
      console.error("Unable to mark feedback as reviewed:", error.message);
    }
  }

  if (isFeedbackLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow"></p>
            <h1>Customer Feedback</h1>
            <p>Loading feedback records...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"></p>
          <h1>Customer Feedback</h1>
          <p></p>
        </div>
      </div>

      {feedbackError && (
        <section className="feedback-message warning">{feedbackError}</section>
      )}

      {feedbackActionError && (
        <section className="feedback-message danger">
          {feedbackActionError}
        </section>
      )}

      <section className="feedback-summary-grid">
        <article className="feedback-summary-card featured">
          <span>Average Rating</span>
          <strong>{feedbackSummary.averageRating.toFixed(1)}</strong>
          <p>{getRatingStars(Math.round(feedbackSummary.averageRating))}</p>
        </article>

        <article className="feedback-summary-card">
          <span>Total Feedback</span>
          <strong>{feedbackSummary.totalFeedback}</strong>
          <p></p>
        </article>

        <article className="feedback-summary-card warning">
          <span>New Feedback</span>
          <strong>{feedbackSummary.newFeedback}</strong>
          <p></p>
        </article>

        <article className="feedback-summary-card danger">
          <span>Low Ratings</span>
          <strong>{feedbackSummary.lowRatings}</strong>
          <p></p>
        </article>
      </section>

      <section className="feedback-toolbar">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search order number, customer, or message"
          aria-label="Search feedback"
        />

        <select
          value={ratingFilter}
          onChange={(event) => setRatingFilter(event.target.value)}
          aria-label="Filter by rating"
        >
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating === "All" ? "All Ratings" : `${rating} Star`}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by feedback status"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </section>

      <section className="feedback-table-card">
        <div className="feedback-table-header">
          <div>
            <h2>Feedback Records</h2>
            <p>{filteredFeedback.length} result(s)</p>
          </div>
        </div>

        {filteredFeedback.length > 0 ? (
          <table className="feedback-table">
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Date & Time</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredFeedback.map((feedback) => (
                <tr key={feedback.id}>
                  <td>
                    <strong>{feedback.orderNumber}</strong>
                  </td>

                  <td>{feedback.customerName}</td>

                  <td>
                    <span className="feedback-rating">
                      {getRatingStars(feedback.rating)}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`feedback-status-badge ${getBadgeClassName(
                        feedback.status
                      )}`}
                    >
                      {feedback.status}
                    </span>
                  </td>

                  <td>
                    {feedback.submittedDate}
                    <br />
                    <span>{feedback.submittedTime}</span>
                  </td>

                  <td className="feedback-message-cell">
                    {feedback.message}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button feedback-small-button"
                      onClick={() => setSelectedFeedback(feedback)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <section className="admin-empty-state">
            <h2>No feedback found</h2>
            <p>Try changing the search keyword or filters.</p>
          </section>
        )}
      </section>

      {selectedFeedback && (
        <div className="feedback-modal-backdrop">
          <section className="feedback-modal">
            <div className="feedback-modal-header">
              <div>
                <p className="admin-eyebrow">Feedback Details</p>
                <h2>{selectedFeedback.orderNumber}</h2>
              </div>

              <button type="button" onClick={() => setSelectedFeedback(null)}>
                ×
              </button>
            </div>

            <div className="feedback-details-grid">
              <article>
                <span>Customer</span>
                <strong>{selectedFeedback.customerName}</strong>
              </article>

              <article>
                <span>Rating</span>
                <strong>{getRatingStars(selectedFeedback.rating)}</strong>
              </article>

              <article>
                <span>Status</span>
                <strong>{selectedFeedback.status}</strong>
              </article>

              <article>
                <span>Date & Time</span>
                <strong>
                  {selectedFeedback.submittedDate} —{" "}
                  {selectedFeedback.submittedTime}
                </strong>
              </article>

              <article className="feedback-message-detail">
                <span>Message</span>
                <strong>{selectedFeedback.message}</strong>
              </article>
            </div>

            {selectedFeedback.status === "New" && (
              <div className="feedback-modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleMarkAsReviewed(selectedFeedback.id)}
                >
                  Mark as Reviewed
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default SuperAdminFeedbackPage;