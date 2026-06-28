import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "eigenlex",
  description: "The directed graph a dictionary's definitions form.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
