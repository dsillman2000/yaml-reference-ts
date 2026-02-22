# YAML Reference Resolver (TypeScript)

A Node.js TypeScript library for resolving YAML documents containing `!reference`, `!reference-all`, `!flatten`, and `!merge` tags. The library uses the `eemeli/yaml` package to parse YAML with custom tags and resolve references to external YAML files.

## Features

- **Custom YAML Tags**: Support for `!reference`, `!reference-all`, `!flatten`, and `!merge` tags
- **Recursive Resolution**: Automatically resolves nested references
- **Sequence Flattening**: `!flatten` tag for flattening nested arrays
- **Object Merging**: `!merge` tag for merging sequences of objects with last-write-wins semantics
- **Circular Reference Detection**: Prevents infinite loops with proper error messages
- **Glob Pattern Support**: `!reference-all` supports glob patterns for multiple files
- **CLI Interface**: Command-line tool for resolving YAML files
- **TypeScript Support**: Full type definitions included

## Spec

This Node.js TypeScript library implements the YAML specification for cross-file references in YAML files using tags `!reference`, `!reference-all`, `!flatten` and `!merge` tags as defined in the [yaml-reference-specs project](https://github.com/dsillman2000/yaml-reference-specs).

## Installation

```bash
npm install @dsillman2000/yaml-reference-ts
```

Or for global CLI usage:

```bash
npm install -g @dsillman2000/yaml-reference-ts
```

## YAML Syntax Examples

### Single File Reference

```yaml
# Block mapping syntax
database: !reference
  path: ./config/database.yaml

# Inline mapping syntax  
settings: !reference {path: ./settings/production.yaml}
```

### Multiple File Reference

```yaml
# Block mapping syntax
configs: !reference-all
  glob: ./configs/*.yaml

# Inline mapping syntax
files: !reference-all {glob: ./data/*.yaml}
```

### Sequence Flattening

```yaml
# Block sequence syntax
data: !flatten
  - 1
  - [2, 3]
  - !reference
    path: ./config/item.yaml

# Inline sequence syntax
simple: !flatten [1, 2, 3]
```

### Object Merging

```yaml
# Block sequence syntax
config: !merge
  - {host: localhost, port: 3000}
  - {port: 8080, debug: true}

# Inline sequence syntax
settings: !merge [{a: 1, b: 2}, {b: 3, c: 4}]

# With references
merged: !merge
  - !reference {path: ./defaults.yaml}
  - {override: true}
```

**Note**: For `!reference` and `!reference-all` tags, only mapping syntax is supported. Be sure to conform to the API (`!reference {path: <path>}` or `!reference-all {glob: <glob>}`). For `!flatten` and `!merge` tags, only sequence syntax is supported.

**Deterministic Ordering**: The `!reference-all` tag resolves files in alphabetical order to ensure consistent, predictable results across different systems and runs.

## Library Usage

### Basic Usage

```typescript
import { loadYamlWithReferences } from '@dsillman2000/yaml-reference-ts';

async function loadConfig() {
  try {
    const resolved = await loadYamlWithReferences('./config/main.yaml');
    console.log(resolved);
  } catch (error) {
    console.error('Failed to resolve references:', error);
  }
}
```

### API Reference

#### `loadYamlWithReferences(filePath: string, allowPaths?: string[]): Promise<any>`
Loads a YAML file and resolves all `!reference`, `!reference-all`, `!flatten`, and `!merge` tags, returning the fully resolved object. The optional `allowPaths` parameter restricts which directories can be referenced (see Path Restrictions section).

#### `parseYamlWithReferences(content: string, filePath: string): Promise<any>`
Parses YAML content with custom tags, setting `_location` on Reference and parsing Flatten objects.

#### `loadYamlWithReferencesSync(filePath: string, allowPaths?: string[]): any`
Loads a YAML file and resolves all `!reference`, `!reference-all`, `!flatten`, and `!merge` tags, returning the fully resolved object synchronously. The optional `allowPaths` parameter restricts which directories can be referenced (see Path Restrictions section).

#### `parseYamlWithReferencesSync(content: string, filePath: string): any`
Parses YAML content with custom tags, setting `_location` on Reference and parsing Flatten objects synchronously.

#### `Reference` Class
Represents a `!reference` tag with properties:
- `_location`: Absolute path to the file containing the reference
- `path`: Relative path to the referenced YAML file

#### `ReferenceAll` Class
Represents a `!reference-all` tag with properties:
- `_location`: Absolute path to the file containing the reference
- `glob`: Glob pattern to match YAML files

#### `Flatten` Class
Represents a `!flatten` tag with properties:
- `sequence`: The sequence to be flattened (can contain nested arrays, Reference, and ReferenceAll objects)

#### `Merge` Class
Represents a `!merge` tag with properties:
- `sequence`: The sequence of objects to be merged using last-write-wins semantics (can contain Reference and ReferenceAll objects)

## CLI Usage

The package includes a CLI tool called `yaml-reference-cli`:

If an example `config.yaml` contains:
```yaml
services:
  - !reference {path: services/etl-hub.yaml}
  - !reference {path: services/etl-worker.yaml}
connections: !reference-all {glob: databases/*.yaml}
```

With other files containing valid YAML data, then we can use the CLI to visualize the resolved YAML as JSON:

```bash
# Basic usage (resolve references, stdout as json)
$ yaml-reference-cli config.yaml

# Allow references to specific directory outside the current directory
$ yaml-reference-cli config.yaml --allow ../../my-dependency
  {
    "connections": [
      {
        "name": "payments_pg",
        "type": "postgres"
      },
      {
        "name": "transactions_redis",
        "type": "redis"
      }
    ],
    "services": [
      {
        "name": "etl-hub",
        "type": "service"
      },
      {
        "name": "etl-worker",
        "type": "service"
      }
    ]
  }
# Pipe to a file
$ yaml-reference-cli config.yaml > .compiled/config.json

# With allowed paths
$ yaml-reference-cli config.yaml --allow ../shared-configs > .compiled/config.json
```

If you have the `yq` CLI installed ([mikefarah/yq](https://github.com/mikefarah/yq)), resolved YAML can be pretty-printed as well (with keys sorted):

```bash
# Basic usage (resolve references, stdout as json, convert to YAML)
$ yaml-reference-cli config.yaml | yq -P

# With allowed paths
$ yaml-reference-cli config.yaml --allow ../../external-configs | yq -P
  connections:
    - name: payments_pg
      type: postgres
    - name: transactions_redis
      type: redis
  services:
    - name: etl-hub
      type: service
    - name: etl-worker
      type: service
# Pipe to a file
$ yaml-reference-cli config.yaml | yq -P > .compiled/config.yaml

# With allowed paths
$ yaml-reference-cli config.yaml --allow ../app/configs | yq -P > .compiled/config.yaml
```

This basic CLI usage is also explained in the help message.

```bash
yaml-reference-cli --help
```

The CLI supports restricting which directories can be referenced using the `--allow` option:

```bash
# Allow references to parent directory
yaml-reference-cli config.yaml --allow ..

# Multiple allowed paths
yaml-reference-cli config.yaml --allow ../shared --allow ../../common
```

### CLI Output
The CLI outputs JSON with:
- Keys sorted alphabetically
- 2-space indentation
- Exit code 0 for success, 1 for errors

## Path Restrictions

By default, references are only allowed within the directory containing the loaded YAML file and its subdirectories. This provides security by preventing references to files outside the expected scope.

### Default Behavior
- When no `allowPaths` are specified, only files within the same directory as the loaded file (and its subdirectories) can be referenced
- The parent directory of the loaded file is automatically included in allowed paths

### Using `allowPaths` Parameter
To allow references to files in other directories, provide an `allowPaths` array when calling `loadYamlWithReferences()`:

```typescript
// Allow references to files in /etc/config and /var/lib/config
const resolved = await loadYamlWithReferences('./config/main.yaml', [
  '../../../shared/config',
]);
```

### Path Validation Rules
1. **Relative Paths Only**: `!reference` and `!reference-all` tags must use relative paths (absolute paths will throw an error)
2. **Directory-based Allowance**: A reference is allowed if the target file's absolute path starts with any of the allowed directory paths
3. **Automatic Inclusion**: The parent directory of the loaded file is always included in allowed paths, even when `allowPaths` is provided

## Resolution Rules

### For `!reference` tags:
1. The `path` property is parsed from the YAML mapping (must be a relative path)
2. `_location` is automatically set to the absolute path of the containing file
3. The referenced YAML file is read and parsed relative to `_location`
4. The target path is checked against allowed paths (see Path Restrictions)
5. Any references within the referenced file are recursively resolved
6. The `Reference` object is replaced with the resolved content

### For `!reference-all` tags:
1. The `glob` property is parsed from the YAML mapping (must be a relative glob pattern)
2. `_location` is automatically set to the absolute path of the containing file
3. The glob pattern is evaluated relative to `_location`
4. Matching files are filtered based on allowed paths (see Path Restrictions)
5. For each matching YAML file:
   - The file is read and parsed
   - Any references are recursively resolved
6. The `ReferenceAll` object is replaced with an array of resolved contents
7. Files are sorted and resolved in deterministic alphabetical order for consistent results across systems
8. If no files match, an error is thrown

### For `!flatten` tags:
1. The sequence is parsed from the YAML (must be a sequence/array)
3. The sequence is recursively flattened:
   - Nested arrays are flattened into a single-level array
   - `Reference` and `ReferenceAll` objects are resolved first, then flattened
   - Other values are preserved as-is
4. The `Flatten` object is replaced with the flattened array. No elements of the resulting array are themselves arrays.

### For `!merge` tags:
1. The sequence is parsed from the YAML (must be a sequence/array)
2. `Reference` and `ReferenceAll` objects within the sequence are resolved first
3. The sequence is flattened (nested arrays from `!reference-all` or `!flatten` are expanded)
4. Each item in the flattened sequence is validated to be an object (not null, not an array, not a scalar)
5. The objects are merged using last-write-wins (spread) semantics
6. The merge is shallow: nested objects are replaced entirely, not deeply merged
7. The `Merge` object is replaced with the resulting merged object

**Deterministic Behavior**: The library ensures predictable output by:
- Sorting `!reference-all` file matches alphabetically before resolution
- Rejecting scalar syntax for `!reference` and `!reference-all` tags (only mapping syntax is allowed)
- Rejecting mapping syntax for `!flatten` and `!merge` tags (only sequence syntax is allowed)
- Using consistent error messages for validation failures
- Enforcing path restrictions to prevent unauthorized file access

## Error Handling

The library throws descriptive errors for:
- Missing referenced files
- Invalid YAML syntax
- Circular references (detected via visited file path tracking)
- Invalid glob patterns
- Missing required properties (`path` for `!reference`, `glob` for `!reference-all`)
- Absolute paths in `!reference` or `!reference-all` tags (only relative paths are allowed)
- References to files outside allowed paths
- `!flatten` tag applied to non-sequence values
- `!merge` tag applied to a sequence of values that are not mappings

## Development

### Project Structure

```
yaml-reference-ts/
├── src/
│   ├── index.ts              # Main exports
│   ├── Reference.ts          # Reference class
│   ├── ReferenceAll.ts       # ReferenceAll class
│   ├── Merge.ts              # Merge class
│   ├── resolver.ts           # loadAndResolve implementation
│   ├── parser.ts             # YAML parser with custom tags
│   └── cli/
│       └── index.ts          # CLI implementation
├── __tests__/               # Test files
├── doc/
│   └── Design.md           # Design specification
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test -- __tests__/parser.test.ts
```

### Linting

```bash
npm run lint
```

## Dependencies

### Production
- `yaml` (eemeli/yaml): YAML parsing with custom tag support
- `glob`: Pattern matching for `!reference-all` tags

### Development
- TypeScript
- Jest for testing
- ESLint for code quality

## Acknowledgments

Author(s):

- David Sillman <dsillman2000@gmail.com>
- Ryan Johnson <github@ryodine.com>
