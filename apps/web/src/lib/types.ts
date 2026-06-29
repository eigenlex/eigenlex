// Shared API shapes — importable from both server (lib/graph) and client.

export interface WordInfo {
  word: string;
  senses: string[];
  /** Headwords this word's definition is built from (out-edges). */
  defines: string[];
  /** Headwords whose definitions use this word (in-edges). */
  usedBy: string[];
  pageRank: number;
  /** 1-based rank by PageRank. */
  rank: number;
  inKernel: boolean;
  /** Size of this word's strongly connected component. */
  componentSize: number;
  /** Advancement layer (0 = most basic). */
  depth: number;
  /** Total number of layers in the dictionary. */
  layerCount: number;
}

export type EgoKind = "focus" | "defines" | "usedBy" | "mutual";

export interface EgoNode {
  id: string;
  kind: EgoKind;
  score: number;
  /** Advancement layer (0 = most basic). */
  depth: number;
}

export interface EgoGraph {
  focus: string;
  nodes: EgoNode[];
  edges: Array<{ source: string; target: string }>;
}

export interface TopWord {
  word: string;
  score: number;
}
