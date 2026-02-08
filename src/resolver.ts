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
import { parseYamlWithReferences, parseYamlWithReferencesSync } from "./parser";

/**
 * Load a YAML file containing references and resolve all references. (async)
 * @param filePath - Path to YAML file containing references
 * @returns Resolved object with all references resolved
 */
export async function loadAndResolve(filePath: string): Promise<any> {
    const parsed = await parseYamlWithReferences(filePath);
    return await _recursivelyResolveReferences(parsed, new Set<string>());
}

/**
 * Load a YAML file containing references and resolve all references.
 * @param filePath - Path to YAML file containing references
 * @returns Resolved object with all references resolved
 */
export function loadAndResolveSync(filePath: string): any {
    const parsed = parseYamlWithReferencesSync(filePath);
    return _recursivelyResolveReferencesSync(parsed, new Set<string>());
}

/**
 * Recursively resolve all references in an object (async)
 * @param obj - Object that may contain Reference or ReferenceAll instances
 * @param visitedPaths - Set of visited file paths to detect circular references
 * @returns Object with all references resolved
 */
export async function _recursivelyResolveReferences(
    obj: any,
    visitedPaths: Set<string> = new Set(),
): Promise<any> {
    if (obj instanceof Reference) {
        return await resolveReference(obj, visitedPaths);
    }

    if (obj instanceof ReferenceAll) {
        return await resolveReferenceAll(obj, visitedPaths);
    }

    if (Array.isArray(obj)) {
        const resolvedArray = [];
        for (const item of obj) {
            resolvedArray.push(
                await _recursivelyResolveReferences(item, visitedPaths),
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
 * @returns Object with all references resolved
 */
export function _recursivelyResolveReferencesSync(
    obj: any,
    visitedPaths: Set<string> = new Set(),
): any {
    if (obj instanceof Reference) {
        return resolveReferenceSync(obj, visitedPaths);
    }

    if (obj instanceof ReferenceAll) {
        return resolveReferenceAllSync(obj, visitedPaths);
    }

    if (Array.isArray(obj)) {
        const resolvedArray = [];
        for (const item of obj) {
            resolvedArray.push(
                _recursivelyResolveReferencesSync(item, visitedPaths),
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
 * @returns Resolved object. Will not contain any references.
 * @throws Error if circular reference is detected, or if a reference cannot be resolved
 */
async function resolveReference(
    ref: Reference,
    visitedPaths: Set<string>,
): Promise<any> {
    if (!ref._location) {
        throw new Error(`Reference missing _location: ${ref.toString()}`);
    }

    const refDir = path.dirname(ref._location);
    const targetPath = path.resolve(refDir, ref.path);

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
    const resolved = await _recursivelyResolveReferences(parsed, visitedPaths);

    // Remove from visited paths after resolution
    visitedPaths.delete(targetPath);

    return resolved;
}

/**
 * Resolve a single Reference object
 * @param ref Reference object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @returns Resolved object. Will not contain any references.
 * @throws Error if circular reference is detected, or if a reference cannot be resolved
 */
function resolveReferenceSync(ref: Reference, visitedPaths: Set<string>): any {
    if (!ref._location) {
        throw new Error(`Reference missing _location: ${ref.toString()}`);
    }

    const refDir = path.dirname(ref._location);
    const targetPath = path.resolve(refDir, ref.path);

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
    const resolved = _recursivelyResolveReferencesSync(parsed, visitedPaths);

    // Remove from visited paths after resolution
    visitedPaths.delete(targetPath);

    return resolved;
}

/**
 * Resolve a ReferenceAll object (async)
 * @param refAll ReferenceAll object to resolve
 * @param visitedPaths Set of visited paths to detect circular references
 * @returns Resolved array of objects. Will not contain any references.
 * @throws Error if the ReferenceAll object is missing _location or if the glob pattern is invalid.
 */
async function resolveReferenceAll(
    refAll: ReferenceAll,
    visitedPaths: Set<string>,
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
 * @returns Resolved array of objects. Will not contain any references.
 * @throws Error if the ReferenceAll object is missing _location or if the glob pattern is invalid.
 */
function resolveReferenceAllSync(
    refAll: ReferenceAll,
    visitedPaths: Set<string>,
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
