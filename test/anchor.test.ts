/**
 * Tests for the anchor extraction feature on !reference and !reference-all tags.
 * Spec: features/reference/anchor.feature, features/reference-all/anchor.feature
 */

import * as fs from "fs/promises";
import { loadYamlWithReferences, loadYamlWithReferencesSync } from "../src";
import {
  createTempDir,
  createTestYamlFile,
  cleanupTempDir,
} from "./test-utils";

describe("Anchor extraction", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("!reference with anchor", () => {
    it("should extract a scalar string value by anchor name", async () => {
      await createTestYamlFile(
        tempDir,
        "child.yaml",
        `
name: &name David
age: &age 25
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_name: !reference {path: child.yaml, anchor: name}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child_name: "David" });
    });

    it("should extract a numeric value by anchor name", async () => {
      await createTestYamlFile(
        tempDir,
        "child.yaml",
        `
name: &name David
age: &age 25
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_age: !reference {path: child.yaml, anchor: age}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child_age: 25 });
    });

    it("should extract a mapping value by anchor name", async () => {
      await createTestYamlFile(
        tempDir,
        "data.yaml",
        `
config: &cfg
  host: localhost
  port: 5432
other: value
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `db: !reference {path: data.yaml, anchor: cfg}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        db: { host: "localhost", port: 5432 },
      });
    });

    it("should work with block style !reference syntax", async () => {
      await createTestYamlFile(
        tempDir,
        "child.yaml",
        `
name: &name David
age: &age 25
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
child_name: !reference
  path: child.yaml
  anchor: name
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child_name: "David" });
    });

    it("should extract an anchor whose value is a !merge result", async () => {
      await createTestYamlFile(
        tempDir,
        "template.yaml",
        `
base: &base_config
  project: Demo
config: &config !merge
  - *base_config
  - environment: production
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `template: !reference {path: template.yaml, anchor: config}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        template: { project: "Demo", environment: "production" },
      });
    });

    it("should throw an error when the anchor does not exist", async () => {
      await createTestYamlFile(
        tempDir,
        "child.yaml",
        `
name: &name David
age: &age 25
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_name: !reference {path: child.yaml, anchor: nonexistent}`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /nonexistent/,
      );
    });

    it("should extract an anchor containing aliases to merge-produced anchors", async () => {
      await createTestYamlFile(
        tempDir,
        "a.yaml",
        `
.dat:
  c: &c 100

a: !merge
  - foo: &fooVal !merge
    - {a: 10}
    - {b: *c}

b: &val
  fooFromA: *fooVal
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
value:
  data: !reference
    path: a.yaml
    anchor: val
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        value: {
          data: {
            fooFromA: { a: 10, b: 100 },
          },
        },
      });
    });

    it("should faithfully extract null, boolean, and empty string anchors", async () => {
      await createTestYamlFile(
        tempDir,
        "scalars.yaml",
        `
nothing: &nullVal null
flag: &boolVal true
blank: &emptyStr ""
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
a: !reference {path: scalars.yaml, anchor: nullVal}
b: !reference {path: scalars.yaml, anchor: boolVal}
c: !reference {path: scalars.yaml, anchor: emptyStr}
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ a: null, b: true, c: "" });
    });

    it("should coerce a numeric anchor name to string", async () => {
      await createTestYamlFile(
        tempDir,
        "data.yaml",
        `
val: &1 hello
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `result: !reference {path: data.yaml, anchor: 1}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ result: "hello" });
    });

    it("should extract empty containers and populated sequences", async () => {
      await createTestYamlFile(
        tempDir,
        "containers.yaml",
        `
empty_map: &eMap {}
empty_seq: &eSeq []
items: &list [1, 2, 3]
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
a: !reference {path: containers.yaml, anchor: eMap}
b: !reference {path: containers.yaml, anchor: eSeq}
c: !reference {path: containers.yaml, anchor: list}
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ a: {}, b: [], c: [1, 2, 3] });
    });

    it("should discover root-level and deeply nested anchors", async () => {
      await createTestYamlFile(
        tempDir,
        "depth.yaml",
        `
&root
level1:
  level2:
    level3:
      secret: &deep 42
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
whole: !reference {path: depth.yaml, anchor: root}
deep: !reference {path: depth.yaml, anchor: deep}
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        whole: { level1: { level2: { level3: { secret: 42 } } } },
        deep: 42,
      });
    });

    it("should extract a list value by anchor name", async () => {
      await createTestYamlFile(
        tempDir,
        "data.yaml",
        `
tags: &tags
  - alpha
  - beta
  - gamma
other: value
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `labels: !reference {path: data.yaml, anchor: tags}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ labels: ["alpha", "beta", "gamma"] });
    });

    it("should resolve anchors in nested references (reference within reference)", async () => {
      // main -> middle (anchor: cfg) -> leaf.yaml
      await createTestYamlFile(
        tempDir,
        "leaf.yaml",
        `
db_host: db.example.com
db_port: 5432
`,
      );
      await createTestYamlFile(
        tempDir,
        "middle.yaml",
        `
ignored: stuff
config: &cfg
  database: !reference {path: leaf.yaml}
  cache: redis
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `app: !reference {path: middle.yaml, anchor: cfg}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        app: {
          database: { db_host: "db.example.com", db_port: 5432 },
          cache: "redis",
        },
      });
    });

    it("should detect circular references even when using anchors", async () => {
      await createTestYamlFile(
        tempDir,
        "a.yaml",
        `
val: &val
  child: !reference {path: b.yaml}
`,
      );
      await createTestYamlFile(
        tempDir,
        "b.yaml",
        `
data: !reference {path: a.yaml, anchor: val}
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `result: !reference {path: a.yaml, anchor: val}`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /[Cc]ircular/,
      );
    });

    it("should import the whole file when no anchor is specified", async () => {
      await createTestYamlFile(
        tempDir,
        "child.yaml",
        `
name: &name David
age: &age 25
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child: !reference {path: child.yaml}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child: { name: "David", age: 25 } });
    });
  });

  describe("!reference-all with anchor", () => {
    it("should extract a scalar value from each matched file", async () => {
      await createTestYamlFile(
        tempDir,
        "child-1.yaml",
        `
name: &name David
age: &age 25
`,
      );
      await createTestYamlFile(
        tempDir,
        "child-2.yaml",
        `
name: &name Alice
age: &age 30
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_ages: !reference-all {glob: "child-*.yaml", anchor: age}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child_ages: [25, 30] });
    });

    it("should extract a string value from each matched file", async () => {
      await createTestYamlFile(
        tempDir,
        "child-1.yaml",
        `
name: &name David
age: &age 25
`,
      );
      await createTestYamlFile(
        tempDir,
        "child-2.yaml",
        `
name: &name Alice
age: &age 30
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_names: !reference-all {glob: "child-*.yaml", anchor: name}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({ child_names: ["David", "Alice"] });
    });

    it("should extract a mapping value from each matched file", async () => {
      await createTestYamlFile(
        tempDir,
        "service-1.yaml",
        `
config: &cfg
  host: db1.example.com
  port: 5432
name: service-1
`,
      );
      await createTestYamlFile(
        tempDir,
        "service-2.yaml",
        `
config: &cfg
  host: db2.example.com
  port: 5433
name: service-2
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `configs: !reference-all {glob: "service-*.yaml", anchor: cfg}`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        configs: [
          { host: "db1.example.com", port: 5432 },
          { host: "db2.example.com", port: 5433 },
        ],
      });
    });

    it("should throw when anchor is missing in any matched file", async () => {
      await createTestYamlFile(
        tempDir,
        "child-1.yaml",
        `
name: &name David
age: &age 25
_nonexistent: &nonexistent "my value"
`,
      );
      await createTestYamlFile(
        tempDir,
        "child-2.yaml",
        `
name: &name Alice
age: &age 30
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `child_ages: !reference-all {glob: "child-*.yaml", anchor: nonexistent}`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /nonexistent/,
      );
    });

    it("should collect same anchor name across multiple files", async () => {
      await fs.mkdir(`${tempDir}/children`, { recursive: true });
      await createTestYamlFile(
        `${tempDir}/children`,
        "alice.yaml",
        `
nothing: &nullVal null
flag: &boolVal true
`,
      );
      await createTestYamlFile(
        `${tempDir}/children`,
        "bob.yaml",
        `
nothing: &nullVal null
flag: &boolVal false
`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `
nulls: !reference-all {glob: "children/*.yaml", anchor: nullVal}
flags: !reference-all {glob: "children/*.yaml", anchor: boolVal}
`,
      );

      const result = await loadYamlWithReferences(mainPath);
      expect(result).toEqual({
        nulls: [null, null],
        flags: [true, false],
      });
    });
  });

  describe("sync variants", () => {
    it("should extract anchor with loadYamlWithReferencesSync for !reference", () => {
      const fsSync = require("fs");
      fsSync.writeFileSync(
        `${tempDir}/child.yaml`,
        `name: &name David\nage: &age 25\n`,
      );
      fsSync.writeFileSync(
        `${tempDir}/main.yaml`,
        `child_name: !reference {path: child.yaml, anchor: name}\n`,
      );

      const result = loadYamlWithReferencesSync(`${tempDir}/main.yaml`);
      expect(result).toEqual({ child_name: "David" });
    });

    it("should extract anchor with loadYamlWithReferencesSync for !reference-all", () => {
      const fsSync = require("fs");
      fsSync.writeFileSync(
        `${tempDir}/child-1.yaml`,
        `name: &name David\nage: &age 25\n`,
      );
      fsSync.writeFileSync(
        `${tempDir}/child-2.yaml`,
        `name: &name Alice\nage: &age 30\n`,
      );
      fsSync.writeFileSync(
        `${tempDir}/main.yaml`,
        `child_ages: !reference-all {glob: "child-*.yaml", anchor: age}\n`,
      );

      const result = loadYamlWithReferencesSync(`${tempDir}/main.yaml`);
      expect(result).toEqual({ child_ages: [25, 30] });
    });

    it("should throw on non-existent anchor with sync variant", () => {
      const fsSync = require("fs");
      fsSync.writeFileSync(`${tempDir}/child.yaml`, `name: &name David\n`);
      fsSync.writeFileSync(
        `${tempDir}/main.yaml`,
        `val: !reference {path: child.yaml, anchor: missing}\n`,
      );

      expect(() => loadYamlWithReferencesSync(`${tempDir}/main.yaml`)).toThrow(
        /missing/,
      );
    });
  });
});
