/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { Document, parseDocument, Tags, YAMLMap, YAMLSeq } from "yaml";
import { Reference } from "./Reference";
import { ReferenceAll } from "./ReferenceAll";
import { Flatten } from "./Flatten";
import { Merge } from "./Merge";
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

/**
 * Custom tag for !merge
 */
const mergeTag = {
  identify: (value: any) => value instanceof Merge,
  tag: "!merge",
  collection: "seq" as const,
  resolve: (value: YAMLSeq, _: (message: string) => void) => {
    // Store the raw YAMLSeq node; it will be converted to JS later via
    // resolveRawNodes once the full Document (with its anchor map) is available.
    return new Merge(value as any);
  },
};

/**
 * Dummy illegal flag when merge is used on a mapping.
 */
const illegalMergeOnMapping = {
  identify: (value: any) => value instanceof Merge,
  tag: "!merge",
  collection: "map" as const,
  resolve: (_: any, onError: (message: string) => void) => {
    return onError("!merge tag cannot be used on a mapping");
  },
};

/**
 * Custom tag for !flatten
 */
const flattenTag = {
  identify: (value: any) => value instanceof Flatten,
  tag: "!flatten",
  collection: "seq" as const,
  resolve: (value: YAMLSeq, _: (message: string) => void) => {
    // Store the raw YAMLSeq node; it will be converted to JS later via
    // resolveRawNodes once the full Document (with its anchor map) is available.
    return new Flatten(value as any);
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
  mergeTag,
  illegalMergeOnMapping,
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
    const doc = parseDocument(content, { customTags: customTags });
    if (doc.errors.length > 0) {
      throw doc.errors[0];
    }
    const parsed = doc.toJS();

    // Convert any raw YAMLSeq nodes stored in Flatten/Merge to JS arrays,
    // using the original document so that anchors & aliases resolve correctly.
    const resolved = resolveRawNodes(parsed, doc);

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(resolved, filePath);
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
    const doc = parseDocument(content, { customTags: customTags });
    if (doc.errors.length > 0) {
      throw doc.errors[0];
    }
    const parsed = doc.toJS();

    // Convert any raw YAMLSeq nodes stored in Flatten/Merge to JS arrays,
    // using the original document so that anchors & aliases resolve correctly.
    const resolved = resolveRawNodes(parsed, doc);

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(resolved, filePath);
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
 * Recursively walk the parsed JS tree and convert any raw YAMLSeq nodes
 * (stored in Flatten/Merge instances during the compose phase) into plain JS
 * arrays. Because we pass the original Document, aliases are resolved through
 * the document's anchor map.
 */
function resolveRawNodes(obj: any, doc: Document): any {
  if (obj instanceof Flatten) {
    // obj.sequence is either a raw YAMLSeq (has toJS) or already a JS array
    const sequence =
      obj.sequence && typeof (obj.sequence as any).toJS === "function"
        ? (obj.sequence as any).toJS(doc)
        : obj.sequence;
    return new Flatten(
      (sequence as any[]).map((item: any) => resolveRawNodes(item, doc)),
    );
  }

  if (obj instanceof Merge) {
    const sequence =
      obj.sequence && typeof (obj.sequence as any).toJS === "function"
        ? (obj.sequence as any).toJS(doc)
        : obj.sequence;
    return new Merge(
      (sequence as any[]).map((item: any) => resolveRawNodes(item, doc)),
    );
  }

  if (Array.isArray(obj)) {
    return obj.map((item: any) => resolveRawNodes(item, doc));
  }

  if (
    obj &&
    typeof obj === "object" &&
    !(obj instanceof Reference) &&
    !(obj instanceof ReferenceAll)
  ) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveRawNodes(value, doc);
    }
    return result;
  }

  return obj;
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
    const processed = obj.sequence.map((item) =>
      processParsedDocument(item, filePath),
    );
    return new Flatten(processed);
  }

  if (obj instanceof Merge) {
    const processed = obj.sequence.map((item) =>
      processParsedDocument(item, filePath),
    );
    return new Merge(processed);
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
