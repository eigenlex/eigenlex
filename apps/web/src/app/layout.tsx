// Install server-side DOM stand-ins before any Fondue module is evaluated.
import "@/ssr-dom-globals";
import type { ReactNode } from "react";
// Fondue base tokens first (the `:root` design-token variables), then the compiled
// component styles, then our Tailwind layer so `tw-` utilities can win where needed.
import "@frontify/fondue/tokens/base";
import "@frontify/fondue/components/styles";
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "eigenlex",
  description: "The directed graph a dictionary's definitions form.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="RootLayout">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
