# YAML Reference Resolver Library - Design Specification

## Overview
A Node.js TypeScript library for resolving YAML documents containing `!reference` and `!reference-all` tags. The library uses the `eemeli/yaml` package to parse YAML with custom tags and resolve references to external YAML files.

**YAML Tag Syntax Examples:**
```yaml
# Single file reference (mapping syntax)
database: !reference
  path: ./config/database.yaml

# Multiple file reference (mapping syntax)
configs: !reference-all
  glob: ./configs/*.yaml

# Inline mapping syntax
settings: !reference {path: ./settings/production.yaml}

files: !reference-all {glob: ./data/*.yaml}
```

## Core Requirements

### 1. Custom YAML Tags and Classes

#### 1.1 `!reference` Tag
- **Tag Name**: `!reference`
- **Class**: `Reference`
- **Properties**:
  - `_location` (string): Absolute path to the YAML file where this `!reference` tag was found. This is automatically set by the library during parsing based on the file being processed.
  - `path` (string): Relative path to another YAML file. Required, explicitly provided by the user in the YAML document.
- **Behavior**: When the YAML parser encounters `!reference`, it should instantiate a `Reference` object with the provided path.
- **Resolution**: The resolution engine should resolve the YAML content of the reference relative to the file containing the `!reference` tag.

#### 1.2 `!reference-all` Tag  
- **Tag Name**: `!reference-all`
- **Class**: `ReferenceAll`
- **Properties**:
  - `_location` (string): Absolute path to the YAML file where this `!reference-all` tag was found. This is automatically set by the library during parsing based on the file being processed.
  - `glob` (string): Glob pattern to match YAML files. Required, explicitly provided by the user in the YAML document.
- **Behavior**: When the YAML parser encounters `!reference-all`, it should instantiate a `ReferenceAll` object with the provided glob pattern.
- **Resolution**: The resolution engine should resolve the YAML content of all references found in the files matched by the glob pattern relative to the file containing the `!reference-all` tag. Files are resolved in deterministic alphabetical order.

#### 1.3 Implementation Details
- Both classes should be exported from the library
- Use `eemeli/yaml`'s tag system to register these custom tags
- The parser should handle inline mapping syntax (e.g., `!reference {path: file.yaml}`) and block mapping syntax (e.g., `!reference\n  path: file.yaml`)
- Scalar syntax (e.g., `!reference file.yaml`) is NOT supported

### 2. Resolution Engine

#### 2.1 `loadAndResolve(filePath)` Method
- **Signature**: `loadAndResolve(filePath: string): Promise<any>`
- **Input**: A file path to a YAML file containing `!reference` and `!reference-all` tags
- **Output**: A new object with all references resolved (no `Reference` or `ReferenceAll` objects remain).
- **Behavior**: Asynchronous resolution of all references using relative path resolution relative to each file using a `!reference` tag.

#### 2.2 `_loadReferences(filePath)` utility method
- **Signature**: `_loadReferences(filePath: string): Promise<any>`
- **Input**: A file path to a YAML file containing `!reference` and `!reference-all` tags
- **Output**: A new object with some `Reference` and `ReferenceAll` objects representing the tags in the file.
- **Behavior**: Properly parses nodes with `!reference` and `!reference-all` tags to produce `Reference` and `ReferenceAll` objects in an intermediate result representation.

#### 2.3 `_recursivelyResolveReferences(referenceObj)` utility method
- **Signature**: `_recursivelyResolveReferences(referenceObj: any): Promise<any>`
- **Input**: Any object. May contain `Reference` or `ReferenceAll` objects.
- **Output**: A new object with all references resolved (no `Reference` or `ReferenceAll` objects remain).
- **Behavior**: Asynchronous resolution of all references using relative path resolution relative to each file using a `!reference` tag.

#### 2.4 Resolution Rules

**For `Reference` objects:**
1. Parse the `path` property from the YAML mapping following the `!reference` tag. For example:
   ```yaml
   # Block syntax  
   config: !reference
     path: ./config/database.yaml
   
   # Inline mapping syntax
   config: !reference {path: ./config/database.yaml}
   ```
2. The `_location` property is automatically set to the absolute path of the file containing this `Reference` object during parsing.
3. Read and parse the referenced YAML file relative to the `_location` property.
4. Recursively resolve any references within that file using the referenced file's directory as the base path
5. Replace the `Reference` object with the resolved content

**For `ReferenceAll` objects:**
1. Parse the `glob` property from the YAML mapping following the `!reference-all` tag. For example:
   ```yaml
   # Block syntax
   configs: !reference-all
     glob: ./configs/*.yaml
   
   # Inline mapping syntax
   configs: !reference-all {glob: ./configs/*.yaml}
   ```
2. The `_location` property is automatically set to the absolute path of the file containing this `ReferenceAll` object during parsing.
3. Evaluate glob pattern relative to the `_location` property.
4. For each matching YAML file:
   - Read and parse the file
   - Recursively resolve any references within that file using the file's directory as the base path
5. Replace the `ReferenceAll` object with an array of resolved contents (files are sorted alphabetically for deterministic ordering)
6. If no files are found, throw an error indicating that no files matched the glob pattern.

**Deterministic Ordering**: The `!reference-all` tag resolves files in alphabetical order to ensure consistent, predictable results across different systems and runs. This prevents non-deterministic behavior that could occur from filesystem enumeration order differences.

