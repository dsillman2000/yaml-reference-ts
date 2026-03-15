/**
 * File cache module for memoizing file parsing operations
 * Provides caching for parsed YAML files to reduce redundant file I/O and parsing
 * Cache is scoped to a single resolution operation lifecycle
 */

/**
 * File cache for memoizing parsed YAML content during a single resolution operation.
 * Uses a nested Map keyed first by filePath, then by anchor (undefined = whole file),
 * to avoid key-collision issues that arise from string concatenation with a separator.
 * Raw file contents are stored in a separate map so that anchor-specific entries
 * never overwrite the whole-file parsed result.
 */
export class FileCache {
  // Outer key: filePath, inner key: anchor (undefined = whole-file)
  private parsed = new Map<string, Map<string | undefined, unknown>>();
  // Stores raw file contents for reuse when only the anchor differs
  private fileContents = new Map<string, string>();

  /**
   * Normalize anchor so that empty string and undefined are treated identically.
   */
  private normalizeAnchor(anchor?: string): string | undefined {
    return anchor || undefined;
  }

  /**
   * Check if a cache entry exists for the given file path and anchor.
   * Returns true even when the cached value is undefined (distinguishes a
   * stored undefined from a cache miss).
   */
  has(filePath: string, anchor?: string): boolean {
    return (
      this.parsed.get(filePath)?.has(this.normalizeAnchor(anchor)) ?? false
    );
  }

  /**
   * Check if a cache entry exists (async version for API consistency)
   */
  hasAsync(filePath: string, anchor?: string): Promise<boolean> {
    return Promise.resolve(this.has(filePath, anchor));
  }

  /**
   * Get cached content if available
   */
  get<T>(filePath: string, anchor?: string): T | undefined {
    return this.parsed
      .get(filePath)
      ?.get(this.normalizeAnchor(anchor)) as T | undefined;
  }

  /**
   * Get cached file content for optimization purposes
   */
  getFileContent(filePath: string): string | undefined {
    return this.fileContents.get(filePath);
  }

  /**
   * Get cached content if available (async version for API consistency)
   */
  getAsync<T>(filePath: string, anchor?: string): Promise<T | undefined> {
    return Promise.resolve(this.get<T>(filePath, anchor));
  }

  /**
   * Store content in cache.
   * When `anchor` is provided together with `fileContent`, the raw file content
   * is stored for later reuse, but no whole-file parsed entry is created.
   * This prevents an anchor-scoped result from being returned when the full
   * document is requested later.
   */
  set(
    filePath: string,
    content: unknown,
    anchor?: string,
    fileContent?: string,
  ): void {
    const normalizedAnchor = this.normalizeAnchor(anchor);

    if (!this.parsed.has(filePath)) {
      this.parsed.set(filePath, new Map());
    }
    this.parsed.get(filePath)!.set(normalizedAnchor, content);

    // Store raw file content only — never store an anchor-specific parsed
    // result under the whole-file key, so a later get(filePath) (no anchor)
    // still yields a cache miss and triggers a fresh full-document parse.
    if (fileContent !== undefined && !this.fileContents.has(filePath)) {
      this.fileContents.set(filePath, fileContent);
    }
  }

  /**
   * Store content in cache (async version for API consistency)
   */
  setAsync(
    filePath: string,
    content: unknown,
    anchor?: string,
    fileContent?: string,
  ): Promise<void> {
    this.set(filePath, content, anchor, fileContent);
    return Promise.resolve();
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.parsed.clear();
    this.fileContents.clear();
  }

  /**
   * Get cache size (number of parsed entries)
   */
  size(): number {
    let count = 0;
    for (const innerMap of this.parsed.values()) {
      count += innerMap.size;
    }
    return count;
  }
}
