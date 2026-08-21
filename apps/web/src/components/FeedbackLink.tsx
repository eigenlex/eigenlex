"use client";

import { useEffect, useState } from "react";

// Encoded so the shipped bundle holds no address for a scraper to lift. Decoding on the
// server and rendering the joined form would put it straight back into the HTML, so the
// spelled-out one is what the server sends — still readable, and the only thing a visitor
// without JS ever sees.
const ENCODED = "c2FtdWVsZ29tZXpjcmVzcG9AZ21haWwuY29t";
const ADDRESS = atob(ENCODED);
const SPELLED = ADDRESS.replace("@", " at ").replaceAll(".", " dot ");
const SUBJECT = "eigenlex feedback";

const LINK = "tw-underline hover:tw-text-primary";

export default function FeedbackLink() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{SPELLED}</>;

  return (
    <a className={LINK} href={`mailto:${ADDRESS}?subject=${encodeURIComponent(SUBJECT)}`}>
      {ADDRESS}
    </a>
  );
}
