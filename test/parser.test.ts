/**
 * Parser tests for yaml-reference-ts
 */

import {
  parseYamlWithReferences,
  parseYamlWithReferencesSync,
  Reference,
  ReferenceAll,
  Flatten,
  Merge,
} from "../src";

describe("YAML Parser", () => {
  describe("parseYamlWithReferences", () => {
    it("should parse YAML without custom tags", async () => {
      const yaml = `
        name: test
        version: 1.0.0
        nested:
          key: value
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result).toEqual({
          name: "test",
          version: "1.0.0",
          nested: {
            key: "value",
          },
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !reference tag with block mapping syntax", async () => {
      const yaml = `
        database: !reference
          path: ./config/database.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.database).toBeInstanceOf(Reference);
        expect(result.database.path).toBe("./config/database.yaml");
        expect(result.database.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !reference tag with inline mapping syntax", async () => {
      const yaml = `
        settings: !reference {path: ./settings/production.yaml}
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.settings).toBeInstanceOf(Reference);
        expect(result.settings.path).toBe("./settings/production.yaml");
        expect(result.settings.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !reference-all tag with block mapping syntax", async () => {
      const yaml = `
        configs: !reference-all
          glob: ./configs/*.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.configs).toBeInstanceOf(ReferenceAll);
        expect(result.configs.glob).toBe("./configs/*.yaml");
        expect(result.configs.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !reference-all tag with inline mapping syntax", async () => {
      const yaml = `
        files: !reference-all {glob: ./data/*.yaml}
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.files).toBeInstanceOf(ReferenceAll);
        expect(result.files.glob).toBe("./data/*.yaml");
        expect(result.files.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle mixed references in nested structures", async () => {
      const yaml = `
        app:
          name: myapp
          config: !reference
            path: ./app/config.yaml
          data:
            files: !reference-all
              glob: ./data/*.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.app.name).toBe("myapp");
        expect(result.app.config).toBeInstanceOf(Reference);
        expect(result.app.config.path).toBe("./app/config.yaml");
        expect(result.app.config.location).toBe(filePath);
        expect(result.app.data.files).toBeInstanceOf(ReferenceAll);
        expect(result.app.data.files.glob).toBe("./data/*.yaml");
        expect(result.app.data.files.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle references in arrays", async () => {
      const yaml = `
        configs:
          - !reference
            path: ./config1.yaml
          - !reference {path: ./config2.yaml}
          - name: regular
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(Array.isArray(result.configs)).toBe(true);
        expect(result.configs[0]).toBeInstanceOf(Reference);
        expect(result.configs[0].path).toBe("./config1.yaml");
        expect(result.configs[0].location).toBe(filePath);
        expect(result.configs[1]).toBeInstanceOf(Reference);
        expect(result.configs[1].path).toBe("./config2.yaml");
        expect(result.configs[1].location).toBe(filePath);
        expect(result.configs[2]).toEqual({ name: "regular" });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !reference without path property", async () => {
      const yaml = `
        invalid: !reference
          not_path: ./something.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          '!reference tag requires a "path" property',
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !reference-all without glob property", async () => {
      const yaml = `
        invalid: !reference-all
          not_glob: ./something/*.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          '!reference-all tag requires a "glob" property',
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !reference with non-string path", async () => {
      const yaml = `
        invalid: !reference
          path: 123
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          '!reference "path" property must be a string',
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !reference-all with non-string glob", async () => {
      const yaml = `
        invalid: !reference-all
          glob: 456
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          '!reference-all "glob" property must be a string',
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle empty YAML document", async () => {
      const yaml = "";

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);
        expect(result).toBeNull();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle YAML with only comments", async () => {
      const yaml = `
        # This is a comment
        # Another comment
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);
        expect(result).toBeNull();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should extract a scalar anchor value with extractAnchor option", async () => {
      const yaml = `
name: &name David
age: &age 25
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath, {
          extractAnchor: "name",
        });
        expect(result).toBe("David");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should extract a mapping anchor value with extractAnchor option", async () => {
      const yaml = `
config: &cfg
  host: localhost
  port: 5432
other: value
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath, {
          extractAnchor: "cfg",
        });
        expect(result).toEqual({ host: "localhost", port: 5432 });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw when extractAnchor names a non-existent anchor", async () => {
      const yaml = `
name: &name David
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(
          parseYamlWithReferences(filePath, { extractAnchor: "missing" }),
        ).rejects.toThrow(/missing/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should return the whole document when extractAnchor is omitted", async () => {
      const yaml = `
name: &name David
age: &age 25
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);
        expect(result).toEqual({ name: "David", age: 25 });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should extract a deeply nested anchor", async () => {
      const yaml = `
level1:
  level2:
    level3:
      secret: &deep 42
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath, {
          extractAnchor: "deep",
        });
        expect(result).toBe(42);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should resolve aliases within the extracted anchor subtree", async () => {
      const yaml = `
base: &base
  x: 10
composite: &comp
  imported: *base
  y: 20
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath, {
          extractAnchor: "comp",
        });
        expect(result).toEqual({ imported: { x: 10 }, y: 20 });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("parseYamlWithReferencesSync", () => {
    it("should parse YAML without custom tags", () => {
      const yaml = `
        name: test
        version: 1.0.0
        nested:
          key: value
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = parseYamlWithReferencesSync(filePath);

        expect(result).toEqual({
          name: "test",
          version: "1.0.0",
          nested: {
            key: "value",
          },
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !reference tag with block mapping syntax", () => {
      const yaml = `
        database: !reference
          path: ./config/database.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = parseYamlWithReferencesSync(filePath);

        expect(result.database).toBeInstanceOf(Reference);
        expect(result.database.path).toBe("./config/database.yaml");
        expect(result.database.location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !reference without path property", () => {
      const yaml = `
        invalid: !reference
          not_path: ./something.yaml
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        expect(() => {
          parseYamlWithReferencesSync(filePath);
        }).toThrow('!reference tag requires a "path" property');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error when file does not exist", () => {
      expect(() => {
        parseYamlWithReferencesSync("/nonexistent/file.yaml");
      }).toThrow(/ENOENT|no such file or directory|Failed to parse YAML file/);
    });

    it("should parse !flatten tag with sequence syntax", async () => {
      const yaml = `
        data: !flatten
          - 1
          - 2
          - 3
      `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toEqual([1, 2, 3]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !flatten tag with nested sequences", async () => {
      const yaml = `
            data: !flatten
              - [1, 2]
              - [ [ 3 ] ]
              - 4
          `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toEqual([[1, 2], [[3]], 4]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !flatten tag containing Reference objects", async () => {
      const yaml = `
            data: !flatten
              - !reference
                path: ./config1.yaml
              - !reference {path: ./config2.yaml}
              - regular
          `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toHaveLength(3);

        // First item should be a Reference
        expect(result.data.sequence[0]).toBeInstanceOf(Reference);
        expect(result.data.sequence[0].path).toBe("./config1.yaml");
        expect(result.data.sequence[0].location).toBe(filePath);

        // Second item should be a Reference
        expect(result.data.sequence[1]).toBeInstanceOf(Reference);
        expect(result.data.sequence[1].path).toBe("./config2.yaml");
        expect(result.data.sequence[1].location).toBe(filePath);

        // Third item should be a regular string
        expect(result.data.sequence[2]).toBe("regular");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !flatten tag containing ReferenceAll objects", async () => {
      const yaml = `
            data: !flatten
              - !reference-all
                glob: ./configs/*.yaml
              - regular
          `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toHaveLength(2);

        // First item should be a ReferenceAll
        expect(result.data.sequence[0]).toBeInstanceOf(ReferenceAll);
        expect(result.data.sequence[0].glob).toBe("./configs/*.yaml");
        expect(result.data.sequence[0].location).toBe(filePath);

        // Second item should be a regular string
        expect(result.data.sequence[1]).toBe("regular");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !flatten tag with mixed content including references", async () => {
      const yaml = `
            data: !flatten
              - 1
              - !reference {path: ./config.yaml}
              - [2, 3]
              - !reference-all
                glob: ./data/*.yaml
              - 4
          `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toHaveLength(5);

        // Check each item
        expect(result.data.sequence[0]).toBe(1);

        expect(result.data.sequence[1]).toBeInstanceOf(Reference);
        expect(result.data.sequence[1].path).toBe("./config.yaml");
        expect(result.data.sequence[1].location).toBe(filePath);

        expect(result.data.sequence[2]).toEqual([2, 3]);

        expect(result.data.sequence[3]).toBeInstanceOf(ReferenceAll);
        expect(result.data.sequence[3].glob).toBe("./data/*.yaml");
        expect(result.data.sequence[3].location).toBe(filePath);

        expect(result.data.sequence[4]).toBe(4);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !flatten applied to non-sequence", async () => {
      const yaml = `
          invalid: !flatten
            not_a_sequence: value
        `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          "!flatten tag cannot be used on a mapping",
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !flatten tag with inline sequence syntax", async () => {
      const yaml = `
            data: !flatten [1, 2, 3]
          `;

      // Create a temporary file with the YAML content
      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Flatten);
        expect(result.data.sequence).toEqual([1, 2, 3]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !merge tag with sequence of objects", async () => {
      const yaml = `
        data: !merge
          - { a: 1, b: 2 }
          - { b: 3, c: 4 }
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toEqual([
          { a: 1, b: 2 },
          { b: 3, c: 4 },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !merge tag with inline sequence syntax", async () => {
      const yaml = `
        data: !merge [{ a: 1 }, { b: 2 }]
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toEqual([{ a: 1 }, { b: 2 }]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !merge tag containing Reference objects", async () => {
      const yaml = `
        data: !merge
          - !reference
            path: ./defaults.yaml
          - { override: true }
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toHaveLength(2);

        expect(result.data.sequence[0]).toBeInstanceOf(Reference);
        expect(result.data.sequence[0].path).toBe("./defaults.yaml");
        expect(result.data.sequence[0].location).toBe(filePath);

        expect(result.data.sequence[1]).toEqual({ override: true });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !merge tag containing ReferenceAll objects", async () => {
      const yaml = `
        data: !merge
          - { base: true }
          - !reference-all
            glob: ./overrides/*.yaml
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toHaveLength(2);

        expect(result.data.sequence[0]).toEqual({ base: true });

        expect(result.data.sequence[1]).toBeInstanceOf(ReferenceAll);
        expect(result.data.sequence[1].glob).toBe("./overrides/*.yaml");
        expect(result.data.sequence[1].location).toBe(filePath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse nested !merge tags", async () => {
      const yaml = `
        data: !merge
          - a: 1
            inner: !merge
              - { x: 1, y: 1 }
              - { x: 2 }
          - { b: 2 }
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toHaveLength(2);

        // First item is an object with a nested Merge
        expect(result.data.sequence[0].a).toBe(1);
        expect(result.data.sequence[0].inner).toBeInstanceOf(Merge);
        expect(result.data.sequence[0].inner.sequence).toEqual([
          { x: 1, y: 1 },
          { x: 2 },
        ]);

        expect(result.data.sequence[1]).toEqual({ b: 2 });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw error for !merge applied to non-sequence", async () => {
      const yaml = `
        invalid: !merge
          not_a_sequence: value
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        await expect(parseYamlWithReferences(filePath)).rejects.toThrow(
          "!merge tag cannot be used on a mapping",
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should parse !merge tag with empty sequence", async () => {
      const yaml = `
        data: !merge []
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.data).toBeInstanceOf(Merge);
        expect(result.data.sequence).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should resolve anchor on a !merge tag and alias an equivalent value elsewhere", async () => {
      const yaml = `
merged: !merge &m
  - { a: 1, b: 2 }
  - { b: 3, c: 4 }
data:
  copy: *m
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        // The anchored value should parse as a Merge
        expect(result.merged).toBeInstanceOf(Merge);
        expect(result.merged.sequence).toEqual([
          { a: 1, b: 2 },
          { b: 3, c: 4 },
        ]);

        // The alias should resolve to the same Merge
        expect(result.data.copy).toBeInstanceOf(Merge);
        expect(result.data.copy.sequence).toEqual([
          { a: 1, b: 2 },
          { b: 3, c: 4 },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should resolve anchor on a !flatten tag and alias an equivalent value elsewhere", async () => {
      const yaml = `
flat: !flatten &f
  - [1, 2]
  - [3, 4]
data:
  copy: *f
      `;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = await parseYamlWithReferences(filePath);

        expect(result.flat).toBeInstanceOf(Flatten);
        expect(result.flat.sequence).toEqual([
          [1, 2],
          [3, 4],
        ]);

        expect(result.data.copy).toBeInstanceOf(Flatten);
        expect(result.data.copy.sequence).toEqual([
          [1, 2],
          [3, 4],
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should extract a scalar anchor value with extractAnchor option (sync)", () => {
      const yaml = `
name: &name David
age: &age 25
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = parseYamlWithReferencesSync(filePath, {
          extractAnchor: "name",
        });
        expect(result).toBe("David");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should extract a mapping anchor value with extractAnchor option (sync)", () => {
      const yaml = `
config: &cfg
  host: localhost
  port: 5432
other: value
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        const result = parseYamlWithReferencesSync(filePath, {
          extractAnchor: "cfg",
        });
        expect(result).toEqual({ host: "localhost", port: 5432 });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should throw when extractAnchor names a non-existent anchor (sync)", () => {
      const yaml = `
name: &name David
`;

      const fs = require("fs");
      const path = require("path");
      const tempDir = fs.mkdtempSync(
        path.join(require("os").tmpdir(), "yaml-test-"),
      );
      const filePath = path.join(tempDir, "test.yaml");
      fs.writeFileSync(filePath, yaml);

      try {
        expect(() =>
          parseYamlWithReferencesSync(filePath, { extractAnchor: "missing" }),
        ).toThrow(/missing/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
