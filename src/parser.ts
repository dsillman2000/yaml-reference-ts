/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { Document, Node, parseAllDocuments, Tags, visit } from "yaml";
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

function parseDocumentWithReferences(
  doc: Document.Parsed,
  filePath: string,
  options?: ParseOptions,
): unknown {
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

  const processed = processParsedDocument(parsed, filePath);

  const rootTag = doc.contents.tag;
  if (rootTag === "!ignore" && options?.extractAnchor === undefined) {
    return undefined;
  }

  return processed;
}

/**
 * Parse every document in a (possibly multi-document) YAML string. Documents
 * whose root is tagged !ignore are returned as undefined so that callers can
 * still tell how many documents the source contained.
 */
function parseYamlDocumentsWithReferencesFromString(
  content: string,
  filePath: string,
  options?: ParseOptions,
): unknown[] {
  const docs = parseAllDocuments(content, { customTags });
  return docs.map((doc) => parseDocumentWithReferences(doc, filePath, options));
}

/**
 * Collapse a list of parsed documents into a single value: single-document
 * files yield their document, and multi-document files yield an array of their
 * non-ignored documents.
 */
function collapseDocuments(documents: unknown[]): unknown {
  if (documents.length === 0) {
    return null;
  }
  if (documents.length === 1) {
    return documents[0];
  }
  return documents.filter((doc) => doc !== undefined);
}

/**
 * Parse every document in a YAML file with custom !reference and
 * !reference-all tags. Documents whose root is tagged !ignore are returned as
 * undefined.
 * @param filePath - Path to the YAML file to be parsed (used for setting
 * location)
 * @param options - Optional parsing options (e.g. extractAnchor to specify an
 * anchor to extract as root of each document)
 * @returns One parsed value per document in the file
 */
export function parseYamlDocumentsWithReferencesSync(
  filePath: string,
  options?: ParseOptions,
): unknown[] {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fsSync.readFileSync(absolutePath, "utf8");
    return parseYamlDocumentsWithReferencesFromString(
      content,
      absolutePath,
      options,
    );
  } catch (error) {
    // Re-throw the error with context about which file failed to parse
    throw new Error(
      `Failed to parse YAML file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

/**
 * Parse every document in a YAML file with custom !reference and
 * !reference-all tags (async). Documents whose root is tagged !ignore are
 * returned as undefined.
 * @param filePath - Path to the YAML file to be parsed (used for setting
 * location)
 * @param options - Optional parsing options (e.g. extractAnchor to specify an
 * anchor to extract as root of each document)
 * @returns One parsed value per document in the file
 */
export async function parseYamlDocumentsWithReferences(
  filePath: string,
  options?: ParseOptions,
): Promise<unknown[]> {
  try {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, "utf8");
    return parseYamlDocumentsWithReferencesFromString(
      content,
      absolutePath,
      options,
    );
  } catch (error) {
    // Re-throw the error with context about which file failed to parse
    throw new Error(
      `Failed to parse YAML file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

/**
 * Parse YAML content with custom !reference and !reference-all tags. A
 * multi-document file is parsed as an array of its documents, excluding any
 * whose root is tagged !ignore.
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
  return collapseDocuments(
    parseYamlDocumentsWithReferencesSync(filePath, options),
  );
}

/**
 * Parse YAML content with custom !reference and !reference-all tags (async). A
 * multi-document file is parsed as an array of its documents, excluding any
 * whose root is tagged !ignore.
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
  return collapseDocuments(
    await parseYamlDocumentsWithReferences(filePath, options),
  );
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
  // Always-drop: if this node is an !ignore marker, erase it from the
  // output unconditionally (return undefined). Anchors defined inside
  // ignored nodes are still discoverable via AST-level extraction.
  if (isResolvedIgnoreNode(obj)) {
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
    const processed = obj
      .map((item) => processParsedDocument(item, filePath))
      .filter((v) => v !== undefined);
    return new Flatten(processed);
  }

  if (isResolvedMergeNode(obj)) {
    const processed = obj
      .map((item) => processParsedDocument(item, filePath))
      .filter((v) => v !== undefined);
    return new Merge(processed);
  }

  if (Array.isArray(obj)) {
    const out: unknown[] = [];
    for (const item of obj) {
      const v = processParsedDocument(item, filePath);
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const v = processParsedDocument(value, filePath);
      if (v !== undefined) {
        result[key] = v;
      }
    }
    return result;
  }

  return obj;
}
