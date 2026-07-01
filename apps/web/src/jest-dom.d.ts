// Makes @testing-library/jest-dom's matchers (toBeInTheDocument, toHaveAttribute,
// …) visible to `tsc` for the component tests. The runtime registration lives in
// test/setup.ts; this only supplies the type augmentation of vitest's `expect`.
import "@testing-library/jest-dom/vitest";
