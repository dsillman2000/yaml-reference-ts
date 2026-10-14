import {
  parseYamlWithReferences,
  parseYamlWithReferencesSync,
  loadYamlWithReferences,
  loadYamlWithReferencesSync,
} from "../src";
import {
  createTempDir,
  createTestYamlFile,
  cleanupTempDir,
} from "./test-utils";

describe("multi-document YAML files", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("parser", () => {
    it("parses a multi-document file as an array of documents (async)", async () => {
      const filePath = await createTestYamlFile(
        tempDir,
        "multi.yaml",
        `a: 1\n---\nb: 2\n---\n- x\n- y\n`,
      );

      const parsed = await parseYamlWithReferences(filePath);
      expect(parsed).toEqual([{ a: 1 }, { b: 2 }, ["x", "y"]]);
    });

    it("parses a multi-document file as an array of documents (sync)", async () => {
      const filePath = await createTestYamlFile(
        tempDir,
        "multi.yaml",
        `a: 1\n---\nb: 2\n`,
      );

      const parsed = parseYamlWithReferencesSync(filePath);
      expect(parsed).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("drops documents whose root is !ignore", async () => {
      const filePath = await createTestYamlFile(
        tempDir,
        "multi.yaml",
        `!ignore header\n---\na: 1\n---\n!ignore {footer: true}\n`,
      );

      const parsed = await parseYamlWithReferences(filePath);
      expect(parsed).toEqual([{ a: 1 }]);
    });

    it("leaves a single document with an explicit start marker unwrapped", async () => {
      const filePath = await createTestYamlFile(
        tempDir,
        "single.yaml",
        `---\na: 1\n`,
      );

      const parsed = await parseYamlWithReferences(filePath);
      expect(parsed).toEqual({ a: 1 });
    });

    it("parses an empty trailing document as null", async () => {
      const filePath = await createTestYamlFile(
        tempDir,
        "multi.yaml",
        `a: 1\n---\n`,
      );

      const parsed = await parseYamlWithReferences(filePath);
      expect(parsed).toEqual([{ a: 1 }, null]);
    });
  });

  describe("root input file", () => {
    const content = [
      `v: 1`,
      `data: !reference ref.yaml`,
      `---`,
      `.anchors: !ignore`,
      `  something: &something unused`,
      `---`,
      `!ignore`,
      `Totally ignored document.`,
      `---`,
      `flat: !flatten [[1, 2], 3]`,
      `merged: !merge [{a: 1, b: 2}, {b: 3}]`,
    ].join("\n");
    const expected = [
      { v: 1, data: { "ref-value": 42 } },
      {},
      { flat: [1, 2, 3], merged: { a: 1, b: 3 } },
    ];

    it("resolves each document into an array (async)", async () => {
      await createTestYamlFile(tempDir, "ref.yaml", `ref-value: 42`);
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", content);

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual(expected);
    });

    it("resolves each document into an array (sync)", async () => {
      await createTestYamlFile(tempDir, "ref.yaml", `ref-value: 42`);
      const mainPath = await createTestYamlFile(tempDir, "main.yaml", content);

      const resolved = loadYamlWithReferencesSync(mainPath);
      expect(resolved).toEqual(expected);
    });

    it("resolves to an empty array when every document is !ignore", async () => {
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `!ignore a\n---\n!ignore b\n`,
      );

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual([]);
    });
  });

  describe("!reference", () => {
    it("throws when targeting a multi-document file (async)", async () => {
      await createTestYamlFile(tempDir, "multi.yaml", `a: 1\n---\nb: 2\n`);
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `item: !reference multi.yaml`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /Cannot !reference multi-document file/,
      );
    });

    it("throws when targeting a multi-document file (sync)", async () => {
      await createTestYamlFile(tempDir, "multi.yaml", `a: 1\n---\nb: 2\n`);
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `item: !reference multi.yaml`,
      );

      expect(() => loadYamlWithReferencesSync(mainPath)).toThrow(
        /Cannot !reference multi-document file/,
      );
    });

    it("throws even when the extra documents are !ignore", async () => {
      await createTestYamlFile(
        tempDir,
        "multi.yaml",
        `a: 1\n---\n!ignore footer\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `item: !reference multi.yaml`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /Cannot !reference multi-document file/,
      );
    });
  });

  describe("!reference-all", () => {
    it("chains every document of a multi-document file (async)", async () => {
      await createTestYamlFile(
        tempDir,
        "docs.yaml",
        `Hello: World\n---\nGoodbye: World\n---\n- Apple\n- Orange\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `refs: !reference-all docs.yaml`,
      );

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual({
        refs: [{ Hello: "World" }, { Goodbye: "World" }, ["Apple", "Orange"]],
      });
    });

    it("chains every document of a multi-document file (sync)", async () => {
      await createTestYamlFile(tempDir, "docs.yaml", `a: 1\n---\nb: 2\n`);
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `refs: !reference-all docs.yaml`,
      );

      const resolved = loadYamlWithReferencesSync(mainPath);
      expect(resolved).toEqual({ refs: [{ a: 1 }, { b: 2 }] });
    });

    it("keeps file order, then document order, for mixed globs", async () => {
      await createTestYamlFile(tempDir, "data-single.yaml", `key: single`);
      await createTestYamlFile(
        tempDir,
        "data-multi.yaml",
        `key: first\n---\nkey: second\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `items: !reference-all {glob: "data-*.yaml"}`,
      );

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual({
        items: [{ key: "first" }, { key: "second" }, { key: "single" }],
      });
    });

    it("excludes documents whose root is !ignore", async () => {
      await createTestYamlFile(
        tempDir,
        "docs.yaml",
        `!ignore header\n---\nDoc: Name\n---\n!ignore footer\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `content: !merge\n  - !reference-all docs.yaml\n`,
      );

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual({ content: { Doc: "Name" } });
    });

    it("resolves references and aliases within each document", async () => {
      await createTestYamlFile(tempDir, "ref.yaml", `ref-value: 42`);
      await createTestYamlFile(
        tempDir,
        "docs.yaml",
        `one: !reference ref.yaml\n---\nduped:\n  - &data !reference ref.yaml\n  - *data\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `refs: !reference-all docs.yaml`,
      );

      const resolved = await loadYamlWithReferences(mainPath);
      expect(resolved).toEqual({
        refs: [
          { one: { "ref-value": 42 } },
          { duped: [{ "ref-value": 42 }, { "ref-value": 42 }] },
        ],
      });
    });

    it("extracts the anchor from every document", async () => {
      await createTestYamlFile(
        tempDir,
        "data-1.yaml",
        `name: &name Alice\n---\nname: &name Bob\n`,
      );
      await createTestYamlFile(tempDir, "data-2.yaml", `name: &name Charlie\n`);
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `names: !reference-all {glob: "data-*.yaml", anchor: name}`,
      );

      const resolved = loadYamlWithReferencesSync(mainPath);
      expect(resolved).toEqual({ names: ["Alice", "Bob", "Charlie"] });
    });

    it("throws when the anchor is missing from one of the documents", async () => {
      await createTestYamlFile(
        tempDir,
        "data.yaml",
        `name: &name Alice\n---\nname: Bob\n`,
      );
      const mainPath = await createTestYamlFile(
        tempDir,
        "main.yaml",
        `names: !reference-all {glob: "data.yaml", anchor: name}`,
      );

      await expect(loadYamlWithReferences(mainPath)).rejects.toThrow(
        /Anchor "name" not found/,
      );
    });
  });
});
