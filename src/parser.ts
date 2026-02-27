/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { parseDocument, Tags } from "yaml";
import { isResolvedReferenceNode, Reference, ReferenceNode } from "./Reference";
import {
  isResolvedReferenceAllNode,
  ReferenceAll,
  ReferenceAllNode,
} from "./ReferenceAll";
import { FlattenNode, Flatten, isResolvedFlattenNode } from "./Flatten";
import { MergeNode, Merge, isResolvedMergeNode } from "./Merge";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";

/**
 * Custom tag for !reference
 */
const referenceTag = {
  identify: (value: any) => value instanceof ReferenceAllNode,
  tag: "!reference",
  collection: "map" as const,
  nodeClass: ReferenceNode,
};

/**
 * Custom tag for !reference-all
 */
const referenceAllTag = {
  identify: (value: any) => value instanceof ReferenceAllNode,
  tag: "!reference-all",
  collection: "map" as const,
  nodeClass: ReferenceAllNode,
};

/**
 * Custom tag for !merge
 */
const mergeTag = {
  identify: (value: any) => value instanceof MergeNode,
  tag: "!merge",
  collection: "seq" as const,
  nodeClass: MergeNode,
};

/**
 * Custom tag for !flatten
 */
const flattenTag = {
  identify: (value: any) => value instanceof FlattenNode,
  tag: "!flatten",
  collection: "seq" as const,
  nodeClass: FlattenNode,
};

// Custom tags array for parsing
const customTags: Tags = [referenceTag, referenceAllTag, flattenTag, mergeTag];

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
    // const resolved = resolveRawNodes(parsed, doc);

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(parsed /* resolved */, filePath);
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
    // const resolved = resolveRawNodes(parsed, doc);

    // Process the parsed document to set _location on Reference and ReferenceAll objects
    return processParsedDocument(parsed /* resolved */, filePath);
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
 * Recursively process the parsed YAML document and convert based on set symbols
 * to the appropriate Reference, ReferenceAll, Flatten, and Merge instances.
 *
 * This step happens after the entire YAML tree is converted through all layers
 * of the yaml library (text -> CST -> AST -> JS) so that all anchors are
 * resolved.
 *
 * The symbols are injected at the AST -> JS layer (in the toJSON methods of the
 * custom nodes) so that they are present on the final JS objects we get here.
 *
 * @param obj - The parsed YAML document (or sub-object) to process
 * @param filePath - The file path to set as _location on Reference and
 * ReferenceAll instances
 * @returns The processed object with Reference, ReferenceAll, Flatten, and
 * Merge instances
 */
function processParsedDocument(obj: any, filePath: string): any {
  if (isResolvedReferenceNode(obj)) {
    return new Reference(obj.path, filePath);
  }

  if (isResolvedReferenceAllNode(obj)) {
    return new ReferenceAll(obj.glob, filePath);
  }

  if (isResolvedFlattenNode(obj)) {
    const processed = obj.map((item) => processParsedDocument(item, filePath));
    return new Flatten(processed);
  }

  if (isResolvedMergeNode(obj)) {
    const processed = obj.map((item) => processParsedDocument(item, filePath));
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
