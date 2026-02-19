/**
 * Resolver module for resolving !reference and !reference-all tags
 * Handles recursive resolution of references with proper path tracking
 */

import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { glob, globSync } from "glob";
import { Reference } from "./Reference";
import { ReferenceAll } from "./ReferenceAll";
import { Flatten } from "./Flatten";
import { parseYamlWithReferences, parseYamlWithReferencesSync } from "./parser";

/**
 * Normalize allowPaths to always include the parent directory of filePath
 */
function normalizeAllowPaths(
  filePath: string,
  allowPaths?: string[],
): string[] {
  const parentDir = path.dirname(path.resolve(filePath));
  const normalizedPaths: string[] = [];

  // Add parent directory first
  normalizedPaths.push(parentDir);

  // Add any provided allowPaths that aren't already included
  if (allowPaths && allowPaths.length > 0) {
    for (const allowedPath of allowPaths) {
      const resolvedAllowedPath = path.resolve(allowedPath);
      if (!normalizedPaths.includes(resolvedAllowedPath)) {
        normalizedPaths.push(resolvedAllowedPath);
      }
    }
  }

  return normalizedPaths;
}

/**
 * Recursively flatten all arrays in an object
 * @param obj - Object that may contain nested arrays
 * @returns Object with all arrays flattened
 */
export function flattenSequences(obj: any): any {
  if (Array.isArray(obj)) {
    const flattened: any[] = [];
    for (const item of obj) {
      const flattenedItem = flattenSequences(item);
      if (Array.isArray(flattenedItem)) {
        flattened.push(...flattenedItem);
      } else {
        flattened.push(flattenedItem);
      }
    }
    return flattened;
  }

  if (obj && typeof obj === "object") {
    if (obj instanceof Flatten) {
      // Flatten the sequence inside the Flatten object
      return flattenSequences(obj.sequence);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = flattenSequences(value);
    }
    return result;
  }

  return obj;
}

/**
 * Load a YAML file containing references and resolve all references. (async)
 * @param filePath - Path to YAML file containing references
 * @param allowPaths - Optional list of allowed paths for references
 * @returns Resolved object with all references resolved
 */
export async function loadAndResolve(
  filePath: string,
  allowPaths?: string[],
): Promise<any> {
  const parsed = await parseYamlWithReferences(filePath);
  const normalizedAllowPaths = normalizeAllowPaths(filePath, allowPaths);
  const resolved = await _recursivelyResolveReferences(
    parsed,
    new Set<string>(),
    normalizedAllowPaths,
  );
  return flattenSequences(resolved);
}

/**
 * Load a YAML file containing references and resolve all references.
 * @param filePath - Path to YAML file containing references
 * @param allowPaths - Optional list of allowed paths for references
 * @returns Resolved object with all references resolved
 */
export function loadAndResolveSync(
  filePath: string,
  allowPaths?: string[],
): any {
  const parsed = parseYamlWithReferencesSync(filePath);
  const normalizedAllowPaths = normalizeAllowPaths(filePath, allowPaths);
  const resolved = _recursivelyResolveReferencesSync(
    parsed,
    new Set<string>(),
    normalizedAllowPaths,
  );
  return flattenSequences(resolved);
}

/**
 * Recursively resolve all references in an object (async)
 * @param obj - Object that may contain Reference or ReferenceAll instances
 * @param visitedPaths - Set of visited file paths to detect circular references
 * @param allowPaths - Optional list of allowed paths for references
 * @returns Object with all references resolved
 */
