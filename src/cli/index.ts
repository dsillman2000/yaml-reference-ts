#!/usr/bin/env node

/**
 * CLI implementation for yaml-reference-ts
 * Reads YAML file with !reference and !reference-all tags, resolves references,
 * and outputs JSON to stdout with sorted keys and 2-space indentation
 */

import { loadAndResolve } from "../resolver";
import * as fs from "fs/promises";

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
YAML Reference Resolver CLI

Usage: yaml-reference-cli <file_path> [--allow <path1> --allow <path2>...]

Resolves !reference and !reference-all tags in YAML files and outputs
the resolved JSON to stdout.

Arguments:
  file_path    Path to YAML file containing references (required)
  allow_paths  Paths to allow references to (optional)

Options:
  -h, --help   Show this help message

Output:
  JSON with keys sorted alphabetically and 2-space indentation

Examples:
  yaml-reference-cli config.yaml
  yaml-reference-cli config.yaml | yq -P
  yaml-reference-cli config.yaml | yq -P > .compiled/config.yaml

Exit Codes:
  0 - Success
  1 - General error (file not found or not allowed, invalid YAML, circular reference, etc.)
`);
}

/**
 * Sort object keys alphabetically (recursively)
 */
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }

  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const sortedObj: any = {};
    // Get keys, sort them alphabetically
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sortedObj[key] = sortObjectKeys(obj[key]);
    }
    return sortedObj;
  }

  return obj;
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes("-h") || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  // Parse arguments
  let filePath: string | null = null;
  const allowPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--allow") {
      if (i + 1 >= args.length) {
        console.error("Error: --allow requires a path argument");
        console.error(
          "Usage: yaml-reference-cli <file_path> [--allow <path1> --allow <path2>...]",
        );
        console.error("Use -h or --help for more information");
        process.exit(1);
      }
      allowPaths.push(args[i + 1]);
      i++; // Skip the next argument since we consumed it
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      console.error("Use -h or --help for more information");
      process.exit(1);
    } else {
      if (filePath !== null) {
        console.error("Error: Multiple file paths provided");
        console.error(
          "Usage: yaml-reference-cli <file_path> [--allow <path1> --allow <path2>...]",
        );
        console.error("Use -h or --help for more information");
        process.exit(1);
      }
      filePath = arg;
    }
  }

  // Check for file path argument
  if (filePath === null) {
    console.error("Error: No file path provided");
    console.error(
      "Usage: yaml-reference-cli <file_path> [--allow <path1> --allow <path2>...]",
    );
    console.error("Use -h or --help for more information");
    process.exit(1);
  }

  try {
    // Check if file exists
    await fs.access(filePath);
  } catch (error) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    // Resolve references
    const resolved = await loadAndResolve(
      filePath,
      allowPaths.length > 0 ? allowPaths : undefined,
    );

    // Sort keys alphabetically
    const sorted = sortObjectKeys(resolved);

    // Output JSON with 2-space indentation
    console.log(JSON.stringify(sorted, null, 2));
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
