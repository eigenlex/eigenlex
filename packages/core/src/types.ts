/** A dictionary headword, as written by its source. */
export type Headword = string;

/**
 * The plain, source-agnostic object the core consumes. Every adapter produces
 * this shape. Keys are headwords; values are the raw definition texts, one per
 * sense.
 */
export type Dictionary = Record<Headword, string[]>;

/**
 * All language-specific behaviour, injected so the graph builder stays
 * language-agnostic. The same profile is applied to both headwords and
 * definition text, so matching is consistent across the two.
 */
export interface LanguageProfile {
  /** Short identifier (e.g. an ISO code), recorded on the output graph. */
  readonly id: string;
  /** Split raw text into candidate tokens (whitespace, or a CJK segmenter). */
  tokenize(text: string): string[];
  /** Canonicalize a token: lowercase, strip accents and edge punctuation. */
  normalize(token: string): string;
  /** Optional reduction to a base form ("dogs" -> "dog"). */
  lemmatize?(token: string): string;
  /** Function words to ignore as definitional links. */
  readonly stopwords?: ReadonlySet<string>;
}

export interface BuildOptions {
  /** Language profile; defaults to the bundled English profile. */
  language?: LanguageProfile;
  /** Keep edges to stopwords instead of dropping them. Default false. */
  includeStopwords?: boolean;
  /** Keep edges from a word to itself. Default false. */
  includeSelfLoops?: boolean;
  /** Match multi-word headwords ("ice cream") by longest match. Default true. */
  matchPhrases?: boolean;
  /**
   * Drop "dead" headwords: isolated nodes with no definitional edge in or out —
   * e.g. archaic spelling stubs like "alledge" whose definition ("See Allege.")
   * cleans to nothing and that no other entry references. Default false.
   */
  dropIsolated?: boolean;
}

/**
 * The core output: plain, serializable adjacency data. Deliberately not a live
 * graph object — cache it, ship it over the wire, precompute it at build time.
 */
export interface DefinitionGraph {
  /** The language profile id used to build it. */
  language: string;
  /** Canonical headword -> the canonical headwords its definitions reference. */
  edges: Record<Headword, Headword[]>;
  /** Canonical headword -> a representative original surface form. */
  labels: Record<Headword, Headword>;
  stats: {
    nodes: number;
    edges: number;
    /** Headwords whose definitions reference nothing else in the dictionary. */
    sinks: number;
    /** Headwords no definition ever references. */
    sources: number;
  };
}
