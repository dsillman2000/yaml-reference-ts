import { YAMLSeq } from "yaml";
import type { ToJSContext } from "yaml/dist/util";

/**
 * Merge class representing a !merge tag in YAML
 * This class is instantiated when the YAML parser encounters a !merge tag
 * The !merge tag should be applied to Sequence nodes to merge a sequence of objects
 * using last-write-wins semantics (like JS spread)
 */
export class Merge {
  /**
   * The sequence of objects to be merged
   * This contains the raw parsed YAML document sequence
   */
  sequence: unknown[];

  /**
   * Creates a new Merge instance
   * @param sequence - The sequence of objects to be merged
   */
  constructor(sequence: unknown[]) {
    this.sequence = sequence;
  }

  /**
   * Returns a string representation of the Merge
   */
  toString(): string {
    return `Merge { sequence: ${JSON.stringify(this.sequence)} }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

export const MERGE_NODE_FLAG = Symbol("isMerge");

export const isResolvedMergeNode = (value: unknown): value is object[] => {
  return Array.isArray(value) && MERGE_NODE_FLAG in value;
};

export class MergeNode extends YAMLSeq {
  tag = "!merge";
  toJSON(_: unknown, ctx: ToJSContext) {
    const data = super.toJSON(_, ctx);
    Object.assign(data, { [MERGE_NODE_FLAG]: true });
    return data;
  }
}

/**
 * Custom tag for !merge
 */
const mergeTag = {
  identify: (value: unknown) => value instanceof MergeNode,
  tag: "!merge",
  collection: "seq" as const,
  nodeClass: MergeNode,
};

/**
 * Dummy illegal flag when merge is used on a mapping.
 */
const illegalMergeOnMapping = {
  identify: (value: unknown) => value instanceof Merge,
  tag: "!merge",
  collection: "map" as const,
  resolve: (_: unknown, onError: (message: string) => void) => {
    return onError("!merge tag cannot be used on a mapping");
  },
};

/**
 * Dummy illegal flag when merge is used on a scalar.
 */
const illegalMergeOnScalar = {
  tag: "!merge",
  resolve: (_: unknown, onError: (message: string) => void) => {
    return onError("!merge tag cannot be used on a scalar");
  },
};

export const MergeTags = [
  mergeTag,
  illegalMergeOnMapping,
  illegalMergeOnScalar,
];
