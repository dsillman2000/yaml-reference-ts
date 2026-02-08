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
