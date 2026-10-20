const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = MODEL === "gemini-3.5-flash-lite"
  ? "gemini-3.8-flash"
  : "gemini-3.5-flash-lite";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestGemini(model, contents, systemText = "You are a friendly food menu assistant. Recommend only items in the supplied menu. Do not invent items or prices. Reply with JSON containing answer (string) and itemIds (up to 3 menu item IDs).") {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemText }],
        },
        contents,
        generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message || "Gemini could not answer. Please try again.");
    error.status = response.status;
    throw error;
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  return JSON.parse(text);
}

export async function askMenuAssistant({ prompt, history, menuItems, expiringIngredientContext = [] }) {
  if (!API_KEY) throw new Error("Add VITE_GEMINI_API_KEY to .env.local, then restart the app.");

  const availableItems = menuItems.filter(
    (item) => item.isAvailable && Number(item.available) > 0
  );
  const menu = availableItems.map((item) => {
    const expiryContext = expiringIngredientContext.find((entry) => String(entry.itemId) === String(item.id));
    return {
      id: String(item.id),
      name: item.name,
      category: `${item.mainCategory || ""} ${item.subCategory || ""}`.trim(),
      description: item.description,
      price: item.price ?? item.variants?.[0]?.price ?? null,
      expiringIngredients: expiryContext?.expiringIngredients || [],
    };
  });

  const contents = [
    ...history.map(({ role, text }) => ({ role, parts: [{ text }] })),
    { role: "user", parts: [{ text: `Available menu: ${JSON.stringify(menu)}\nCustomer request: ${prompt}\nRecommendation rules: First satisfy the customer's explicit food, category, price, and other preferences using matching available menu items. Among items that satisfy the request, prefer items that use ingredients expiring soon (within 14 days), with sooner expiry as a stronger signal. Expiry is a secondary preference and must never override an explicit customer request or lead you to suggest an unavailable item. If the request is specific and no expiry-matching option fits, recommend the best available match anyway. Do not mention internal inventory levels or expiry dates to the customer.` }] },
  ];

  const systemText = "You are Sumo AI, a friendly menu assistant. The customer's stated request and constraints come first. Use near-expiry ingredient context only as a secondary ranking signal among dishes that fit the request. Never invent menu items or prices, never recommend unavailable items, and never disclose internal stock or expiry details. Answer naturally and return JSON containing answer (string) and itemIds (up to 3 supplied available menu item IDs).";

  let suggestion;
  try {
    suggestion = await requestGemini(MODEL, contents, systemText);
  } catch (error) {
    const canRetry = [408, 429, 500, 502, 503, 504].includes(error.status);
    if (!canRetry) throw error;

    await wait(1000);
    try {
      suggestion = await requestGemini(MODEL, contents, systemText);
    } catch (retryError) {
      if (![408, 429, 500, 502, 503, 504].includes(retryError.status)) throw retryError;
      suggestion = await requestGemini(FALLBACK_MODEL, contents, systemText);
    }
  }

  const itemIds = new Set((suggestion.itemIds || []).map(String));
  return {
    answer: suggestion.answer || "Try asking about a menu category or a dish you like.",
    items: availableItems.filter((item) => itemIds.has(String(item.id))).slice(0, 3),
  };
}
