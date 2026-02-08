/**
 * Resolver tests for yaml-reference-ts
 */

import * as fs from "fs/promises";
import { loadYamlWithReferences, loadYamlWithReferencesSync } from "../src";
import {
    createTempDir,
    createTestYamlFile,
    cleanupTempDir,
} from "./test-utils";

describe("Resolver", () => {
    let tempDir: string;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("loadYamlWithReferences", () => {
        beforeEach(async () => {
            tempDir = await createTempDir();
            // Clear any mocks before each test
            jest.clearAllMocks();
        });

        afterEach(async () => {
            await cleanupTempDir(tempDir);
        });

        it("should resolve simple reference", async () => {
            const mainYaml = `
        database: !reference
          path: database.yaml
      `;

            const dbYaml = `
        host: localhost
        port: 5432
        name: mydb
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "database.yaml", dbYaml);

            const result = await loadYamlWithReferences(mainPath);

            expect(result).toEqual({
                database: {
                    host: "localhost",
                    port: 5432,
                    name: "mydb",
                },
            });
        });

        it("should resolve nested references", async () => {
            const mainYaml = `
        app: !reference
          path: app.yaml
      `;

            const appYaml = `
        name: myapp
        config: !reference
          path: config.yaml
      `;

            const configYaml = `
        debug: true
        port: 3000
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "app.yaml", appYaml);
            await createTestYamlFile(tempDir, "config.yaml", configYaml);

            const result = await loadYamlWithReferences(mainPath);

            expect(result).toEqual({
                app: {
                    name: "myapp",
                    config: {
                        port: 3000,
                        debug: true,
                    },
                },
            });
        });

        it("should resolve reference-all with multiple files", async () => {
            const mainYaml = `
        configs: !reference-all
          glob: configs/*.yaml
      `;

            const config1Yaml = `
        name: config1
        value: 100
      `;

            const config2Yaml = `
        name: config2
        value: 200
      `;

            const configsDir = `${tempDir}/configs`;
            await fs.mkdir(configsDir, { recursive: true });

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(configsDir, "app.yaml", config1Yaml);
            await createTestYamlFile(configsDir, "db.yaml", config2Yaml);

            const result = await loadYamlWithReferences(mainPath);

            expect(result.configs).toHaveLength(2);
            expect(result.configs).toEqual(
                expect.arrayContaining([
                    { name: "config1", value: 100 },
                    { name: "config2", value: 200 },
                ]),
            );
        });

        it("should handle mixed references", async () => {
            const mainYaml = `
        app: !reference
          path: app.yaml
        data: !reference-all
          glob: data/*.yaml
        settings:
          debug: true
      `;

            const appYaml = `
        name: myapp
        version: 1.0.0
      `;

            const data1Yaml = "id: 1\ntype: user";
            const data2Yaml = "id: 2\ntype: admin";

            const dataDir = `${tempDir}/data`;
            await fs.mkdir(dataDir, { recursive: true });

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "app.yaml", appYaml);
            await createTestYamlFile(dataDir, "user.yaml", data1Yaml);
            await createTestYamlFile(dataDir, "admin.yaml", data2Yaml);

            const result = await loadYamlWithReferences(mainPath);

            expect(result.app).toEqual({ name: "myapp", version: "1.0.0" });
            expect(result.settings).toEqual({ debug: true });
            expect(result.data).toHaveLength(2);
            expect(result.data).toEqual(
                expect.arrayContaining([
                    { id: 1, type: "user" },
                    { id: 2, type: "admin" },
                ]),
            );
        });

        it("should throw error for missing referenced file", async () => {
            const mainYaml = `
        missing: !reference
          path: nonexistent.yaml
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );

            await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
                /Referenced file not found/,
            );
        });

        it("should throw error for circular references", async () => {
            const mainYaml = `
        ref: !reference
          path: circular.yaml
      `;

            const circularYaml = `
        back: !reference
          path: main.yaml
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "circular.yaml", circularYaml);

            await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
                /Circular reference detected/,
            );
        });

        it("should throw error when reference-all finds no files", async () => {
            const mainYaml = `
        empty: !reference-all
          glob: empty/*.yaml
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );

            await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
                /No YAML files found matching glob pattern/,
            );
        });

        it("should handle invalid YAML in referenced file", async () => {
            const mainYaml = `
        bad: !reference
          path: bad.yaml
      `;

            const badYaml = `
        invalid: yaml: with: multiple: colons
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "bad.yaml", badYaml);

            await expect(loadYamlWithReferences(mainPath)).rejects.toThrow();
        });

        it("should handle relative paths correctly", async () => {
            const mainYaml = `
        config: !reference
          path: ../config/database.yaml
      `;

            const dbYaml = `
        host: localhost
        port: 5432
      `;

            const subDir = `${tempDir}/sub`;
            await fs.mkdir(subDir, { recursive: true });
            const configDir = `${tempDir}/config`;
            await fs.mkdir(configDir, { recursive: true });

            const mainPath = await createTestYamlFile(
                subDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(configDir, "database.yaml", dbYaml);

            const result = await loadYamlWithReferences(mainPath);

            expect(result).toEqual({
                config: {
                    host: "localhost",
                    port: 5432,
                },
            });
        });
    });

    describe("loadYamlWithReferencesSync", () => {
        beforeEach(async () => {
            tempDir = await createTempDir();
            // Clear any mocks before each test
            jest.clearAllMocks();
        });

        afterEach(async () => {
            await cleanupTempDir(tempDir);
        });

        it("should resolve simple reference synchronously", async () => {
            const mainYaml = `
        database: !reference
          path: database.yaml
      `;

            const dbYaml = `
        host: localhost
        port: 5432
        name: mydb
      `;

            const mainPath = await createTestYamlFile(
                tempDir,
                "main.yaml",
                mainYaml,
            );
            await createTestYamlFile(tempDir, "database.yaml", dbYaml);

            const result = loadYamlWithReferencesSync(mainPath);

            expect(result).toEqual({
                database: {
                    host: "localhost",
                    port: 5432,
                    name: "mydb",
                },
            });
        });

        it("should throw error for non-existent file synchronously", async () => {
            // Create temp dir first
            await createTempDir();

            expect(() => {
                loadYamlWithReferencesSync(`${tempDir}/nonexistent.yaml`);
            }).toThrow(
                /ENOENT|no such file or directory|Failed to parse YAML file/,
            );
        });
    });
});
