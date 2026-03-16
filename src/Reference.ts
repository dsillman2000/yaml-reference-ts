import * as pathModule from "path";
import { YAMLMap } from "yaml";
import type { ToJSContext } from "yaml/dist/util";

/**
 * Reference class representing a !reference tag in YAML
 * This class is instantiated when the YAML parser encounters a !reference tag
 */
export class Reference {
  /**
   * Absolute path to the YAML file where this !reference tag was found
   * This is automatically set by the library during parsing
   */
  location: string;

  /**
   * Anchor to import from the referenced YAML file
   * Optional, provided by the user in the YAML document
   * If not provided, the entire YAML file will be imported
   * If provided, only the specified anchor will be imported from the referenced file
   */
  anchor?: string;

  /**
   * Relative path to another YAML file
   * Required, explicitly provided by the user in the YAML document
   */
  path: string;

  /**
   * Creates a new Reference instance
   * @param path - Relative path to another YAML file
   * @param options.location - Absolute path to the file containing this reference (optional, will be set later)
   * @param options.anchor - Anchor to import from the referenced YAML file (optional)
   */
  constructor(path: string, options?: { location?: string; anchor?: string }) {
    // Ensure path is not empty
    if (!path || path.length === 0) {
      throw new Error("Reference path must not be empty");
    }

    // Validate that path is not absolute
    if (path && path.length > 0 && pathModule.isAbsolute(path)) {
      throw new Error(
        `Reference path must be relative, not absolute: "${path}"`,
      );
    }

    this.path = path;
    this.location = options?.location || "";
    this.anchor = options?.anchor ?? undefined;
  }

  /**
   * Returns a string representation of the Reference
   */
  toString(): string {
    return `Reference { path: "${this.path}", location: "${this.location}", anchor: "${this.anchor}" }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

export const REFERENCE_NODE_FLAG = Symbol("isReference");

export const isResolvedReferenceNode = (
  value: unknown,
): value is { path: string } => {
  return (
    typeof value === "object" && value !== null && REFERENCE_NODE_FLAG in value
  );
};

export class ReferenceNode extends YAMLMap {
  tag = "!reference";
  toJSON(_: unknown, ctx: ToJSContext) {
    const value = super.toJSON(_, { ...ctx }) as Record<string, unknown>;

    // Get the path property from the map
    const pathValue = value.path;
    if (!pathValue) {
      throw new Error('!reference tag requires a "path" property');
    }

    if (typeof pathValue !== "string") {
      throw new Error('!reference "path" property must be a string');
    }

    // Coerce anchor to string if present (e.g. anchor: 1 is valid YAML
    // but parsed as a number)
    if ("anchor" in value && value.anchor !== undefined) {
      if (typeof value.anchor === "object") {
        throw new Error('!reference "anchor" property must be a scalar value');
      }
      const anchorVal = value.anchor as string | number | boolean;
      value.anchor = String(anchorVal);
    }

    Object.assign(value, { [REFERENCE_NODE_FLAG]: true });
    return value;
  }
}

/**
 * Custom tag for !reference
 */
const referenceTag = {
  identify: (value: unknown) => value instanceof ReferenceNode,
  tag: "!reference",
  collection: "map" as const,
  nodeClass: ReferenceNode,
};

/**
 * Dummy illegal flag when !reference is used on a sequence.
 */
const illegalReferenceOnSequence = {
  identify: (value: unknown) => value instanceof ReferenceNode,
  tag: "!reference",
  collection: "seq" as const,
  resolve: (_: unknown, onError: (message: string) => void) => {
    return onError("!reference tag cannot be used on a sequence");
  },
};

/**
 * Custom tag for !reference when used in scalar shorthand form (e.g. !reference
 * "path/to/file.yaml")
 */
const referenceScalarShorthand = {
  tag: "!reference",
  resolve: (value: unknown, onError: (message: string) => void) => {
    if (typeof value !== "string") {
      return onError("!reference scalar shorthand requires a string path");
    }
    const obj: Record<string, unknown> = { path: value };
    Object.assign(obj, { [REFERENCE_NODE_FLAG]: true });
    return obj;
  },
};

export const referenceTags = [
  referenceTag,
  illegalReferenceOnSequence,
  referenceScalarShorthand,
];
