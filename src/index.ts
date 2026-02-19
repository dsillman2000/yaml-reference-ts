/**
 * Main exports for yaml-reference-ts library
 */

export { Reference } from "./Reference";
export { ReferenceAll } from "./ReferenceAll";
export { Flatten } from "./Flatten";
export { Merge } from "./Merge";
import { loadAndResolve, loadAndResolveSync } from "./resolver";
export { parseYamlWithReferencesSync, parseYamlWithReferences } from "./parser";

/**
 * Convenience alias for loadAndResolve
 * @param filePath - Path to YAML file containing references
 * @returns Resolved object with all references resolved
 */
export async function loadYamlWithReferences(
  filePath: string,
  allowPaths?: string[],
): Promise<any> {
  return await loadAndResolve(filePath, allowPaths);
}

/**
 * Convenience alias for loadAndResolveSync
 * @param filePath - Path to YAML file containing references
 * @returns Resolved object with all references resolved
 */
export function loadYamlWithReferencesSync(
  filePath: string,
  allowPaths?: string[],
): any {
  return loadAndResolveSync(filePath, allowPaths);
}
