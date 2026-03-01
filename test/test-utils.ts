/**
 * Test utilities for yaml-reference-ts
 */

import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(): Promise<string> {
  const tempDir = path.join(
    tmpdir(),
    `yaml-ref-test-${Date.now()}-${Math.random().toString(36).substring(2)}`,
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Create a test YAML file in the specified directory
 */
export async function createTestYamlFile(
  dir: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Mock file system for unit tests
 */
export interface MockFile {
  path: string;
  content: string;
}

/**
 * Create a mock file system for testing
 */
export function createMockFileSystem(files: MockFile[]): {
  readFile: jest.Mock;
  readFileSync: jest.Mock;
  access: jest.Mock;
  mkdir: jest.Mock;
  rm: jest.Mock;
} {
  const fileMap = new Map(files.map((f) => [path.resolve(f.path), f.content]));

  return {
    readFile: jest.fn(async (filePath: string) => {
      const resolvedPath = path.resolve(filePath);
      const content = fileMap.get(resolvedPath);
      if (content === undefined) {
        throw new Error(
          `ENOENT: no such file or directory, open '${filePath}'`,
        );
      }
      return content;
    }),

    readFileSync: jest.fn((filePath: string) => {
      const resolvedPath = path.resolve(filePath);
      const content = fileMap.get(resolvedPath);
      if (content === undefined) {
        throw new Error(
          `ENOENT: no such file or directory, open '${filePath}'`,
        );
      }
      return content;
    }),

    access: jest.fn(async (filePath: string) => {
      const resolvedPath = path.resolve(filePath);
      if (!fileMap.has(resolvedPath)) {
        throw new Error(
          `ENOENT: no such file or directory, access '${filePath}'`,
        );
      }
    }),

    mkdir: jest.fn(async () => undefined),
    rm: jest.fn(async () => undefined),
  };
}

/**
 * Assert that two objects are deeply equal, ignoring key order
 */
export function expectDeepEqual(actual: any, expected: any): void {
  expect(JSON.parse(JSON.stringify(actual))).toEqual(
    JSON.parse(JSON.stringify(expected)),
  );
}

/**
 * Wait for a specified time (useful for async tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
