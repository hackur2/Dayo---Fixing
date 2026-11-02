import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", define: { "import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify("test-only-key") } });
const { askMenuAssistant } = await vite.ssrLoadModule("/src/services/aiAssistantService.js");
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Try our rice meal.", itemIds: ["1", "2"] }) }] } }] }), { headers: { "Content-Type": "application/json" } });
};
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const input = { history: [], menuItems: [{ id: 1, name: "Rice meal", isAvailable: true, available: 5, price: 50 }, { id: 2, name: "Unavailable", isAvailable: false, available: 0, price: 10 }] };

test("rejected prompts cannot reach Gemini even when the UI validation is bypassed", async () => {
  for (const prompt of ["f**k", "g4g0", "putang ina", "p u t a", " ", "x".repeat(301)]) await assert.rejects(askMenuAssistant({ ...input, prompt }));
  assert.equal(calls.length, 0);
});

test("valid food requests still return available recommendations and retain expiry preference rules", async () => {
  const result = await askMenuAssistant({ ...input, prompt: "Leche flan or boba tea under ₱100", expiringIngredientContext: [{ itemId: 1, expiringIngredients: [{ name: "Milk", daysUntilExpiry: 2 }] }] });
  assert.equal(calls.length, 1);
  assert.equal(result.answer, "Try our rice meal.");
  assert.deepEqual(result.items.map((item) => item.id), [1]);
  const text = calls[0].body.contents.at(-1).parts[0].text;
  assert.match(text, /Leche flan or boba tea/);
  assert.match(text, /Milk/);
  assert.match(text, /Expiry is a secondary preference/);
  assert.equal(text.includes('"name":"Unavailable"'), false);
});
