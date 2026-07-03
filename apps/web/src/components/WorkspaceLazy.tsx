"use client";

import dynamic from "next/dynamic";

// The Workspace pulls in Fondue's interactive components (a large shared runtime).
// Load it client-side only so that chunk stays out of the initial payload — the
// server-rendered masthead paints immediately and the workspace hydrates just after.
// A sized placeholder reserves space to avoid layout shift on mount.
const Workspace = dynamic(() => import("@/components/Workspace"), {
  ssr: false,
  loading: () => <div className="tw-min-h-[560px]" aria-hidden />,
});

export default Workspace;