#### 2.5 Error Handling
- Throw descriptive errors for:
  - Missing referenced files
  - Invalid YAML in referenced files
  - Circular references (detect and prevent infinite loops by tracking visited file paths during resolution)
  - Invalid glob patterns

### 3. CLI Interface

#### 3.1 Command Specification
- **Command Name**: `yaml-reference-cli` (configurable via package.json `bin` field)
- **Input**: File path to a YAML file containing `!reference` and/or `!reference-all` tags
- **Output**: Resolved JSON to stdout with keys sorted alphabetically and 2-space indentation
- **Exit Codes**: 
  - `0`: Success
  - `1`: General error (!reference failed to find file, !reference-all failed to find any files, etc.)

#### 3.2 CLI Behavior
```bash
# Basic usage
yaml-reference-cli config.yaml

# With conversion back into YAML (pretty-print)
yaml-reference-cli config.yaml | yq -P

# Dump compiled output to YAML file
yaml-reference-cli config.yaml | yq -P > .compiled/config.yaml
```

#### 3.3 CLI Arguments and Options
- `file_path`: Required positional argument for the input YAML file path containing `!reference` and/or `!reference-all` tags
- `--help, -h`: Show help message (only supported option)

### 4. Testing Requirements

#### 4.1 Test Structure
- Use Jest or similar testing framework
- Test files should be in `__tests__/` directory
- Mock file system operations for unit tests
- Integration tests with actual file system

#### 4.2 Test Scenarios
1. **Basic Reference Resolution**
   - Simple `!reference` to another YAML file
   - Verify resolved content replaces reference

2. **Nested References**
   - Chain of references (A → B → C)
   - Verify recursive resolution works

3. **ReferenceAll Resolution**
   - `!reference-all` with glob pattern
   - Verify array of resolved contents

4. **Mixed References**
   - Document containing both `!reference` and `!reference-all`
   - Verify proper resolution order

5. **Error Cases**
   - Missing referenced file
   - Invalid YAML syntax
   - Circular reference detection
   - Invalid glob pattern

6. **CLI Tests**
   - Pass file path to CLI, verify JSON output with sorted keys and 2-space indentation
   - Error cases produce appropriate exit codes
   - Help flag displays usage information

### 5. Project Structure

```
yaml-reference-ts/
├── src/
│   ├── index.ts              # Main exports
│   ├── Reference.ts          # Reference class
│   ├── ReferenceAll.ts       # ReferenceAll class
│   ├── resolver.ts           # loadAndResolve implementation
│   ├── parser.ts             # YAML parser with custom tags
│   └── cli/
│       └── index.ts          # CLI implementation
├── __tests__/
│   ├── resolver.test.ts
│   ├── parser.test.ts
│   └── cli.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── Design.md (this file)
```

### 6. Dependencies

#### 6.1 Production Dependencies
- `yaml` (eemeli/yaml)
- `glob`

#### 6.2 Development Dependencies
- `typescript`
- `jest`
- `@types/node`
- `ts-jest`
- `@types/glob`

### 7. API Design

#### 7.1 Main Exports
```typescript
// From index.ts
export { Reference } from './Reference';
export { ReferenceAll } from './ReferenceAll';
export { loadAndResolve } from './resolver';
export { parseYamlWithReferences } from './parser';

// Main function for loading and resolving YAML files
export async function loadAndResolve(filePath: string): Promise<any>;
```

#### 7.2 Type Definitions
```typescript
interface Reference {
  _location: string;
  path: string;
}

interface ReferenceAll {
  _location: string;
  glob: string;
}

type YamlContent = any; // Could be refined based on use cases
```

### 8. Implementation Notes

#### 8.1 YAML Tag Registration
- Register `!reference` tag to instantiate `Reference` class
- Register `!reference-all` tag to instantiate `ReferenceAll` class
- Ensure tags work with YAML's schema system

#### 8.2 File Resolution
- Use Node.js `fs/promises` for file operations
- Expect the user to use relative paths.

#### 8.3 Performance Considerations
- Cache resolved files to avoid re-reading
- Consider depth limits for recursive resolution
- Handle large numbers of files in `ReferenceAll`

### 9. Acceptance Criteria

1. ✅ Library can parse YAML with `!reference` and `!reference-all` tags using mapping syntax only
2. ✅ `_recursivelyResolveReferences` correctly resolves nested references with proper `_location` tracking
3. ✅ `_loadReferences` correctly handles custom tags to produce objects containing `Reference` + `ReferenceAll` instances with `_location` set
4. ✅ CLI reads from given file path and writes JSON to stdout with sorted keys and 2-space indentation
5. ✅ Error cases are handled with descriptive messages
6. ✅ Unit tests cover all specified scenarios
7. ✅ Package exports are properly typed for TypeScript users
8. ✅ Documentation includes usage examples for both library and CLI

### 10. Next Steps for Implementation

1. Set up TypeScript project with proper configuration
2. Install dependencies (`yaml`, `glob`, testing framework)
3. Implement `Reference` and `ReferenceAll` classes
4. Implement YAML parser with custom tag registration
5. Implement `_recursivelyResolveReferences` with recursive resolution
6. Create CLI interface
7. Write comprehensive test suite
8. Document usage examples
