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
import { isResolvedIgnoreNode, IgnoreTags } from "./Ignore";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";

// Custom tags array for parsing
const customTags: Tags = [
  ...referenceTags,
  ...ReferenceAllTags,
  ...FlattenTags,
  ...MergeTags,
  ...IgnoreTags,
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

  // Count object occurrences to detect aliasing (shared references). We use
  // this to decide whether an !ignore value should be erased (unique
  // occurrence) or turned into `null` (aliased elsewhere).
  const counts = new WeakMap<object, number>();
  const seenFlagged = new WeakSet<object>();
  (function buildCounts(node: unknown) {
    if (node && typeof node === "object") {
      // count occurrences for object identity
      const existing = counts.get(node) ?? 0;
      counts.set(node, existing + 1);
      if (Array.isArray(node)) {
        for (const item of node) buildCounts(item);
      } else {
        for (const v of Object.values(node as Record<string, unknown>)) {
          buildCounts(v);
        }
      }
    }
  })(parsed);

  const processed = processParsedDocument(
    parsed,
    filePath,
    counts,
    seenFlagged,
  );

  // If the top-level was erased by !ignore, represent as `null` per spec.
  return processed === undefined ? null : processed;
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
type Context = "root" | "mapValue" | "arrayItem";

function processParsedDocument(
  obj: unknown,
  filePath: string,
  counts?: WeakMap<object, number>,
  seenFlagged?: WeakSet<object>,
  context: Context = "root",
): unknown {
  // If this node is a resolved !ignore marker, decide whether to erase it or
  // return `null` depending on whether it was aliased elsewhere. We use the
  // occurrence counts to detect aliasing: a count > 1 implies an alias exists
  // somewhere else and we must materialize `null` at this location.
  if (isResolvedIgnoreNode(obj)) {
    if (obj && typeof obj === "object") {
      const count = counts?.get(obj) ?? 0;
      // Unique occurrence -> erase
      if (count <= 1) return undefined;

      // Aliased occurrences: decide based on context
      if (context === "root") {
        return null;
      }
      if (context === "mapValue") {
        // When appearing as a mapping value and aliased elsewhere, produce null
        return null;
      }
      if (context === "arrayItem") {
        // For array items prefer to erase the first occurrence and null for
        // subsequent alias occurrences.
        if (!seenFlagged) return undefined;
        if (!seenFlagged.has(obj)) {
          seenFlagged.add(obj);
          return undefined;
        }
        return null;
      }
    }
    return undefined;
  }

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
    const out: unknown[] = [];
    for (const item of obj) {
      const v = processParsedDocument(
        item,
        filePath,
        counts,
        seenFlagged,
        "arrayItem",
      );
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const v = processParsedDocument(
        value,
        filePath,
        counts,
        seenFlagged,
        "mapValue",
      );
      if (v !== undefined) {
        result[key] = v;
      }
    }
    return result;
  }

  return obj;
}
