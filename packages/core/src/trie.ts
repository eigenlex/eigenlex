interface TrieNode {
  children: Map<string, TrieNode>;
  /** The canonical headword that terminates here, if any. */
  terminal: string | null;
}

export interface TrieMatch {
  /** The matched canonical headword. */
  value: string;
  /** How many tokens it consumed. */
  length: number;
}

/**
 * A trie keyed by token sequences. Lets the builder match both single-word and
 * multi-word headwords against a definition's token stream with one mechanism —
 * the same mechanism that makes whitespace-free languages work, where tokens
 * are characters or segments.
 */
export class TokenTrie {
  private readonly root: TrieNode = { children: new Map(), terminal: null };

  insert(tokens: readonly string[], value: string): void {
    let node = this.root;
    for (const tok of tokens) {
      let next = node.children.get(tok);
      if (!next) {
        next = { children: new Map(), terminal: null };
        node.children.set(tok, next);
      }
      node = next;
    }
    node.terminal = value;
  }

  /** Longest headword whose token sequence begins at `tokens[start]`. */
  matchLongest(tokens: readonly string[], start: number): TrieMatch | null {
    let node = this.root;
    let best: TrieMatch | null = null;
    for (let i = start; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === undefined) break;
      const next = node.children.get(tok);
      if (!next) break;
      node = next;
      if (node.terminal !== null) best = { value: node.terminal, length: i - start + 1 };
    }
    return best;
  }
}
