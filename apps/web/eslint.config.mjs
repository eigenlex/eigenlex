import a11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";

// The accessibility tree is the app's other output, and most of it is not visible in the
// JSX — Fondue builds part of the markup and a name is computed rather than written. This
// catches the half a static check can see: a role missing the props it requires, an
// invalid aria-* attribute, an interactive element a keyboard cannot reach. The rest is
// guarded by tests, which is where the tablist contract and Fondue's two internals live.
//
// `recommended`, not `strict`: strict withdraws the escape hatches this app uses on
// purpose, among them `<ul role="listbox">` with `<li role="option">` for the typeahead,
// which is the ARIA combobox pattern spelled exactly as the APG writes it.
export default [
  { ignores: [".next/**", ".next-build/**", "coverage/**", "data/**"] },
  {
    files: ["src/**/*.tsx"],
    plugins: { "jsx-a11y": a11y },
    // A disable that stops being needed is itself a finding: it means the code moved and
    // nobody noticed the exemption outliving its reason.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...a11y.flatConfigs.recommended.rules,

      // Both are off in `recommended` and both are on the subject of this app's audit:
      // every control saying what it is, and saying something.
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/anchor-ambiguous-text": "error",

      // An <abbr> with no title carries no expansion at all — the element alone says only
      // "this is an abbreviation". The prop is easy to pass to a wrapper and never put on
      // the element, which is exactly what happened here. See `AbbrLink`.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXOpeningElement[name.name="abbr"]:not(:has(JSXAttribute[name.name="title"]))',
          message: "<abbr> needs a title: without one it holds no expansion (WCAG 3.1.4).",
        },
      ],
    },
  },
];
