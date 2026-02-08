/**
 * Parser module for handling YAML with custom !reference and !reference-all tags
 * Uses the eemeli/yaml package to parse YAML with custom tags
 */

import { parse, YAMLMap } from "yaml";
import { Reference } from "./Reference";
import { ReferenceAll } from "./ReferenceAll";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";

/**
 * Custom tag for !reference
 */
const referenceTag = {
    identify: (value: any) => value instanceof Reference,
    tag: "!reference",
    collection: "map" as const,
    resolve: (value: any, _: (message: string) => void) => {
        // value should be a YAMLMap for mapping syntax
        if (!(value instanceof YAMLMap)) {
            throw new Error(
                '!reference tag must be followed by a mapping with a "path" property',
            );
        }

        // Get the path property from the map
        const pathValue = value.get("path");
        if (!pathValue) {
            throw new Error('!reference tag requires a "path" property');
        }

        if (typeof pathValue !== "string") {
            throw new Error('!reference "path" property must be a string');
        }

        return new Reference(pathValue);
    },
};

/**
 * Custom tag for !reference-all
 */
const referenceAllTag = {
    identify: (value: any) => value instanceof ReferenceAll,
    tag: "!reference-all",
    collection: "map" as const,
    resolve: (value: any, _: (message: string) => void) => {
        // value should be a YAMLMap for mapping syntax
        if (!(value instanceof YAMLMap)) {
            throw new Error(
                '!reference-all tag must be followed by a mapping with a "glob" property',
            );
        }

        // Get the glob property from the map
        const globValue = value.get("glob");
        if (!globValue) {
            throw new Error('!reference-all tag requires a "glob" property');
        }

        if (typeof globValue !== "string") {
            throw new Error('!reference-all "glob" property must be a string');
        }

        return new ReferenceAll(globValue);
    },
};

// Custom tags array for parsing
const customTags = [referenceTag, referenceAllTag];

/**
 * Parse YAML content with custom !reference and !reference-all tags
 * @param filePath - Path to the YAML file to be parsed (used for setting _location)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export function parseYamlWithReferencesSync(filePath: string): any {
    try {
        const absolutePath = path.resolve(filePath);
        const content = fsSync.readFileSync(absolutePath, "utf8");
        const parsed = parse(content, { customTags });

        // Process the parsed document to set _location on Reference and ReferenceAll objects
        return processParsedDocument(parsed, filePath);
    } catch (error) {
        // Re-throw the error with context about which file failed to parse
        throw new Error(
            `Failed to parse YAML file ${filePath}: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Parse YAML content with custom !reference and !reference-all tags (async).
 * @param filePath - Path to the YAML file to be parsed (used for setting _location)
 * @returns Parsed object with Reference and ReferenceAll instances
 */
export async function parseYamlWithReferences(filePath: string): Promise<any> {
    try {
        const absolutePath = path.resolve(filePath);
        const content = await fs.readFile(absolutePath, "utf8");
        const parsed = parse(content, { customTags });

        // Process the parsed document to set _location on Reference and ReferenceAll objects
        return processParsedDocument(parsed, filePath);
    } catch (error) {
        // Re-throw the error with context about which file failed to parse
        throw new Error(
            `Failed to parse YAML file ${filePath}: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Recursively process parsed document to set _location on Reference and ReferenceAll objects
 */
function processParsedDocument(obj: any, filePath: string): any {
    if (obj instanceof Reference) {
        obj._location = filePath;
        return obj;
    }

    if (obj instanceof ReferenceAll) {
        obj._location = filePath;
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => processParsedDocument(item, filePath));
    }

    if (obj && typeof obj === "object") {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = processParsedDocument(value, filePath);
        }
        return result;
    }

    return obj;
}
