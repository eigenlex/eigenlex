import type { LanguageProfile } from "../types";

// Function words: structurally everywhere, definitionally inert. Dropped by
// default so the graph reflects content links, not grammar.
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from",
  "as", "and", "or", "but", "nor", "so", "if", "than", "then", "that", "this",
  "these", "those", "it", "its", "is", "are", "was", "were", "be", "been",
  "being", "am", "have", "has", "had", "do", "does", "did", "not", "no", "any",
  "some", "such", "which", "who", "whom", "whose", "what", "when", "where",
  "why", "how", "all", "each", "one", "his", "her", "their", "he", "she",
  "they", "we", "you", "i", "him", "them", "us", "my", "your", "our", "into",
  "out", "up", "down", "over", "under", "about", "through", "between", "also",
  "more", "most", "other", "same", "very", "can", "will", "would", "should",
  "may", "might", "must", "there", "here",
]);

// A word: a letter, then letters / marks / internal apostrophes or hyphens.
const WORD = /\p{L}[\p{L}\p{M}'’-]*/gu;
const COMBINING = /\p{M}+/gu;
const EDGE_PUNCT = /^['’-]+|['’-]+$/gu;

export const english: LanguageProfile = {
  id: "en",
  tokenize(text) {
    return text.match(WORD) ?? [];
  },
  normalize(token) {
    return token
      .normalize("NFD")
      .replace(COMBINING, "")
      .toLowerCase()
      .replace(EDGE_PUNCT, "");
  },
  stopwords: STOPWORDS,
};

/**
 * Conservative, rule-based reduction of regular English inflections. Approximate
 * — it will over- and under-reduce — but enough to connect "dogs" to "dog" until
 * a real lemmatizer ships. Opt in via {@link englishStemmed}.
 */
export function naiveEnglishLemmatize(token: string): string {
  if (token.length <= 3) return token;
  if (/[^aeiou]ies$/.test(token)) return token.slice(0, -3) + "y"; // bodies -> body
  if (/(s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2); //  boxes -> box
  if (/[^su]s$/.test(token) && !/ss$/.test(token)) return token.slice(0, -1); // dogs -> dog
  return token;
}

/** English profile with {@link naiveEnglishLemmatize} wired in. */
export const englishStemmed: LanguageProfile = {
  ...english,
  id: "en-stem",
  lemmatize: naiveEnglishLemmatize,
};
