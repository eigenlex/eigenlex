// Where the client is, as a proxy for the language they are likeliest to be studying.
// Vercel resolves the client IP to a country and passes it as a request header; the
// page reads that server-side and hands it down to seed the source language.

import type { SourceLang } from "@/lib/languages";

// ISO 3166-1 alpha-2 countries whose everyday language is one we index. English is
// excluded by the type: anywhere unlisted falls back to it, so it needs no entries.
const LOCAL: Record<Exclude<SourceLang, "en">, string> = {
  es: "ES MX AR CO PE VE CL EC GT CU BO DO HN PY SV NI CR PA UY PR GQ",
  pt: "PT BR AO MZ CV GW ST TL",
  fr: "FR MC HT SN CI CM ML BF NE TD GN BJ TG CD CG GA MG",
  de: "DE AT LI",
  it: "IT SM VA",
};

// Countries where more than one of ours is local, so the browser locale picks; the
// first is the fallback when it says nothing useful. BE and LU lead with French
// because their own majority languages aren't indexed.
const MULTILINGUAL: Record<string, readonly [SourceLang, ...SourceLang[]]> = {
  BE: ["fr", "de"],
  CA: ["en", "fr"],
  CH: ["de", "fr", "it"],
  LU: ["fr", "de"],
};

const BY_COUNTRY = new Map<string, SourceLang>(
  Object.entries(LOCAL).flatMap(([lang, codes]) =>
    codes.split(" ").map((code): [string, SourceLang] => [code, lang as SourceLang]),
  ),
);

/**
 * The indexed language spoken where the client is. Null when there's no country to go
 * on — off Vercel, or behind a VPN Vercel can't place — or when nothing we index is
 * spoken there, both of which leave the caller on its own default.
 */
export function localLang(country: string | null | undefined, browser: string): SourceLang | null {
  const cc = country?.trim().toUpperCase();
  if (!cc) return null;
  const many = MULTILINGUAL[cc];
  if (many) return many.find((l) => l === browser) ?? many[0];
  return BY_COUNTRY.get(cc) ?? null;
}

/**
 * The gloss language: the reader's own, per the browser. It steps aside when that is
 * the language being studied, since a word glossed into itself is no gloss — the case
 * of a local browsing their own vocabulary. Spanish backs English off as the second
 * language an anglophone most often has.
 */
export function glossLang(lang: SourceLang, browser: string): string {
  if (browser !== lang) return browser;
  return lang === "en" ? "es" : "en";
}