export async function _recursivelyResolveReferences(
  obj: any,
  visitedPaths: Set<string> = new Set(),
  allowPaths?: string[],
): Promise<any> {
  if (obj instanceof Reference) {
    return await resolveReference(obj, visitedPaths, allowPaths);
  }

  if (obj instanceof ReferenceAll) {
    return await resolveReferenceAll(obj, visitedPaths, allowPaths);
  }

  if (obj instanceof Flatten) {
    // Resolve references within the sequence first, then flatten will be applied later
    const resolvedSequence = [];
    for (const item of obj.sequence) {
      resolvedSequence.push(
        await _recursivelyResolveReferences(item, visitedPaths, allowPaths),
      );
    }
    return new Flatten(resolvedSequence);
  }

  if (Array.isArray(obj)) {
    const resolvedArray = [];
    for (const item of obj) {
      resolvedArray.push(
        await _recursivelyResolveReferences(item, visitedPaths, allowPaths),
      );
    }
    return resolvedArray;
  }

  if (obj && typeof obj === "object") {
    const resolvedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolvedObj[key] = await _recursivelyResolveReferences(
        value,
        visitedPaths,
        allowPaths,
      );
    }
    return resolvedObj;
  }

  return obj;
}

/**
 * Recursively resolve all references in an object
 * @param obj - Object that may contain Reference or ReferenceAll instances
 * @param visitedPaths - Set of visited file paths to detect circular references
 * @param allowPaths - Optional list of allowed paths for references
 * @returns Object with all references resolved
 */
export function _recursivelyResolveReferencesSync(
  obj: any,
  visitedPaths: Set<string> = new Set(),
  allowPaths?: string[],
): any {
  if (obj instanceof Reference) {
    return resolveReferenceSync(obj, visitedPaths, allowPaths);
  }

  if (obj instanceof ReferenceAll) {
    return resolveReferenceAllSync(obj, visitedPaths, allowPaths);
  }

  if (obj instanceof Flatten) {
    // Resolve references within the sequence first, then flatten will be applied later
    const resolvedSequence = [];
    for (const item of obj.sequence) {
      resolvedSequence.push(
        _recursivelyResolveReferencesSync(item, visitedPaths, allowPaths),
      );
    }
    return new Flatten(resolvedSequence);
  }

  if (Array.isArray(obj)) {
    const resolvedArray = [];
    for (const item of obj) {
      resolvedArray.push(
        _recursivelyResolveReferencesSync(item, visitedPaths, allowPaths),
      );
    }
    return resolvedArray;
  }

  if (obj && typeof obj === "object") {
    const resolvedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolvedObj[key] = _recursivelyResolveReferencesSync(
        value,
        visitedPaths,
        allowPaths,
      );
    }
    return resolvedObj;
  }

  return obj;
}

/**
 * Resolve a single Reference object (async)
 * @param ref Reference object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @param allowPaths Optional list of allowed paths for references
 * @returns Resolved object. Will not contain any references.
 * @throws Error if circular reference is detected, or if a reference cannot be resolved
 */
async function resolveReference(
  ref: Reference,
  visitedPaths: Set<string>,
  allowPaths?: string[],
): Promise<any> {
  if (!ref._location) {
    throw new Error(`Reference missing _location: ${ref.toString()}`);
  }

  const refDir = path.dirname(ref._location);
  const targetPath = path.resolve(refDir, ref.path);

  // Check if path is allowed
  if (allowPaths && allowPaths.length > 0) {
    const isAllowed = allowPaths.some((allowedPath) => {
      const resolvedAllowedPath = path.resolve(allowedPath);
      const resolvedTargetPath = path.resolve(targetPath);
      return resolvedTargetPath.startsWith(resolvedAllowedPath);
    });

    if (!isAllowed) {
      throw new Error(
        `Reference to ${targetPath} is not allowed. Allowed paths: ${allowPaths.join(", ")}`,
      );
    }
  }

  // Check for circular references
  if (visitedPaths.has(targetPath)) {
    throw new Error(
      `Circular reference detected: ${targetPath} (visited: ${Array.from(visitedPaths).join(" -> ")})`,
    );
  }

  // Add to visited paths
  visitedPaths.add(targetPath);

  try {
    // Check if file exists
    await fs.access(targetPath);
  } catch (error) {
    throw new Error(
      `Referenced file not found: ${targetPath} (from ${ref._location})`,
    );
  }

  // Load and parse the referenced file
  const parsed = await parseYamlWithReferences(targetPath);

  // Recursively resolve references in the parsed content
  const resolved = await _recursivelyResolveReferences(
    parsed,
    visitedPaths,
    allowPaths,
  );

  // Remove from visited paths after resolution
  visitedPaths.delete(targetPath);

  return resolved;
}

