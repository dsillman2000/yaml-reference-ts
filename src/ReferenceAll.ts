import * as pathModule from "path";

/**
 * ReferenceAll class representing a !reference-all tag in YAML
 * This class is instantiated when the YAML parser encounters a !reference-all tag
 */
export class ReferenceAll {
  /**
   * Absolute path to the YAML file where this !reference-all tag was found
   * This is automatically set by the library during parsing
   */
  _location: string;

  /**
   * Glob pattern to match YAML files
   * Required, explicitly provided by the user in the YAML document
   */
  glob: string;

  /**
   * Creates a new ReferenceAll instance
   * @param glob - Glob pattern to match YAML files
   * @param location - Absolute path to the file containing this reference (optional, will be set later)
   */
  constructor(glob: string, location?: string) {
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
    this._location = location || "";
  }

  /**
   * Returns a string representation of the ReferenceAll
   */
  toString(): string {
    return `ReferenceAll { glob: "${this.glob}", _location: "${this._location}" }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}
