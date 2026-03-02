/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { Document, Node, parseDocument, Tags, visit } from "yaml";
import { isResolvedReferenceNode, Reference, referenceTags } from "./Reference";
import {
  isResolvedReferenceAllNode,
  ReferenceAll,
  ReferenceAllTags,
} from "./ReferenceAll";
import { Flatten, isResolvedFlattenNode, FlattenTags } from "./Flatten";
import { Merge, isResolvedMergeNode, MergeTags } from "./Merge";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";

// Custom tags array for parsing
const customTags: Tags = [
  ...referenceTags,
  ...ReferenceAllTags,
  ...FlattenTags,
  ...MergeTags,
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
    return parseYamlWithReferencesFromString(content, absolutePath, options);
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
    return parseYamlWithReferencesFromString(content, absolutePath, options);
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
