export const AI_LANGUAGE_WARNING = "Watch your language. Please avoid profanity or offensive words in English or Filipino.";

const WORDS = [
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers", "fuckyou", "fucku", "fuckoff", "motherfucker", "motherfuckers", "motherfucking",
  "fuk", "fck", "fuking", "fcking", "fvck", "fvcking", "fukyou", "fckyou", "fak", "fakyu",
  "shit", "shits", "shitty", "shitting", "bullshit", "horseshit", "dipshit", "shithead", "shitheads", "shitface",
  "bitch", "bitches", "bitchy", "bitching", "bitchass", "sonofabitch", "bastard", "bastards",
  "biatch", "biotch", "shet", "shuta",
  "ass", "asses", "asshole", "assholes", "arsehole", "dumbass", "jackass", "dick", "dicks", "dickhead", "cock", "cocksucker",
  "cunt", "cunts", "pussy", "pussies", "slut", "sluts", "whore", "whores", "wanker", "twat", "douchebag",
  "piss", "pissed", "pissing", "damn", "dammit", "hell", "stfu", "wtf", "idiot", "idiots", "stupid", "moron",
  "puta", "putangina", "putanginamo", "putanginamoka", "putanginang", "putanginamong", "putanginanyo", "putanginaninyo", "putragis",
  "pota", "potangina", "potanginamo", "potanginanyo", "potanginang", "pucha", "puchangina", "potek",
  "tangina", "tanginamo", "tanginang", "tngina", "tngnmo", "ptngina", "ptngnmo",
  "gago", "gaga", "gagong", "gagoka", "gagomo", "gaguhan", "kagaguhan", "ogag", "tanga", "tangang", "tangaka", "katangahan",
  "bobo", "bobong", "boboka", "kabobohan", "ulol", "ulul", "ulolka", "kupal", "kupalka", "tarantado", "tarantada", "katarantaduhan",
  "pakyu", "pakyow", "pakyuka", "punyeta", "punyemas", "bwisit", "buwisit", "bwiset", "bwesit", "buset", "lintik", "inutil",
  "leche", "letse", "letche", "lecheka", "hindot", "kantot", "kantutan", "kantutin", "titi", "tite", "puki", "burat", "betlog",
  "hayopka", "hayopkang", "hayopkayo",
];

const ALIASES = { "0": "o", "1": "il", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "il" };
const HOMOGLYPHS = { "а": "a", "е": "e", "і": "i", "о": "o", "р": "p", "с": "c", "ѕ": "s", "х": "x", "у": "y", "υ": "u", "ı": "i" };
const matchesLetter = (letter, expected) => letter === expected || Boolean(ALIASES[letter]?.includes(expected));

// Bounded dynamic programming handles repeats and censor masks without a
// backtracking regex. Whole candidates must match; substrings in menu words
// such as shiitake, shellfish, classic, puto, and boba remain valid.
function matchesWord(candidate, word) {
  if (candidate[0] !== "*" && !matchesLetter(candidate[0], word[0])) return false;
  const memo = new Map();
  function visit(i, j) {
    if (i === candidate.length) return j === word.length;
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    let result = false;
    if (candidate[i] === "*") {
      for (let end = j + 1; end <= word.length && !result; end++) result = visit(i + 1, end);
    } else {
      if (j < word.length && matchesLetter(candidate[i], word[j])) result = visit(i + 1, j + 1);
      if (!result && j > 0 && matchesLetter(candidate[i], word[j - 1])) result = visit(i + 1, j);
    }
    memo.set(key, result);
    return result;
  }
  return visit(0, 0);
}

function compact(value, maskDots = false) {
  const dotted = maskDots ? value.replace(/([a-z0-9])\.+(?=[a-z0-9])/g, "$1*") : value;
  return dotted.replace(/[*#•]+/g, "*")
    .replace(/[^a-z0-9@$!|*]/g, "")
    .replace(/([a-z0-9])\1{2,}/g, "$1$1");
}

function isOrdinaryPhrase(word, pieces) {
  const phrase = pieces.map((piece) => piece.replace(/^!+|!+$/g, "")).filter(Boolean).join(" ");
  return (word === "puta" && phrase === "put a")
    || (word === "tanga" && phrase === "tang a")
    || (word === "hell" && phrase === "he ll");
}

export function containsAiProfanity(value) {
  const text = String(value ?? "").normalize("NFKD").toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[аеіорсѕхуυı]/g, (letter) => HOMOGLYPHS[letter])
    // Exempt only these normal food names and contraction, never the whole
    // message: other bad words alongside a legitimate phrase still count.
    .replace(/\b(?:leche[\s-]+flan|cafe\s+con\s+leche|dulce\s+de\s+leche|he['’]ll)\b/g, " ");
  const cache = new Map();
  const findWords = (candidate) => {
    // Paired asterisks around a complete word can be normal chat emphasis.
    const token = candidate.startsWith("*") && candidate.endsWith("*") ? candidate.replace(/^\*+|\*+$/g, "") : candidate;
    if (!cache.has(token)) cache.set(token, /[a-z]/.test(token) ? WORDS.filter((word) => matchesWord(token, word)) : []);
    return cache.get(token);
  };
  for (const word of text.match(/[a-z0-9]+/g) ?? []) if (findWords(word).length) return true;
  const fragments = text.match(/[a-z0-9@$!|*#•._-]+/g) ?? [];
  for (const fragment of fragments) {
    for (const candidate of [compact(fragment), compact(fragment, true), compact(fragment).replace(/^!+|!+$/g, "")]) {
      if (findWords(candidate).length) return true;
    }
  }
  const pieces = text.split(/\s+/u).filter(Boolean).map((piece) => compact(piece));
  for (let start = 0; start < pieces.length; start++) {
    let joined = "";
    for (let end = start; end < Math.min(pieces.length, start + 18); end++) {
      joined += pieces[end];
      const matches = [...findWords(joined), ...findWords(joined.replace(/^!+|!+$/g, ""))];
      if (matches.some((word) => !isOrdinaryPhrase(word, pieces.slice(start, end + 1)))) return true;
    }
  }
  return false;
}