/**
 * Resolve a single Reference object
 * @param ref Reference object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @param allowPaths Optional list of allowed paths for references
 * @returns Resolved object. Will not contain any references.
 * @throws Error if circular reference is detected, or if a reference cannot be resolved
 */
function resolveReferenceSync(
  ref: Reference,
  visitedPaths: Set<string>,
  allowPaths?: string[],
): any {
  if (!ref._location) {
    throw new Error(`Reference missing _location: ${ref.toString()}`);
  }

  const refDir = path.dirname(ref._location);
  const targetPath = path.resolve(refDir, ref.path);

  // Check if path is allowed
  if (allowPaths && allowPaths.length > 0) {
    const isAllowed = allowPaths.some((allowedPath) => {
      const resolvedAllowedPath = path.resolve(allowedPath);
      const resolvedTargetPath = path.resolve(targetPath);
      return resolvedTargetPath.startsWith(resolvedAllowedPath);
    });

    if (!isAllowed) {
      throw new Error(
        `Reference to ${targetPath} is not allowed. Allowed paths: ${allowPaths.join(", ")}`,
      );
    }
  }

  // Check for circular references
  if (visitedPaths.has(targetPath)) {
    throw new Error(
      `Circular reference detected: ${targetPath} (visited: ${Array.from(visitedPaths).join(" -> ")})`,
    );
  }

  // Add to visited paths
  visitedPaths.add(targetPath);

  try {
    // Check if file exists
    fsSync.accessSync(targetPath);
  } catch (error) {
    throw new Error(
      `Referenced file not found: ${targetPath} (from ${ref._location})`,
    );
  }

  // Load and parse the referenced file
  const parsed = parseYamlWithReferencesSync(targetPath);

  // Recursively resolve references in the parsed content
  const resolved = _recursivelyResolveReferencesSync(
    parsed,
    visitedPaths,
    allowPaths,
  );

  // Remove from visited paths after resolution
  visitedPaths.delete(targetPath);

  return resolved;
}

/**
 * Resolve a ReferenceAll object (async)
 * @param refAll ReferenceAll object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @param allowPaths Optional list of allowed paths for references
 * @returns Resolved array of objects. Will not contain any references.
 * @throws Error if the ReferenceAll object is missing _location or if the glob pattern is invalid.
 */
