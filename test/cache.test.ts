/**
 * Cache tests for yaml-reference-ts
 */

import { FileCache } from "../src/cache";

describe("FileCache", () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache();
  });

  describe("basic cache operations", () => {
    it("should store and retrieve cached content", () => {
      const filePath = "/path/to/file.yaml";
      const content = { test: "data" };

      cache.set(filePath, content);
      const retrieved = cache.get(filePath);

      expect(retrieved).toEqual(content);
    });

    it("should store and retrieve content with anchor", () => {
      const filePath = "/path/to/file.yaml";
      const content = { test: "data" };
      const anchor = "myanchor";

      cache.set(filePath, content, anchor);
      const retrieved = cache.get(filePath, anchor);

      expect(retrieved).toEqual(content);
    });

    it("should return undefined for cache miss", () => {
      const retrieved = cache.get("/nonexistent/file.yaml");
      expect(retrieved).toBeUndefined();
    });

    it("should distinguish between same file with different anchors", () => {
      const filePath = "/path/to/file.yaml";
      const contentNoAnchor = { test: "no anchor" };
      const contentWithAnchor = { test: "with anchor" };

      cache.set(filePath, contentNoAnchor);
      cache.set(filePath, contentWithAnchor, "anchor");

      expect(cache.get(filePath)).toEqual(contentNoAnchor);
      expect(cache.get(filePath, "anchor")).toEqual(contentWithAnchor);
    });

    it("should distinguish between different anchors on same file", () => {
      const filePath = "/path/to/file.yaml";
      const content1 = { test: "anchor1" };
      const content2 = { test: "anchor2" };

      cache.set(filePath, content1, "anchor1");
      cache.set(filePath, content2, "anchor2");

      expect(cache.get(filePath, "anchor1")).toEqual(content1);
      expect(cache.get(filePath, "anchor2")).toEqual(content2);
    });

    it("should treat empty anchor and undefined anchor as same key", () => {
      const filePath = "/path/to/file.yaml";
      const content1 = { test: "first" };
      const content2 = { test: "second" };

      // Set with undefined anchor
      cache.set(filePath, content1);

      // Set with empty string anchor (should overwrite)
      cache.set(filePath, content2, "");

      // Both should return the second content since keys are the same
      expect(cache.get(filePath)).toEqual(content2);
      expect(cache.get(filePath, "")).toEqual(content2);
      expect(cache.size()).toBe(1); // Should be only 1 entry
    });
  });

  describe("async API", () => {
    it("should store and retrieve with async methods", async () => {
      const filePath = "/path/to/file.yaml";
      const content = { test: "async data" };

      await cache.setAsync(filePath, content);
      const retrieved = await cache.getAsync(filePath);

      expect(retrieved).toEqual(content);
    });

    it("should store and retrieve with anchor using async methods", async () => {
      const filePath = "/path/to/file.yaml";
      const content = { test: "async data with anchor" };
      const anchor = "asyncanchor";

      await cache.setAsync(filePath, content, anchor);
      const retrieved = await cache.getAsync(filePath, anchor);

      expect(retrieved).toEqual(content);
    });

    it("should return undefined for async cache miss", async () => {
      const retrieved = await cache.getAsync("/nonexistent/async.yaml");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("cache management", () => {
    it("should report correct cache size", () => {
      expect(cache.size()).toBe(0);

      cache.set("/file1.yaml", { test: 1 });
      expect(cache.size()).toBe(1);

      cache.set("/file2.yaml", { test: 2 });
      expect(cache.size()).toBe(2);

      cache.set("/file1.yaml", { test: 3 }, "anchor");
      expect(cache.size()).toBe(3);
    });

    it("should clear all cached entries", () => {
      cache.set("/file1.yaml", { test: 1 });
      cache.set("/file2.yaml", { test: 2 });
      cache.set("/file1.yaml", { test: 3 }, "anchor");

      expect(cache.size()).toBe(3);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get("/file1.yaml")).toBeUndefined();
      expect(cache.get("/file2.yaml")).toBeUndefined();
      expect(cache.get("/file1.yaml", "anchor")).toBeUndefined();
    });

    it("should overwrite existing cache entries with same key", () => {
      const filePath = "/path/to/file.yaml";
      const originalContent = { test: "original" };
      const updatedContent = { test: "updated" };

      cache.set(filePath, originalContent);
      expect(cache.get(filePath)).toEqual(originalContent);

      cache.set(filePath, updatedContent);
      expect(cache.get(filePath)).toEqual(updatedContent);
      expect(cache.size()).toBe(1); // Should still be 1, not 2
    });
  });

  describe("content types", () => {
    it("should cache null values", () => {
      const filePath = "/null.yaml";
      cache.set(filePath, null);
      expect(cache.get(filePath)).toBeNull();
    });

    it("should cache undefined values", () => {
      const filePath = "/undefined.yaml";
      cache.set(filePath, undefined);
      expect(cache.get(filePath)).toBeUndefined();
    });

    it("should cache primitive values", () => {
      cache.set("/string.yaml", "hello");
      cache.set("/number.yaml", 42);
      cache.set("/boolean.yaml", true);

      expect(cache.get("/string.yaml")).toBe("hello");
      expect(cache.get("/number.yaml")).toBe(42);
      expect(cache.get("/boolean.yaml")).toBe(true);
    });

    it("should cache arrays", () => {
      const arrayContent = [1, 2, { nested: "value" }];
      cache.set("/array.yaml", arrayContent);
      expect(cache.get("/array.yaml")).toEqual(arrayContent);
    });

    it("should cache complex nested objects", () => {
      const complexContent = {
        level1: {
          level2: {
            level3: {
              data: "deep",
              array: [1, 2, 3],
              nullValue: null,
              boolean: false,
            },
          },
        },
      };

      cache.set("/complex.yaml", complexContent);
      expect(cache.get("/complex.yaml")).toEqual(complexContent);
    });
  });

  describe("edge cases", () => {
    it("should handle special characters in file paths", () => {
      const specialPaths = [
        "/path with spaces/file.yaml",
        "/path/with-dashes/file.yaml",
        "/path/with_underscores/file.yaml",
        "/path/with.dots/file.yaml",
        "/path/with@symbols/file.yaml",
      ];

      specialPaths.forEach((filePath, index) => {
        const content = { index };
        cache.set(filePath, content);
        expect(cache.get(filePath)).toEqual(content);
      });
    });

    it("should handle special characters in anchors", () => {
      const filePath = "/file.yaml";
      const specialAnchors = [
        "anchor-with-dashes",
        "anchor_with_underscores",
        "anchor.with.dots",
        "anchor with spaces",
        "anchor@with@symbols",
        "123numeric",
      ];

      specialAnchors.forEach((anchor, index) => {
        const content = { anchor, index };
        cache.set(filePath, content, anchor);
        expect(cache.get(filePath, anchor)).toEqual(content);
      });
    });

    it("should handle very long file paths and anchors", () => {
      const longPath = "/very/long/path/".repeat(50) + "file.yaml";
      const longAnchor = "very-long-anchor-name-".repeat(20);
      const content = { test: "long path and anchor" };

      cache.set(longPath, content, longAnchor);
      expect(cache.get(longPath, longAnchor)).toEqual(content);
    });
  });

  describe("key generation", () => {
    it("should create unique keys for different combinations", () => {
      // These should all be treated as different cache entries
      const scenarios = [
        ["/file.yaml", "anchor1"],
        ["/file.yaml", "anchor2"],
        ["/different.yaml", undefined],
        ["/file.yaml|", "anchor"], // Path that ends with separator
        ["/file.yaml|anchor", undefined], // Path that looks like it has an anchor
      ];

      scenarios.forEach(([path, anchor], index) => {
        const content = { scenario: index };
        cache.set(path as string, content, anchor as string | undefined);
      });

      // All should be retrievable independently
      scenarios.forEach(([path, anchor], index) => {
        const retrieved = cache.get(
          path as string,
          anchor as string | undefined,
        );
        expect(retrieved).toEqual({ scenario: index });
      });

      expect(cache.size()).toBe(scenarios.length);
    });

    it("should handle undefined and empty string anchors as same key", () => {
      const filePath = "/same.yaml";

      // Set with undefined anchor
      cache.set(filePath, { first: true });
      expect(cache.size()).toBe(1);

      // Set with empty string anchor (should overwrite)
      cache.set(filePath, { second: true }, "");
      expect(cache.size()).toBe(1); // Still 1 entry

      // Both ways of accessing should return the same content
      expect(cache.get(filePath)).toEqual({ second: true });
      expect(cache.get(filePath, "")).toEqual({ second: true });
    });
  });
});
