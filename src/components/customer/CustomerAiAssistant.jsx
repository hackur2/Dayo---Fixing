import { useEffect, useId, useRef, useState } from "react";

import { getAiPromptError } from "../../utils/contentValidationUtils";
import { getItemDisplayPrice, getItemQuantity } from "../../utils/cartUtils";
import { askMenuAssistant } from "../../services/aiAssistantService";

import "../../styles/aiSuggestionChat.css";

const STARTER_MESSAGE = {
  role: "ai",
  text: "Hi! I can help you find something from the menu. Suggestions use current item availability.",
};
function CustomerAiAssistant({ menuItems = [], expiringIngredientContext = [], cartItems = [], onAddToCart, itemDetailsOpen = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([STARTER_MESSAGE]);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [buttonPosition, setButtonPosition] = useState(null);
  const [showSuggestionBubble, setShowSuggestionBubble] = useState(true);
  const [addedRecommendations, setAddedRecommendations] = useState([]);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setShowSuggestionBubble(false);
      return undefined;
    }

    setShowSuggestionBubble(true);
    const bubbleTimer = window.setInterval(() => {
      setShowSuggestionBubble((current) => !current);
    }, 3000);

    return () => window.clearInterval(bubbleTimer);
  }, [isOpen]);

  useEffect(() => {
    function repositionButton() {
      if (!itemDetailsOpen) {
        setButtonPosition(null);
        return;
      }

      const button = buttonRef.current;
      if (!button) return;

      const width = button.offsetWidth || 72;
      const height = button.offsetHeight || 72;
      const margin = 16;
      const itemCard = document.querySelector(".item-details-modal");
      const cardRect = itemCard?.getBoundingClientRect();
      if (!cardRect?.width || !cardRect?.height) return;

      const left = Math.max(margin, Math.min(cardRect.right - width - 4, window.innerWidth - width - margin));
      const top = Math.max(margin, Math.min(cardRect.top - height - 4, window.innerHeight - height - margin));
      setButtonPosition((current) => current?.left === left && current?.top === top ? current : { left, top });
    }

    repositionButton();
    window.addEventListener("resize", repositionButton);
    window.addEventListener("scroll", repositionButton, true);

    return () => {
      window.removeEventListener("resize", repositionButton);
      window.removeEventListener("scroll", repositionButton, true);
    };
  }, [itemDetailsOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  async function handleSend(value = prompt) {
    if (isSending) return;
    const validationError = getAiPromptError(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    const userPrompt = value.trim();
    const history = messages.slice(1)
      .filter((message) => message.role === "user" || message.role === "ai")
      .map((message) => ({ role: message.role === "ai" ? "model" : "user", text: message.text }));
    setMessages((current) => [...current, { role: "user", text: userPrompt }]);
    setPrompt("");
    setError("");
    setIsSending(true);

    try {
      const recommendation = await askMenuAssistant({
        prompt: userPrompt,
        history,
        menuItems,
        expiringIngredientContext,
      });
      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text: recommendation.answer,
          items: recommendation.items,
        },
      ]);
    } catch (requestError) {
      console.error("Menu assistant request failed:", requestError);
      setError(requestError.message || "The menu assistant could not connect to Gemini. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ai-suggestion-button"
        style={buttonPosition ? { left: buttonPosition.left, top: buttonPosition.top, right: "auto", bottom: "auto" } : undefined}
        onClick={() => setIsOpen(true)}
        aria-label="Open AI menu assistant"
        title="Open AI menu assistant"
      >
        <img src="/images/ai/ai-logo.gif" alt="" />
      </button>

      {showSuggestionBubble && !isOpen && !itemDetailsOpen && (
        <span
          className="ai-suggestion-bubble"
          style={buttonPosition
            ? {
                left: buttonPosition.left > window.innerWidth / 2
                  ? Math.max(8, buttonPosition.left - 190)
                  : Math.min(window.innerWidth - 198, buttonPosition.left + (buttonRef.current?.offsetWidth || 72) + 12),
                top: buttonPosition.top + ((buttonRef.current?.offsetHeight || 72) - 40) / 2,
                right: "auto",
                bottom: "auto",
              }
            : undefined}
          data-side={buttonPosition && buttonPosition.left <= window.innerWidth / 2 ? "right" : "left"}
          aria-hidden="true"
        >
          Need Suggestion? Try me!
        </span>
      )}

      {isOpen && (
        <div className="ai-chat-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <section
            className="ai-chat-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="ai-chat-header">
              <div className="ai-chat-title">
                <img src="/images/ai/ai-logo.gif" alt="" />
                <div>
                  <h2 id="ai-assistant-title">Sumo AI</h2>
                  <p>Suggestions use current menu availability</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close AI assistant">×</button>
            </header>

            <div className="ai-chat-body" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`ai-chat-message ${message.role}`} key={`${index}-${message.role}`}>
                  <p>{message.text}</p>
                  {message.items?.map((item) => (
                    <RecommendationCard
                      key={`${index}-${item.id}`}
                      item={item}
                      cartItems={cartItems}
                      onAddToCart={onAddToCart}
                      isAdded={addedRecommendations.includes(`${index}-${item.id}`)}
                      onAdded={() => setAddedRecommendations((current) => [...current, `${index}-${item.id}`])}
                    />
                  ))}
                </div>
              ))}
              {isSending && <div className="ai-chat-message ai"><p>Thinking of something tasty…</p></div>}
            </div>

            <div className="ai-chat-prompts" aria-label="Suggested questions">
              {["Suggest a meal", "Show noodles", "Drinks under ₱100"].map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => handleSend(suggestion)} disabled={isSending}>
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              className="ai-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSend();
              }}
            >
              <input
                disabled={isSending}
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setError("");
                }}
                placeholder="What are you in the mood for?"
                aria-label="Ask the menu assistant"
                maxLength={300}
              />
              <button type="submit" disabled={isSending}>{isSending ? "Thinking…" : "Send"}</button>
            </form>
            {error && <p className="ai-chat-error" role="alert">{error}</p>}
          </section>
        </div>
      )}
    </>
  );
}

