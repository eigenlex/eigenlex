import type { Config } from "tailwindcss";
import fonduePreset from "@frontify/fondue/tokens/tailwind";

// The Fondue preset swaps Tailwind's colour/type/radius scales for design tokens
// (CSS variables that the `ThemeProvider` theme class re-points). The `tw-` prefix
// matches the class names Fondue documents and its SDK reports for every token.
export default {
  presets: [fonduePreset as Config],
  prefix: "tw-",
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;
