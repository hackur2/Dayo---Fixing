import { useState } from "react";
import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import { useSubmitCustomerFeedback } from "../../hooks/useSubmitCustomerFeedback";
import { getFeedbackCommentError } from "../../utils/contentValidationUtils";

import "../../styles/customerFeedback.css";

const DEFAULT_FEEDBACK_FORM = {
  rating: 5,
  comment: "",
};

function CustomerFeedbackPage({ currentOrder }) {
  const [feedbackForm, setFeedbackForm] = useState(DEFAULT_FEEDBACK_FORM);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [commentError, setCommentError] = useState("");

  const {
    submitCustomerFeedback,
    isSubmittingFeedback,
    submitFeedbackError,
  } = useSubmitCustomerFeedback();

  function handleRatingChange(rating) {
    setFeedbackForm((currentForm) => ({
      ...currentForm,
      rating,
    }));
  }

  function handleCommentChange(event) {
    setFeedbackForm((currentForm) => ({
      ...currentForm,
      comment: event.target.value,
    }));
    setCommentError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const error = getFeedbackCommentError(feedbackForm.comment);
    if (error) {
      setCommentError(error);
      return;
    }
    setCommentError("");

    try {
      await submitCustomerFeedback(feedbackForm, currentOrder);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Feedback submission failed:", error.message);
    }
  }

  // Prevent submitting order-specific feedback before kitchen completion,
  // even if someone navigates directly to /customer/feedback.
  if (!currentOrder || String(currentOrder.status).trim().toLowerCase() !== "completed") {
    return (
      <main className="feedback-page">
        <section className="feedback-card feedback-success-card">
          <h1>Feedback isn't available yet</h1>
          <p>You can give feedback once your order status is Completed.</p>
          <Link to={CUSTOMER_ROUTES.ORDER_STATUS} className="feedback-main-button">
            View Order Status
          </Link>
        </section>
      </main>
    );
  }

  if (isSubmitted) {
    return (
      <main className="feedback-page">
        <section className="feedback-card feedback-success-card">
          <h1>Thank you!</h1>
          <p>Your feedback has been submitted successfully.</p>

          <Link to={CUSTOMER_ROUTES.MENU} className="feedback-main-button">
            Back to Menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="feedback-page">
      <section className="feedback-card">
        <div className="feedback-header">
          <p>Customer Feedback</p>
          <h1>How was your experience?</h1>
          <span>Your feedback helps Daddyow Siomai and Yo! CàPhê improve.</span>
        </div>

        {currentOrder ? (
          <div className="feedback-order-box">
            <span>ID Number</span>
            <strong>{currentOrder.orderNumber}</strong>
          </div>
        ) : (
          <div className="feedback-order-box">
            <span>No current order found</span>
            <strong>You can still submit feedback.</strong>
          </div>
        )}

        {submitFeedbackError && (
          <p className="form-error-message">{submitFeedbackError}</p>
        )}

        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="feedback-rating-section">
            <label>Rating</label>

            <div className="feedback-rating-buttons">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={
                    feedbackForm.rating === rating
                      ? "feedback-rating-button active"
                      : "feedback-rating-button"
                  }
                  onClick={() => handleRatingChange(rating)}
                  disabled={isSubmittingFeedback}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          <div className="feedback-form-group">
            <label htmlFor="comment">Comment</label>
            <textarea
              id="comment"
              value={feedbackForm.comment}
              onChange={handleCommentChange}
              placeholder="Tell us what you liked or what we can improve."
              maxLength={1000}
              rows="5"
              disabled={isSubmittingFeedback}
            />
            {commentError && <p className="form-error-message" role="alert">{commentError}</p>}
          </div>

          <div className="feedback-actions">
            <Link to={CUSTOMER_ROUTES.MENU} className="feedback-secondary-button">
              Back to Menu
            </Link>

            <button
              type="submit"
              className="feedback-main-button"
              disabled={isSubmittingFeedback}
            >
              {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CustomerFeedbackPage;
