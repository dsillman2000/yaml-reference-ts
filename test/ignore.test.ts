import {
  parseYamlWithReferences,
  parseYamlWithReferencesSync,
  loadYamlWithReferences,
} from "../src";
import {
  createTempDir,
  createTestYamlFile,
  cleanupTempDir,
} from "./test-utils";

describe("!ignore tag suites (combined)", () => {
  // Original basic behavior tests
  describe("basic !ignore behavior", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("parseYamlWithReferences returns undefined for top-level !ignore", async () => {
      const content = `!ignore {}`;
      const filePath = await createTestYamlFile(tempDir, "ignored.yaml", content);

      const parsed = await parseYamlWithReferences(filePath);
      expect(parsed).toBeUndefined();
    });

    it("loadYamlWithReferences returns null for a top-level !ignore document", async () => {
      const content = `!ignore {}`;
      const filePath = await createTestYamlFile(tempDir, "ignored.yaml", content);

      const resolved = await loadYamlWithReferences(filePath);
      expect(resolved).toBeNull();
    });

    it("!reference to a file whose root is !ignore yields an undefined property", async () => {
      await createTestYamlFile(tempDir, "ref.yaml", `!ignore {}`);
      const main = `item: !reference {path: ref.yaml}`;
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", main);

      const result: any = await loadYamlWithReferences(mainPath);
      // Property should exist but be undefined (ignored file is treated as erased)
      expect(Object.prototype.hasOwnProperty.call(result, "item")).toBe(true);
      expect(result.item).toBeUndefined();
    });

    it("!reference-all omits files whose root is !ignore", async () => {
      const fs = require("fs");
      const path = require("path");
      const refsDir = path.join(tempDir, "refs");
      fs.mkdirSync(refsDir, { recursive: true });

      await createTestYamlFile(tempDir, "refs/a.yaml", `value: 1`);
      await createTestYamlFile(tempDir, "refs/b.yaml", `!ignore {}`);

      const main = `items: !reference-all {glob: "refs/*.yaml"}`;
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", main);

      const result: any = await loadYamlWithReferences(mainPath);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0]).toEqual({ value: 1 });
    });
  });

  // Extra cases added earlier
  describe("!ignore additional cases", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("extractAnchor finds anchors declared inside !ignore (async)", async () => {
      const content = `internal: !ignore\n  secret: &s 42\n`;
      const file = await createTestYamlFile(tempDir, "a.yaml", content);

      const val = await parseYamlWithReferences(file, { extractAnchor: "s" });
      expect(val).toBe(42);
    });

    it("extractAnchor finds anchors declared inside !ignore (sync)", () => {
      const content = `internal: !ignore\n  secret: &s 99\n`;
      const filePath = require("path").join(tempDir, "b.yaml");
      const fs = require("fs");
      fs.writeFileSync(filePath, content, "utf8");

      const val = parseYamlWithReferencesSync(filePath, { extractAnchor: "s" });
      expect(val).toBe(99);
    });

    it("alias referring to anchor inside !ignore is resolved", async () => {
      const content = `internal: !ignore\n  v: &v 10\ncopy: *v\n`;
      const file = await createTestYamlFile(tempDir, "alias.yaml", content);

      const parsed: any = await parseYamlWithReferences(file);
      // internal should be removed, copy should be present
      expect(parsed.internal).toBeUndefined();
      expect(parsed.copy).toBe(10);
    });

    it("!reference-all can extract anchors from files whose content is !ignore", async () => {
      const fs = require("fs");
      const path = require("path");
      const refs = path.join(tempDir, "refs");
      fs.mkdirSync(refs, { recursive: true });

      const app1 = `internal: !ignore\n  db: &db { host: db1, port: 1 }\n`;
      const app2 = `internal: !ignore\n  db: &db { host: db2, port: 2 }\n`;
      await createTestYamlFile(tempDir, "refs/app1.yaml", app1);
      await createTestYamlFile(tempDir, "refs/app2.yaml", app2);

      const main = `databases: !reference-all {glob: "refs/*.yaml", anchor: db}`;
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", main);

      const res: any = await loadYamlWithReferences(mainPath);
      expect(Array.isArray(res.databases)).toBe(true);
      expect(res.databases).toHaveLength(2);
      // each item should be an object with host/port
      expect(res.databases[0]).toHaveProperty("host");
      expect(res.databases[0]).toHaveProperty("port");
    });

    it("sequence elements tagged !ignore are removed from arrays", async () => {
      const content = `arr: [1, !ignore {a:1}, 2]`;
      const file = await createTestYamlFile(tempDir, "seq.yaml", content);

      const parsed: any = await parseYamlWithReferences(file);
      expect(Array.isArray(parsed.arr)).toBe(true);
      expect(parsed.arr).toEqual([1, 2]);
    });
  });

  // Parser/resolver specific tests added later
  describe("!ignore parser and resolver semantics", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("parser removes map entries whose value is tagged !ignore (async)", async () => {
      const content = `a: !ignore {x:1}\nb: 2\n`;
      const file = await createTestYamlFile(tempDir, "m1.yaml", content);

      const parsed: any = await parseYamlWithReferences(file);
      expect(parsed).toEqual({ b: 2 });
    });

    it("parser removes array elements tagged !ignore (sync)", () => {
      const content = `arr: [1, !ignore {z:9}, 3]`;
      const filePath = require("path").join(tempDir, "a1.yaml");
      const fs = require("fs");
      fs.writeFileSync(filePath, content, "utf8");

      const parsed: any = parseYamlWithReferencesSync(filePath);
      expect(parsed.arr).toEqual([1, 3]);
    });

    it("parser removes scalar values tagged !ignore", async () => {
      const content = `s: !ignore "secret"\nkeep: yes\n`;
      const file = await createTestYamlFile(tempDir, "sc.yaml", content);

      const parsed: any = await parseYamlWithReferences(file);
      expect(parsed).toEqual({ keep: "yes" });
    });

    it("parser returns undefined for root-level !ignore (sync)", () => {
      const content = `!ignore {}`;
      const filePath = require("path").join(tempDir, "root.yaml");
      const fs = require("fs");
      fs.writeFileSync(filePath, content, "utf8");

      const parsed = parseYamlWithReferencesSync(filePath);
      expect(parsed).toBeUndefined();
    });

    it("resolver keeps a map key when its value is a Reference to an ignored file (property exists and is undefined)", async () => {
      await createTestYamlFile(tempDir, "ignored.yaml", `!ignore {}`);
      const main = `cfg: !reference {path: ignored.yaml}`;
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", main);

      const res: any = await loadYamlWithReferences(mainPath);
      expect(Object.prototype.hasOwnProperty.call(res, "cfg")).toBe(true);
      expect(res.cfg).toBeUndefined();
    });

    it("resolver preserves undefined element for Reference inside arrays when target is ignored", async () => {
      // create refs directory
      const fs = require("fs");
      const path = require("path");
      const refs = path.join(tempDir, "refs");
      fs.mkdirSync(refs, { recursive: true });

      await createTestYamlFile(refs, "x.yaml", `!ignore {}`);
      const main = `items: [ !reference {path: "refs/x.yaml"} ]`;
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", main);

      const res: any = await loadYamlWithReferences(mainPath);
      expect(Array.isArray(res.items)).toBe(true);
      // element should be present (undefined)
      expect(res.items.length).toBe(1);
      expect(res.items[0]).toBeUndefined();
    });
  });
});
