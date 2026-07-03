"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@frontify/fondue/components";

// Fondue's components ship without a "use client" directive, so the ThemeProvider
// and its React context must live inside our own client boundary rather than being
// imported straight into the server-rendered root layout. The provider element also
// doubles as the page surface: it carries the dark theme (which re-points every
// colour token) and fills the viewport.
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme="dark" className="tw-min-h-screen tw-bg-surface-dim tw-text-primary">
      {children}
    </ThemeProvider>
  );
}
