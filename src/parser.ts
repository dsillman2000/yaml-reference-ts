/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { Document, parse, Tags, YAMLMap, YAMLSeq } from "yaml";
import { Reference } from "./Reference";
import { ReferenceAll } from "./ReferenceAll";
import { Flatten } from "./Flatten";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";

/**
 * Custom tag for !reference
 */
const referenceTag = {
  identify: (value: any) => value instanceof Reference,
  tag: "!reference",
  collection: "map" as const,
  resolve: (value: any, onError: (message: string) => void) => {
    // value should be a YAMLMap for mapping syntax
    if (!(value instanceof YAMLMap)) {
      return onError(
        '!reference tag must be followed by a mapping with a "path" property',
      );
    }

    // Get the path property from the map
    const pathValue = value.get("path");
    if (!pathValue) {
      return onError('!reference tag requires a "path" property');
    }

    if (typeof pathValue !== "string") {
      return onError('!reference "path" property must be a string');
    }

    return new Reference(pathValue);
  },
};

/**
 * Custom tag for !reference-all
 */
const referenceAllTag = {
  identify: (value: any) => value instanceof ReferenceAll,
  tag: "!reference-all",
  collection: "map" as const,
  resolve: (value: any, onError: (message: string) => void) => {
    // Get the glob property from the map
    const globValue = value.get("glob");
    if (!globValue || globValue === null) {
      return onError('!reference-all tag requires a "glob" property');
    }

    if (typeof globValue !== "string") {
      return onError('!reference-all "glob" property must be a string');
    }

    return new ReferenceAll(globValue);
  },
};

const referentialTags: Tags = [referenceTag, referenceAllTag];

/**
 * Custom tag for !flatten
 */
const flattenTag = {
  identify: (value: any) => value instanceof Flatten,
  tag: "!flatten",
  collection: "seq" as const,
  resolve: (value: YAMLSeq, _: (message: string) => void) => {
    const sequence = new Document(value, {
      customTags: referentialTags,
    }).toJS();
    return new Flatten(sequence);
  },
};

/**
 * Dummy illegal flag when flatten is used on a mapping.
 */
const illegalFlattenOnMapping = {
  identify: (value: any) => value instanceof Flatten,
  tag: "!flatten",
  collection: "map" as const,
  resolve: (_: any, onError: (message: string) => void) => {
    return onError("!flatten tag cannot be used on a mapping");
  },
};

// Custom tags array for parsing
const customTags: Tags = [
  referenceTag,
  referenceAllTag,
  flattenTag,
  illegalFlattenOnMapping,
];

/**
 * Parse YAML content with custom !reference and !reference-all tags
 * @param filePath - Path to the YAML file to be parsed (used for setting _location)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export function parseYamlWithReferencesSync(filePath: string): any {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fsSync.readFileSync(absolutePath, "utf8");
    const parsed = parse(content, { customTags: customTags });

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(parsed, filePath);
  } catch (error) {
    // Re-throw the error with context about which file failed to parse
    throw new Error(
      `Failed to parse YAML file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Parse YAML content with custom !reference and !reference-all tags (async).
 * @param filePath - Path to the YAML file to be parsed (used for setting _location)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export async function parseYamlWithReferences(filePath: string): Promise<any> {
  try {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const parsed = parse(content, { customTags: customTags });

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(parsed, filePath);
  } catch (error) {
    // Re-throw the error with context about which file failed to parse
    throw new Error(
      `Failed to parse YAML file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Recursively process parsed document to set _location on Reference and ReferenceAll objects
 */
function processParsedDocument(obj: any, filePath: string): any {
  if (obj instanceof Reference) {
    obj._location = filePath;
    return obj;
  }

  if (obj instanceof ReferenceAll) {
    obj._location = filePath;
    return obj;
  }

  if (obj instanceof Flatten) {
    let processed = obj.sequence.map((item) =>
      processParsedDocument(item, filePath),
    );
    return new Flatten(processed);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => processParsedDocument(item, filePath));
  }

  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processParsedDocument(value, filePath);
    }
    return result;
  }

  return obj;
}