async function resolveReferenceAll(
  refAll: ReferenceAll,
  visitedPaths: Set<string>,
  allowPaths?: string[],
): Promise<any[]> {
  if (!refAll._location) {
    throw new Error(`ReferenceAll missing _location: ${refAll.toString()}`);
  }

  const refDir = path.dirname(refAll._location);
  const globPattern = path.resolve(refDir, refAll.glob);

  // Find files matching the glob pattern
  let matchingFiles: string[];
  try {
    matchingFiles = await glob(globPattern, { absolute: true });
  } catch (error) {
    throw new Error(
      `Invalid glob pattern: ${globPattern} (from ${refAll._location})`,
    );
  }

  // Filter to only include YAML files
  matchingFiles = matchingFiles.filter(
    (file) => file.endsWith(".yaml") || file.endsWith(".yml"),
  );

  // Filter by allowed paths if specified
  if (allowPaths && allowPaths.length > 0) {
    matchingFiles = matchingFiles.filter((filePath) => {
      const resolvedFilePath = path.resolve(filePath);
      return allowPaths.some((allowedPath) => {
        const resolvedAllowedPath = path.resolve(allowedPath);
        return resolvedFilePath.startsWith(resolvedAllowedPath);
      });
    });
  }

  if (matchingFiles.length === 0) {
    throw new Error(
      `No YAML files found matching glob pattern: ${globPattern} (from ${refAll._location})`,
    );
  }

  // Sort files alphabetically for consistent ordering
  matchingFiles.sort();

  // Resolve each matching file
  const resolvedContents: any[] = [];
  for (const filePath of matchingFiles) {
    // Check for circular references
    if (visitedPaths.has(filePath)) {
      throw new Error(
        `Circular reference detected: ${filePath} (visited: ${Array.from(visitedPaths).join(" -> ")})`,
      );
    }

    visitedPaths.add(filePath);

    try {
      // Load and parse the file
      const parsed = await parseYamlWithReferences(filePath);

      // Recursively resolve references
      const resolved = await _recursivelyResolveReferences(
        parsed,
        visitedPaths,
        allowPaths,
      );
      resolvedContents.push(resolved);
    } catch (error) {
      // Remove from visited paths on error
      visitedPaths.delete(filePath);
      throw error;
    }

    visitedPaths.delete(filePath);
  }

  return resolvedContents;
}

/**
 * Resolve a ReferenceAll object
 * @param refAll ReferenceAll object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @param allowPaths Optional list of allowed paths for references
 * @returns Resolved array of objects. Will not contain any references.
 * @throws Error if the ReferenceAll object is missing _location or if the glob pattern is invalid.
 */
function resolveReferenceAllSync(
  refAll: ReferenceAll,
  visitedPaths: Set<string>,
  allowPaths?: string[],
): any[] {
  if (!refAll._location) {
    throw new Error(`ReferenceAll missing _location: ${refAll.toString()}`);
  }

  const refDir = path.dirname(refAll._location);
  const globPattern = path.resolve(refDir, refAll.glob);

  // Find files matching the glob pattern
  let matchingFiles: string[];
  try {
    matchingFiles = globSync(globPattern, { absolute: true });
  } catch (error) {
    throw new Error(
      `Invalid glob pattern: ${globPattern} (from ${refAll._location})`,
    );
  }

  // Filter to only include YAML files
  matchingFiles = matchingFiles.filter(
    (file) => file.endsWith(".yaml") || file.endsWith(".yml"),
  );

  // Filter by allowed paths if specified
  if (allowPaths && allowPaths.length > 0) {
    matchingFiles = matchingFiles.filter((filePath) => {
      const resolvedFilePath = path.resolve(filePath);
      return allowPaths.some((allowedPath) => {
        const resolvedAllowedPath = path.resolve(allowedPath);
        return resolvedFilePath.startsWith(resolvedAllowedPath);
      });
    });
  }

  if (matchingFiles.length === 0) {
    throw new Error(
      `No YAML files found matching glob pattern: ${globPattern} (from ${refAll._location})`,
    );
  }

  // Sort files alphabetically for consistent ordering
  matchingFiles.sort();

  // Resolve each matching file
  const resolvedContents: any[] = [];
  for (const filePath of matchingFiles) {
    // Check for circular references
    if (visitedPaths.has(filePath)) {
      throw new Error(
        `Circular reference detected: ${filePath} (visited: ${Array.from(visitedPaths).join(" -> ")})`,
      );
    }

    visitedPaths.add(filePath);

    try {
      // Load and parse the file
      const parsed = parseYamlWithReferencesSync(filePath);

      // Recursively resolve references
      const resolved = _recursivelyResolveReferencesSync(
        parsed,
        visitedPaths,
        allowPaths,
      );
      resolvedContents.push(resolved);
    } catch (error) {
      // Remove from visited paths on error
      visitedPaths.delete(filePath);
      throw error;
    }

    visitedPaths.delete(filePath);
  }

  return resolvedContents;
}
