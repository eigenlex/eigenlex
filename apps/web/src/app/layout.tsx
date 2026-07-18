// Install server-side DOM stand-ins before any Fondue module is evaluated.
import "@/ssr-dom-globals";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
// Fondue base tokens first (the `:root` design-token variables), then the compiled
// component styles, then our Tailwind layer so `tw-` utilities can win where needed.
import "@frontify/fondue/tokens/base";
import "@frontify/fondue/components/styles";
import "./globals.css";
import Providers, { type Theme, type ThemePreference } from "./providers";

export const metadata = {
  title: "eigenlex",
  description: "The directed graph a dictionary's definitions form.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Server-render the stored theme so the class is on <html> before first paint —
  // no flash, and SSR/client agree (they read the same cookies). A "system" preference
  // can't be resolved on the server (prefers-color-scheme is client-only), so we paint
  // the last resolved colour we cached; a mount effect corrects it if the OS changed.
  const cookieStore = await cookies();
  const stored = cookieStore.get("eigenlex:theme")?.value;
  const preference: ThemePreference =
    stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  const resolved: Theme =
    preference === "system"
      ? cookieStore.get("eigenlex:theme-resolved")?.value === "light"
        ? "light"
        : "dark"
      : preference;
  return (
    <html lang="en" className={`RootLayout ${resolved}`} data-theme={resolved}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers initialPreference={preference} initialResolved={resolved}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
