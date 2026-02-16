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
     * @param location - Absolute path to the file containing this flatten tag (optional, will be set later)
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
