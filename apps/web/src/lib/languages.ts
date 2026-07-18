// The source languages whose vocabulary the app bands — the axis a learner picks
// from. Distinct from the reader's *target* language (the gloss language chosen in
// the word card). Shared by the server (lib/bands) and the client UI.

export const SOURCE_LANGS = ["en", "es", "fr", "de", "pt"] as const;
export type SourceLang = (typeof SOURCE_LANGS)[number];

export const DEFAULT_SOURCE: SourceLang = "en";

export function isSourceLang(v: string): v is SourceLang {
  return (SOURCE_LANGS as readonly string[]).includes(v);
}

export interface SourceLangMeta {
  /** Name in the language's own tongue, for the picker. */
  name: string;
  /** Word looked up when this language is first selected. */
  defaultWord: string;
  /** Where its frequency ranking comes from, credited beneath the browser. */
  source: { name: string; url: string };
}

const SUBTLEX_US = {
  name: "SUBTLEX-US",
  url: "https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus",
};
// OpenSubtitles-derived frequency lists (hermitdave/FrequencyWords, 2018).
const opensubs = (path: string) => ({
  name: "OpenSubtitles frequencies",
  url: `https://github.com/hermitdave/FrequencyWords/tree/master/content/2018/${path}`,
});

export const SOURCE_LANG_META: Record<SourceLang, SourceLangMeta> = {
  en: { name: "English", defaultWord: "water", source: SUBTLEX_US },
  es: { name: "Español", defaultWord: "agua", source: opensubs("es") },
  fr: { name: "Français", defaultWord: "eau", source: opensubs("fr") },
  de: { name: "Deutsch", defaultWord: "wasser", source: opensubs("de") },
  pt: { name: "Português", defaultWord: "água", source: opensubs("pt") },
};
