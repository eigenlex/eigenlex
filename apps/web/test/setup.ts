// Registers @testing-library/jest-dom matchers on vitest's `expect`. Only the
// matcher definitions load here (no DOM access), so this is safe under the node
// environment the lib/API tests use; component tests opt into jsdom per file.
import "@testing-library/jest-dom/vitest";
