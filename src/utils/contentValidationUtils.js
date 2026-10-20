/** Shared, lightweight UI validation. Not a substitute for backend moderation. */
const BLOCKED_WORDS = new Set([
  "fuck", "fucking", "fucked", "fucker", "motherfucker",
  "shit", "bullshit", "bitch", "asshole",
  "gago", "tangina", "putangina", "puta",
  "pakyu", "tarantado", "ulol", "kupal", "tanga", "bobo",
]);

export function containsInappropriateLanguage(value) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];

  return (
    words.some((word) => BLOCKED_WORDS.has(word)) ||
    /(?:^|[^\p{L}\p{N}])putang\s+ina(?=$|[^\p{L}\p{N}])/u.test(text)
  );
}

/** Names can include accents, spaces, initials, apostrophes, and hyphens. */
export function getCustomerNameError(value, { required = true } = {}) {
  const name = String(value ?? "").trim();
  if (!name) return required ? "Please enter the customer name." : "";
  if (name.length < 2 || name.length > 80) {
    return "Customer name must be 2–80 characters long.";
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u.test(name)) {
    return "Use letters, spaces, apostrophes, periods, or hyphens for the name.";
  }
  if (containsInappropriateLanguage(name)) {
    return "Please enter an appropriate customer name.";
  }
  return "";
}

export function getNotesError(value) {
  const notes = String(value ?? "").trim();
  if (notes.length > 500) return "Notes must be 500 characters or fewer.";
  if (containsInappropriateLanguage(notes)) {
    return "Please remove inappropriate language from the notes.";
  }
  return "";
}

export function getGcashReferenceError(value, isGcash) {
  if (!isGcash) return "";
  const reference = String(value ?? "");
  if (!reference) return "GCash reference number is required.";
  if (!/^[0-9]+$/.test(reference)) {
    return "GCash reference number must contain digits only (0–9).";
  }
  if (reference.length > 32) return "GCash reference number is too long.";
  return "";
}

export function getAiPromptError(value) {
  const message = String(value ?? "").trim();
  if (!message) return "Please enter a food or drink preference.";
  if (message.length > 300) return "Please keep your request under 300 characters.";
  if (containsInappropriateLanguage(message)) {
    return "Please use appropriate language when requesting suggestions.";
  }
  return "";
}

export function getFeedbackCommentError(value) {
  const comment = String(value ?? "").trim();
  // Feedback comments are optional in the current DaYo interface.
  if (comment.length > 1000) return "Feedback must be 1,000 characters or fewer.";
  if (containsInappropriateLanguage(comment)) {
    return "Please use appropriate language in your feedback.";
  }
  return "";
}
