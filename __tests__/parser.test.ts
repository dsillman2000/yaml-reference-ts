/**
 * Parser tests for yaml-reference-ts
 */

import {
    parseYamlWithReferences,
    parseYamlWithReferencesSync,
    Reference,
    ReferenceAll,
    Flatten,
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
                expect(result.database._location).toBe(filePath);
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
                expect(result.settings._location).toBe(filePath);
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
                expect(result.configs._location).toBe(filePath);
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
                expect(result.files._location).toBe(filePath);
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
                expect(result.app.config._location).toBe(filePath);
                expect(result.app.data.files).toBeInstanceOf(ReferenceAll);
                expect(result.app.data.files.glob).toBe("./data/*.yaml");
                expect(result.app.data.files._location).toBe(filePath);
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
                expect(result.configs[0]._location).toBe(filePath);
                expect(result.configs[1]).toBeInstanceOf(Reference);
                expect(result.configs[1].path).toBe("./config2.yaml");
                expect(result.configs[1]._location).toBe(filePath);
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
                expect(result.database._location).toBe(filePath);
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
            }).toThrow(
                /ENOENT|no such file or directory|Failed to parse YAML file/,
            );
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
                expect(result.data.sequence[0]._location).toBe(filePath);

                // Second item should be a Reference
                expect(result.data.sequence[1]).toBeInstanceOf(Reference);
                expect(result.data.sequence[1].path).toBe("./config2.yaml");
                expect(result.data.sequence[1]._location).toBe(filePath);

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
                expect(result.data.sequence[0]._location).toBe(filePath);

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
                expect(result.data.sequence[1]._location).toBe(filePath);

                expect(result.data.sequence[2]).toEqual([2, 3]);

                expect(result.data.sequence[3]).toBeInstanceOf(ReferenceAll);
                expect(result.data.sequence[3].glob).toBe("./data/*.yaml");
                expect(result.data.sequence[3]._location).toBe(filePath);

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
    });

    // describe("parseYamlWithReferencesSync", () => {
    //     it("should parse YAML without custom tags", () => {
    //         const yaml = `
    //     name: test
    //     version: 1.0.0
    //     nested:
    //       key: value
    //   `;

    //         // Create a temporary file with the YAML content
    //         const fs = require("fs");
    //         const path = require("path");
    //         const tempDir = fs.mkdtempSync(
    //             path.join(require("os").tmpdir(), "yaml-test-"),
    //         );
    //         const filePath = path.join(tempDir, "test.yaml");
    //         fs.writeFileSync(filePath, yaml);

    //         try {
    //             const result = parseYamlWithReferencesSync(filePath);

    //             expect(result).toEqual({
    //                 name: "test",
    //                 version: "1.0.0",
    //                 nested: {
    //                     key: "value",
    //                 },
    //             });
    //         } finally {
    //             fs.rmSync(tempDir, { recursive: true, force: true });
    //         }
    //     });

    //     it("should parse !reference tag with block mapping syntax", () => {
    //         const yaml = `
    //     database: !reference
    //       path: ./config/database.yaml
    //   `;

    //         // Create a temporary file with the YAML content
    //         const fs = require("fs");
    //         const path = require("path");
    //         const tempDir = fs.mkdtempSync(
    //             path.join(require("os").tmpdir(), "yaml-test-"),
    //         );
    //         const filePath = path.join(tempDir, "test.yaml");
    //         fs.writeFileSync(filePath, yaml);

    //         try {
    //             const result = parseYamlWithReferencesSync(filePath);

    //             expect(result.database).toBeInstanceOf(Reference);
    //             expect(result.database.path).toBe("./config/database.yaml");
    //             expect(result.database._location).toBe(filePath);
    //         } finally {
    //             fs.rmSync(tempDir, { recursive: true, force: true });
    //         }
    //     });

    //     it("should throw error for !reference without path property", () => {
    //         const yaml = `
    //     invalid: !reference
    //       not_path: ./something.yaml
    //   `;

    //         // Create a temporary file with the YAML content
    //         const fs = require("fs");
    //         const path = require("path");
    //         const tempDir = fs.mkdtempSync(
    //             path.join(require("os").tmpdir(), "yaml-test-"),
    //         );
    //         const filePath = path.join(tempDir, "test.yaml");
    //         fs.writeFileSync(filePath, yaml);

    //         try {
    //             expect(() => {
    //                 parseYamlWithReferencesSync(filePath);
    //             }).toThrow('!reference tag requires a "path" property');
    //         } finally {
    //             fs.rmSync(tempDir, { recursive: true, force: true });
    //         }
    //     });

    //     it("should throw error when file does not exist", () => {
    //         expect(() => {
    //             parseYamlWithReferencesSync("/nonexistent/file.yaml");
    //         }).toThrow(
    //             /ENOENT|no such file or directory|Failed to parse YAML file/,
    //         );
    //     });
});
