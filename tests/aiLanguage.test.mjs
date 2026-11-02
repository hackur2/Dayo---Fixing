import assert from "node:assert/strict";
import test from "node:test";
import { AI_LANGUAGE_WARNING, containsAiProfanity } from "../src/utils/aiLanguageUtils.js";
import { getAiPromptError, getCustomerNameError, getNotesError } from "../src/utils/contentValidationUtils.js";

test("English and Filipino profanity, insults, and common attached forms are rejected", () => {
  for (const text of ["fuck", "This is SHIT!", "you idiot", "motherfucker", "bullshit", "asshole", "putang ina mo", "tanginamo", "gagong", "bobo ka", "punyeta", "pakyu", "tarantado", "kupal", "bwisit", "leche!", "hayop ka", "fuk", "fcking", "fvck", "potangina", "p0ta", "biatch", "shet"]) {
    assert.equal(containsAiProfanity(text), true, text);
    assert.equal(getAiPromptError(text), AI_LANGUAGE_WARNING, text);
  }
});

test("common numeric, symbol, mask, punctuation and spaced-letter evasions are caught", () => {
  for (const text of ["f.u.c.k", "f-u-c-k", "f u c k!", "fu ck", "f**k", "f***", "f..k", "sh1t", "$hit!", "b!tch,please", "a$$hole", "g4g0", "b0b0", "p.u.t.a", "p u t a", "pu ta", "put@ng1n4", "put@ng 1n4 m0", "t4ng1n4", "kupa1", "fuuuuuuuuuck", "ＧＡＧＯ", "pútangína", "f\u200buck", "fυck"]) {
    assert.equal(containsAiProfanity(text), true, text);
  }
});

test("normal English/Filipino requests, food names, prices and word substrings stay valid", () => {
  for (const text of [
    "Suggest a meal", "Show noodles", "Drinks under ₱100", "Budget 455", "4$$", "Puto and puto bumbong", "Boba tea",
    "Leche flan", "café con leche", "dulce de leche", "Classic chicken breast with shiitake mushrooms", "Shellfish and passion fruit",
    "Please put a burger in my cart", "Give Tang a try", "He'll order a meal", "he’ll get rice", "As... a vegetarian, what can I eat?",
    "Gusto ko ng kanin at gulay", "May kangkong ba?", "I **am** hungry", "I want *healthy* food", "Puttanesca pasta", "Anong putahe ang marerekomenda mo?", "Baked potato",
  ]) {
    assert.equal(containsAiProfanity(text), false, text);
    assert.equal(getAiPromptError(text), "", text);
  }
  assert.equal(containsAiProfanity("leche flan, gago"), true);
});

test("editing out the bad word clears the warning and empty/length checks are preserved", () => {
  assert.equal(getAiPromptError("shit burger"), AI_LANGUAGE_WARNING);
  assert.equal(getAiPromptError("chicken burger"), "");
  assert.match(getAiPromptError(" "), /enter a food/);
  assert.match(getAiPromptError("x".repeat(301)), /300 characters/);
  assert.equal(containsAiProfanity(null), false);
  // Other forms continue to use their existing shared validation behavior.
  assert.equal(getCustomerNameError("Juan Dela Cruz"), "");
  assert.equal(getNotesError("No onions, please."), "");
});
