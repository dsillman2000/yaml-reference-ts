/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { Document, Node, parseDocument, Tags, visit } from "yaml";
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
  identify: (value: unknown) => value instanceof ReferenceNode,
  tag: "!reference",
  collection: "map" as const,
  nodeClass: ReferenceNode,
};

/**
 * Custom tag for !reference-all
 */
const referenceAllTag = {
  identify: (value: unknown) => value instanceof ReferenceAllNode,
  tag: "!reference-all",
  collection: "map" as const,
  nodeClass: ReferenceAllNode,
};

/**
 * Custom tag for !merge
 */
const mergeTag = {
  identify: (value: unknown) => value instanceof MergeNode,
  tag: "!merge",
  collection: "seq" as const,
  nodeClass: MergeNode,
};

/**
 * Dummy illegal flag when merge is used on a mapping.
 */
const illegalMergeOnMapping = {
  identify: (value: unknown) => value instanceof Merge,
  tag: "!merge",
  collection: "map" as const,
  resolve: (_: unknown, onError: (message: string) => void) => {
    return onError("!merge tag cannot be used on a mapping");
  },
};

/**
 * Custom tag for !flatten
 */
const flattenTag = {
  identify: (value: unknown) => value instanceof FlattenNode,
  tag: "!flatten",
  collection: "seq" as const,
  nodeClass: FlattenNode,
};

/**
 * Dummy illegal flag when flatten is used on a mapping.
 */
const illegalFlattenOnMapping = {
  identify: (value: unknown) => value instanceof Flatten,
  tag: "!flatten",
  collection: "map" as const,
  resolve: (_: unknown, onError: (message: string) => void) => {
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

export interface ParseOptions {
  extractAnchor?: string;
}

function extractAnchorFromDocument(doc: Document.Parsed, anchor: string): Node {
  const anchors = new Map<string, Node>();
  visit(doc, {
    // record all anchors in the map
    Node(_, node) {
      if (node.anchor) {
        anchors.set(node.anchor, node);
      }
    },
    // Replace all aliases with their corresponding anchor(s)
    // Note: YAML forbids forward-referencing aliases, so we can be sure that
    // the anchor will have been visited before any alias that references it
    Alias(_, node) {
      if (!anchors.has(node.source)) {
        throw new Error(
          `Anchor "${node.source}" not found in the YAML document`,
        );
      }
      // Note: this node will get re-visited by the main visitor, so we don't
      // need to recursively resolve nested aliases here
      return anchors.get(node.source);
    },
  });

  if (!anchors.has(anchor)) {
    throw new Error(`Anchor "${anchor}" not found in the YAML document`);
  }

  return anchors.get(anchor)!;
}

function parseYamlWithReferencesFromString(
  content: string,
  filePath: string,
  options?: ParseOptions,
): unknown {
  const doc = parseDocument(content, { customTags });
  if (doc.errors.length > 0) {
    throw doc.errors[0];
  }
  if (!doc.contents) {
    return null;
  }

  let root: Node = doc.contents;
  if (options?.extractAnchor !== undefined) {
    root = extractAnchorFromDocument(doc, options.extractAnchor);
  }

  const parsed = root.toJS(doc) as unknown;
  return processParsedDocument(parsed, filePath);
}

/**
 * Parse YAML content with custom !reference and !reference-all tags
 * @param filePath - Path to the YAML file to be parsed (used for setting
 * location)
 * @param options - Optional parsing options (e.g. extractAnchor to specify an
 * anchor to extract as root)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export function parseYamlWithReferencesSync(
  filePath: string,
  options?: ParseOptions,
): unknown {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fsSync.readFileSync(absolutePath, "utf8");
    return parseYamlWithReferencesFromString(content, filePath, options);
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
 * @param filePath - Path to the YAML file to be parsed (used for setting
 * location)
 * @param options - Optional parsing options (e.g. extractAnchor to specify an
 * anchor to extract as root)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export async function parseYamlWithReferences(
  filePath: string,
  options?: ParseOptions,
): Promise<unknown> {
  try {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, "utf8");
    return parseYamlWithReferencesFromString(content, filePath, options);
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
 * @param filePath - The file path to set as location on Reference and
 * ReferenceAll instances
 * @returns The processed object with Reference, ReferenceAll, Flatten, and
 * Merge instances
 */
function processParsedDocument(obj: unknown, filePath: string): unknown {
  if (isResolvedReferenceNode(obj)) {
    const anchor =
      "anchor" in obj && typeof obj.anchor === "string"
        ? obj.anchor
        : undefined;
    return new Reference(obj.path, {
      location: filePath,
      anchor,
    });
  }

  if (isResolvedReferenceAllNode(obj)) {
    const anchor =
      "anchor" in obj && typeof obj.anchor === "string"
        ? obj.anchor
        : undefined;
    return new ReferenceAll(obj.glob, {
      location: filePath,
      anchor,
    });
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
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processParsedDocument(value, filePath);
    }
    return result;
  }

  return obj;
}
