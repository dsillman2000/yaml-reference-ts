/**
 * File cache module for memoizing file parsing operations
 * Provides caching for parsed YAML files to reduce redundant file I/O and parsing
 * Cache is scoped to a single resolution operation lifecycle
 */

/**
 * File cache for memoizing parsed YAML content during a single resolution operation
 * Keys are based on file path and anchor (if any)
 */
export class FileCache {
  private cache = new Map<string, unknown>();

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
    return this.cache.get(keyString) as T | undefined;
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
  set(filePath: string, content: unknown, anchor?: string): void {
    const keyString = this.createCacheKeyString(filePath, anchor);
    this.cache.set(keyString, content);
  }

  /**
   * Store content in cache (async version for API consistency)
   */
  setAsync(filePath: string, content: unknown, anchor?: string): Promise<void> {
    this.set(filePath, content, anchor);
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
