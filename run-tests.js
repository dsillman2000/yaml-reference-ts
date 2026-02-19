#!/usr/bin/env node

/**
 * Simple test runner for yaml-reference-ts
 * Runs tests and provides detailed output
 */

const { spawn } = require("child_process");
const path = require("path");

console.log("Running yaml-reference-ts tests...\n");

// Run Jest with detailed output
const jestProcess = spawn("npx", ["jest", "--verbose", "--no-coverage"], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname,
});

jestProcess.on("close", (code) => {
  console.log(`\nJest exited with code ${code}`);

  if (code === 0) {
    console.log("\n✅ All tests passed!");
  } else {
    console.log("\n❌ Tests failed");

    // Try to run TypeScript compiler to check for compilation errors
    console.log("\nChecking for TypeScript compilation errors...");
    const tscProcess = spawn(
      "npx",
      ["tsc", "--noEmit", "-p", "tsconfig.jest.json"],
      {
        stdio: "inherit",
        shell: true,
        cwd: __dirname,
      },
    );

    tscProcess.on("close", (tscCode) => {
      if (tscCode !== 0) {
        console.log("\n⚠️  TypeScript compilation errors found");
        console.log("Try running: npx tsc --noEmit -p tsconfig.jest.json");
      }
      process.exit(code);
    });
  }
});

jestProcess.on("error", (error) => {
  console.error("Failed to run tests:", error.message);
  console.log("\nTrying alternative approach...");

  // Try running tests directly with node
  const testFiles = [
    "__tests__/parser.test.ts",
    "__tests__/resolver.test.ts",
    "__tests__/cli.test.ts",
  ];

  let hasErrors = false;

  testFiles.forEach((testFile) => {
    console.log(`\nChecking ${testFile}...`);
    try {
      // Just check if the file can be parsed
      require("ts-node/register");
      require(path.join(__dirname, testFile));
      console.log(`  ✅ ${testFile} can be loaded`);
    } catch (error) {
      console.log(`  ❌ ${testFile} error: ${error.message}`);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.log("\n❌ Test files have errors");
    process.exit(1);
  } else {
    console.log("\n✅ Test files can be loaded");
    console.log("\nTry running: npm test -- --verbose");
    process.exit(0);
  }
});
