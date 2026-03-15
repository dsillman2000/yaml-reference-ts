/**
 * File cache module for memoizing file parsing operations
 * Provides caching for parsed YAML files to reduce redundant file I/O and parsing
 * Cache is scoped to a single resolution operation lifecycle
 */

interface CacheEntry {
  content: unknown;
  fileContent?: string; // Store original file content for anchor extraction optimization
}

/**
 * File cache for memoizing parsed YAML content during a single resolution operation
 * Keys are based on file path and anchor (if any)
 */
export class FileCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Generate a cache key string from file path and anchor
   */
  private createCacheKeyString(filePath: string, anchor?: string): string {
    return `${filePath}|${anchor || ""}`;
  }

  /**
   * Get cached content if available
   */
  get<T>(filePath: string, anchor?: string): T | undefined {
    const keyString = this.createCacheKeyString(filePath, anchor);
    const entry = this.cache.get(keyString);
    return entry?.content as T | undefined;
  }

  /**
   * Get cached file content for optimization purposes
   */
  getFileContent(filePath: string): string | undefined {
    const keyString = this.createCacheKeyString(filePath); // No anchor = whole file
    const entry = this.cache.get(keyString);
    return entry?.fileContent;
  }

  /**
   * Get cached content if available (async version for API consistency)
   */
  getAsync<T>(filePath: string, anchor?: string): Promise<T | undefined> {
    return Promise.resolve(this.get<T>(filePath, anchor));
  }

  /**
   * Store content in cache
   */
  set(
    filePath: string,
    content: unknown,
    anchor?: string,
    fileContent?: string,
  ): void {
    const keyString = this.createCacheKeyString(filePath, anchor);
    this.cache.set(keyString, { content, fileContent });

    // Optimization: If we have an anchor and fileContent, also store whole file for future anchor extraction
    if (anchor && fileContent) {
      const wholeFileKey = this.createCacheKeyString(filePath); // No anchor = whole file
      // Only store if whole file isn't already cached
      if (!this.cache.has(wholeFileKey)) {
        this.cache.set(wholeFileKey, { content, fileContent });
      }
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
    this.cache.clear();
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }
}
