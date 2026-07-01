import { describe, expect, it } from "vitest";
import { TokenTrie } from "./trie";

describe("TokenTrie", () => {
  it("matches a single-token headword", () => {
    const trie = new TokenTrie();
    trie.insert(["dog"], "dog");
    expect(trie.matchLongest(["dog"], 0)).toEqual({ value: "dog", length: 1 });
  });

  it("returns null when nothing begins at the position", () => {
    const trie = new TokenTrie();
    trie.insert(["dog"], "dog");
    expect(trie.matchLongest(["cat"], 0)).toBeNull();
    expect(trie.matchLongest(["a", "dog"], 0)).toBeNull(); // must start at index
  });

  it("prefers the longest headword when one is a prefix of another", () => {
    const trie = new TokenTrie();
    trie.insert(["ice"], "ice");
    trie.insert(["ice", "cream"], "ice cream");
    expect(trie.matchLongest(["ice", "cream", "cone"], 0)).toEqual({
      value: "ice cream",
      length: 2,
    });
    // Only the shorter phrase is present here, so it wins.
    expect(trie.matchLongest(["ice", "age"], 0)).toEqual({ value: "ice", length: 1 });
  });

  it("does not match a partial phrase whose full form was inserted", () => {
    const trie = new TokenTrie();
    trie.insert(["ice", "cream"], "ice cream");
    // "ice" alone is not terminal — only the two-token path is.
    expect(trie.matchLongest(["ice"], 0)).toBeNull();
  });

  it("matches starting from an interior offset", () => {
    const trie = new TokenTrie();
    trie.insert(["cream"], "cream");
    expect(trie.matchLongest(["ice", "cream"], 1)).toEqual({ value: "cream", length: 1 });
  });

  it("a later insert of the same tokens overwrites the terminal value", () => {
    const trie = new TokenTrie();
    trie.insert(["x"], "first");
    trie.insert(["x"], "second");
    expect(trie.matchLongest(["x"], 0)).toEqual({ value: "second", length: 1 });
  });

  it("handles start beyond the token stream", () => {
    const trie = new TokenTrie();
    trie.insert(["x"], "x");
    expect(trie.matchLongest(["x"], 5)).toBeNull();
  });
});
