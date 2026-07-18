"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "@frontify/fondue/components";

// The resolved colour applied to the UI…
export type Theme = "light" | "dark";
// …vs. what the user picked. "system" follows the OS via prefers-color-scheme.
export type ThemePreference = Theme | "system";

const PREF_COOKIE = "eigenlex:theme";
// Last resolved colour, cached so SSR can paint the right theme for a "system"
// visitor on the very next request — Fondue scopes its tokens to a React-rendered
// div, so the server (not a pre-paint script) has to get the colour right.
const RESOLVED_COOKIE = "eigenlex:theme-resolved";

// Lets any client component read and flip the colour theme. A user-selectable
// foreground/background is what carries WCAG 1.4.8 (AAA) Visual Presentation.
const ThemeToggleContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: Theme;
  setPreference: (p: ThemePreference) => void;
}>({
  preference: "system",
  resolvedTheme: "dark",
  setPreference: () => {},
});

export const useThemeToggle = () => useContext(ThemeToggleContext);

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const writeCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
};

// Fondue's components ship without a "use client" directive, so the ThemeProvider
// and its React context must live inside our own client boundary rather than being
// imported straight into the server-rendered root layout. The provider element also
// doubles as the page surface: it carries the theme (which re-points every colour
// token) and fills the viewport.
export default function Providers({
  initialPreference,
  initialResolved,
  children,
}: {
  initialPreference: ThemePreference;
  initialResolved: Theme;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  // Seeded from the server's resolved value so the first client render matches SSR.
  const [resolved, setResolved] = useState<Theme>(initialResolved);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeCookie(PREF_COOKIE, next);
    setResolved(next === "system" ? systemTheme() : next);
  }, []);

  // Mirror the resolved colour onto <html> (and cache it) whenever it changes, so the
  // body background and the server-rendered masthead re-theme in step with the wrapper
  // and the next SSR paints the right theme without a flash.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(resolved);
    html.dataset.theme = resolved;
    writeCookie(RESOLVED_COOKIE, resolved);
  }, [resolved]);

  // While following the system, track live OS changes and correct any stale SSR guess.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setResolved(mq.matches ? "dark" : "light");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [preference]);

  return (
    <ThemeToggleContext.Provider value={{ preference, resolvedTheme: resolved, setPreference }}>
      <ThemeProvider
        theme={resolved}
        className="Providers tw-min-h-screen tw-bg-surface-dim tw-text-primary"
      >
        {children}
      </ThemeProvider>
    </ThemeToggleContext.Provider>
  );
}
