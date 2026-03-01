import { YAMLSeq } from "yaml";
import type { ToJSContext } from "yaml/dist/util";

/**
 * Flatten class representing a !flatten tag in YAML
 * This class is instantiated when the YAML parser encounters a !flatten tag
 * The !flatten tag should be applied to Sequence nodes to flatten nested arrays
 */
export class Flatten {
  /**
   * The sequence to be flattened
   * This contains the raw parsed YAML document sequence
   */
  sequence: any[];

  /**
   * Creates a new Flatten instance
   * @param sequence - The sequence to be flattened
   */
  constructor(sequence: any[]) {
    this.sequence = sequence;
  }

  /**
   * Returns a string representation of the Flatten
   */
  toString(): string {
    return `Flatten { sequence: ${JSON.stringify(this.sequence)} }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

export const FLATTEN_NODE_FLAG = Symbol("isFlatten");

export const isResolvedFlattenNode = (value: unknown): value is object[] => {
  return Array.isArray(value) && FLATTEN_NODE_FLAG in value;
};

export class FlattenNode extends YAMLSeq {
  tag = "!flatten";
  toJSON(_: unknown, ctx: ToJSContext) {
    const data = super.toJSON(_, ctx);
    Object.assign(data, { [FLATTEN_NODE_FLAG]: true });
    return data;
  }
}