function RecommendationCard({ item, cartItems, onAddToCart, isAdded, onAdded }) {
  const variants = item.variants || [];
  const variantSelectId = useId();
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || "");
  const variant = variants.find((candidate) => candidate.id === selectedVariantId) || variants[0] || null;
  const variantId = variant?.id || null;
  const quantityInCart = getItemQuantity(cartItems, item.id, variantId);
  const isAtStockLimit = quantityInCart >= Number(item.available);

  function handleAdd() {
    if (!onAddToCart || isAtStockLimit) return;
    onAddToCart({ ...item, recommendationSource: "Sumo AI" }, variant, 1);
    onAdded();
  }

  return (
    <div className={`ai-chat-recommendation${variants.length ? " has-variants" : ""}`}>
      <div className="ai-chat-recommendation-info">
        <strong>{item.name}</strong>
        {variants.length > 0 ? (
          <>
            <label className="ai-chat-variant-label" htmlFor={variantSelectId}>Choose variant</label>
            <select
              id={variantSelectId}
              className="ai-chat-variant-select"
              value={variant?.id || ""}
              onChange={(event) => setSelectedVariantId(event.target.value)}
              aria-label={`Choose a variant for ${item.name}`}
            >
              {variants.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · ₱{Number(option.price).toFixed(2)}
                </option>
              ))}
            </select>
          </>
        ) : <span>{getItemDisplayPrice(item)}</span>}
      </div>
      <button type="button" onClick={handleAdd} disabled={!onAddToCart || isAtStockLimit}>
        {isAdded ? "Added" : isAtStockLimit ? "Max in cart" : "Add to cart"}
      </button>
    </div>
  );
}

export default CustomerAiAssistant;
