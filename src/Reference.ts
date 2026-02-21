import * as pathModule from "path";

/**
 * Reference class representing a !reference tag in YAML
 * This class is instantiated when the YAML parser encounters a !reference tag
 */
export class Reference {
  /**
   * Absolute path to the YAML file where this !reference tag was found
   * This is automatically set by the library during parsing
   */
  _location: string;

  /**
   * Relative path to another YAML file
   * Required, explicitly provided by the user in the YAML document
   */
  path: string;

  /**
   * Creates a new Reference instance
   * @param path - Relative path to another YAML file
   * @param location - Absolute path to the file containing this reference (optional, will be set later)
   */
  constructor(path: string, location?: string) {
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
    this._location = location || "";
  }

  /**
   * Returns a string representation of the Reference
   */
  toString(): string {
    return `Reference { path: "${this.path}", _location: "${this._location}" }`;
  }

  /**
   * Custom inspection method for Node.js console
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}
