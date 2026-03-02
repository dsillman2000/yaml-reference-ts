import * as pathModule from "path";
import { YAMLMap } from "yaml";
import type { ToJSContext } from "yaml/dist/util";

/**
 * ReferenceAll class representing a !reference-all tag in YAML
 * This class is instantiated when the YAML parser encounters a !reference-all tag
 */
export class ReferenceAll {
  /**
   * Absolute path to the YAML file where this !reference-all tag was found
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
   * Glob pattern to match YAML files
   * Required, explicitly provided by the user in the YAML document
   */
  glob: string;

  /**
   * Creates a new ReferenceAll instance
   * @param glob - Glob pattern to match YAML files
   * @param options.location - Absolute path to the file containing this reference (optional, will be set later)
   * @param options.anchor - Anchor to import from the referenced YAML file (optional)
   */
  constructor(glob: string, options?: { location?: string; anchor?: string }) {
    // Ensure glob is not empty
    if (!glob || glob.length === 0) {
      throw new Error("ReferenceAll glob must not be empty");
    }

    // Validate that glob is not absolute
    if (glob && glob.length > 0 && pathModule.isAbsolute(glob)) {
      throw new Error(
        `ReferenceAll glob must be relative, not absolute: "${glob}"`,
      );
    }

    this.glob = glob;
    this.location = options?.location || "";
    this.anchor = options?.anchor ?? undefined;
  }

  /**
   * Returns a string representation of the ReferenceAll
   */
  toString(): string {
    return `ReferenceAll { glob: "${this.glob}", location: "${this.location}", anchor: "${this.anchor}" }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

export const REFERENCE_ALL_NODE_FLAG = Symbol("isReferenceAll");

export const isResolvedReferenceAllNode = (
  value: unknown,
): value is { glob: string } => {
  return (
    typeof value === "object" &&
    value !== null &&
    REFERENCE_ALL_NODE_FLAG in value
  );
};

export class ReferenceAllNode extends YAMLMap {
  tag = "!reference-all";
  toJSON(_: unknown, ctx: ToJSContext) {
    const value = super.toJSON(_, { ...ctx }) as Record<string, unknown>;

    // Get the glob property from the map
    const globValue = value.glob;
    if (!globValue) {
      throw new Error('!reference-all tag requires a "glob" property');
    }

    if (typeof globValue !== "string") {
      throw new Error('!reference-all "glob" property must be a string');
    }

    // Coerce anchor to string if present (e.g. anchor: 1 is valid YAML
    // but parsed as a number)
    if ("anchor" in value && value.anchor !== undefined) {
      if (typeof value.anchor === "object") {
        throw new Error(
          '!reference-all "anchor" property must be a scalar value',
        );
      }
      const anchorVal = value.anchor as string | number | boolean;
      value.anchor = String(anchorVal);
    }

    Object.assign(value, { [REFERENCE_ALL_NODE_FLAG]: true });
    return value;
  }
}
