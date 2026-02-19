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
  sequence: any[];

  /**
   * Creates a new Merge instance
   * @param sequence - The sequence of objects to be merged
   */
  constructor(sequence: any[]) {
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
