export type {
  BuildOptions,
  DefinitionGraph,
  Dictionary,
  Headword,
  LanguageProfile,
} from "./types";
export { buildDefinitionGraph } from "./buildDefinitionGraph";
export { english, englishStemmed, naiveEnglishLemmatize } from "./language/english";
export { TokenTrie } from "./trie";
export type { TrieMatch } from "./trie";
