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

    describe("flatten tag", () => {
      it("should flatten simple array: !flatten [1, 2, 3] -> [1, 2, 3]", async () => {
        const mainYaml = `
          data: !flatten
            - 1
            - 2
            - 3
        `;

        const mainPath = await createTestYamlFile(
          tempDir,
          "main.yaml",
          mainYaml,
        );

        const result = await loadYamlWithReferences(mainPath);

        expect(result).toEqual({
          data: [1, 2, 3],
        });
      });

      it("should flatten nested arrays: !flatten [1, [2, [3]]] -> [1, 2, 3]", async () => {
        const mainYaml = `
          data: !flatten
            - 1
            -
              - 2
              -
                - 3
        `;

        const mainPath = await createTestYamlFile(
          tempDir,
          "main.yaml",
          mainYaml,
        );

        const result = await loadYamlWithReferences(mainPath);

        expect(result).toEqual({
          data: [1, 2, 3],
        });
      });

      it("should flatten array with reference: !flatten [1, !reference] -> [1, result]", async () => {
        const mainYaml = `
          data: !flatten
            - 1
            - !reference
              path: ref.yaml
        `;

        const refYaml = `
          result: value
        `;

        const mainPath = await createTestYamlFile(
          tempDir,
          "main.yaml",
          mainYaml,
        );
        await createTestYamlFile(tempDir, "ref.yaml", refYaml);

        const result = await loadYamlWithReferences(mainPath);

        expect(result).toEqual({
          data: [1, { result: "value" }],
        });
      });

      it("should flatten array with reference-all: !flatten [1, !reference-all] -> [1, result, result]", async () => {
        const mainYaml = `
          data: !flatten
            - 1
            - !reference-all
              glob: refs/*.yaml
        `;

        const ref1Yaml = `
          result: value1
        `;

        const ref2Yaml = `
          result: value2
        `;

        const refsDir = `${tempDir}/refs`;
        await fs.mkdir(refsDir, { recursive: true });

        const mainPath = await createTestYamlFile(
          tempDir,
          "main.yaml",
          mainYaml,
        );
        await createTestYamlFile(refsDir, "file1.yaml", ref1Yaml);
        await createTestYamlFile(refsDir, "file2.yaml", ref2Yaml);

        const result = await loadYamlWithReferences(mainPath);

        expect(result.data).toHaveLength(3);
        expect(result.data[0]).toBe(1);
        expect(result.data[1]).toEqual({ result: "value1" });
        expect(result.data[2]).toEqual({ result: "value2" });
      });
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);

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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);

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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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

      const mainPath = await createTestYamlFile(subDir, "main.yaml", mainYaml);
      await createTestYamlFile(configDir, "database.yaml", dbYaml);

      const result = await loadYamlWithReferences(mainPath, [configDir]);

      expect(result).toEqual({
        config: {
          host: "localhost",
          port: 5432,
        },
      });
    });

    it("should throw error when trying to use absolute path in reference", async () => {
      const mainYaml = `
        config: !reference
          path: /absolute/path/database.yaml
      `;

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /Reference path must be relative, not absolute/,
      );
    });

    it("should throw error when trying to use absolute path in reference-all", async () => {
      const mainYaml = `
        configs: !reference-all
          glob: /absolute/path/*.yaml
      `;

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /ReferenceAll glob must be relative, not absolute/,
      );
    });

    it("should not allow referencing file in parent directory without explicit allowPaths", async () => {
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

      const mainPath = await createTestYamlFile(subDir, "main.yaml", mainYaml);
      await createTestYamlFile(configDir, "database.yaml", dbYaml);

      // Should fail without allowPaths since parent directory is not in allowed paths
      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /is not allowed/,
      );
    });

    it("should allow referencing file in parent directory with explicit allowPaths", async () => {
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

      const mainPath = await createTestYamlFile(subDir, "main.yaml", mainYaml);
      await createTestYamlFile(configDir, "database.yaml", dbYaml);

      // Should succeed with allowPaths that includes the config directory
      const result = await loadYamlWithReferences(mainPath, [configDir]);

      expect(result).toEqual({
        config: {
          host: "localhost",
          port: 5432,
        },
      });
    });

    it("should allow referencing file in parent directory when allowPaths includes parent directory", async () => {
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

      const mainPath = await createTestYamlFile(subDir, "main.yaml", mainYaml);
      await createTestYamlFile(configDir, "database.yaml", dbYaml);

      // Should succeed with allowPaths that includes the temp directory (parent of both sub and config)
      const result = await loadYamlWithReferences(mainPath, [tempDir]);

      expect(result).toEqual({
        config: {
          host: "localhost",
          port: 5432,
        },
      });
    });

    it("should reject references where allowedPath is a prefix but not a path boundary", async () => {
      // e.g. allowedPath = "/tmp/allowed", target = "/tmp/allowed-but-not-really/evil.yaml"
      // This should be rejected because "allowed-but-not-really" is not a child of "allowed"
      const allowedDir = `${tempDir}/allowed`;
      const sneakyDir = `${tempDir}/allowed-but-not-really`;
      const subDir = `${tempDir}/allowed/sub`;
      await fs.mkdir(allowedDir, { recursive: true });
      await fs.mkdir(sneakyDir, { recursive: true });
      await fs.mkdir(subDir, { recursive: true });

      const mainYaml = `
        evil: !reference
          path: ../../allowed-but-not-really/evil.yaml
      `;

      const evilYaml = `
        data: gotcha
      `;

      const mainPath = await createTestYamlFile(subDir, "main.yaml", mainYaml);
      await createTestYamlFile(sneakyDir, "evil.yaml", evilYaml);

      // allowPaths only includes "allowed", not "allowed-but-not-really"
      await expect(
        loadYamlWithReferences(mainPath, [allowedDir]),
      ).rejects.toThrow(/is not allowed/);
    });

    it("should reject references that use a symlink to escape allowed paths", async () => {
      const allowedDir = `${tempDir}/allowed`;
      const secretDir = `${tempDir}/secret`;
      await fs.mkdir(allowedDir, { recursive: true });
      await fs.mkdir(secretDir, { recursive: true });

      // Create a sensitive file outside the allowed directory
      const secretYaml = `
        password: super-secret
      `;
      await createTestYamlFile(secretDir, "credentials.yaml", secretYaml);

      // Create a symlink inside the allowed directory that points outside it
      await fs.symlink(
        `${secretDir}/credentials.yaml`,
        `${allowedDir}/sneaky-link.yaml`,
      );

      const mainYaml = `
        stolen: !reference
          path: sneaky-link.yaml
      `;

      const mainPath = await createTestYamlFile(
        allowedDir,
        "main.yaml",
        mainYaml,
      );

      // The symlink lives inside allowedDir, but its real path is in secretDir
      await expect(
        loadYamlWithReferences(mainPath, [allowedDir]),
      ).rejects.toThrow(/is not allowed/);
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

      const mainPath = await createTestYamlFile(tempDir, "main.yaml", mainYaml);
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
      }).toThrow(/ENOENT|no such file or directory|Failed to parse YAML file/);
    });
  });
});
