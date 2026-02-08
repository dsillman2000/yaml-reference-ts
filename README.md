# YAML Reference Resolver (TypeScript)

A Node.js TypeScript library for resolving YAML documents containing `!reference` and `!reference-all` tags. The library uses the `eemeli/yaml` package to parse YAML with custom tags and resolve references to external YAML files.

## Features

- **Custom YAML Tags**: Support for `!reference` and `!reference-all` tags
- **Recursive Resolution**: Automatically resolves nested references
- **Circular Reference Detection**: Prevents infinite loops with proper error messages
- **Glob Pattern Support**: `!reference-all` supports glob patterns for multiple files
- **CLI Interface**: Command-line tool for resolving YAML files
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install yaml-reference-ts
```

Or for global CLI usage:

```bash
npm install -g yaml-reference-ts
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

**Note**: Only mapping syntax is supported. Be sure to conform to the API (`!reference {path: <path>}` or `!reference-all {glob: <glob>}`).

**Deterministic Ordering**: The `!reference-all` tag resolves files in alphabetical order to ensure consistent, predictable results across different systems and runs.

## Library Usage

### Basic Usage

```typescript
import { loadAndResolve } from 'yaml-reference-ts';

async function loadConfig() {
  try {
    const resolved = await loadAndResolve('./config/main.yaml');
    console.log(resolved);
  } catch (error) {
    console.error('Failed to resolve references:', error);
  }
}
```

### API Reference

#### `loadYamlWithReferences(filePath: string): Promise<any>`
Loads a YAML file and resolves all `!reference` and `!reference-all` tags, returning the fully resolved object.

#### `parseYamlWithReferences(content: string, filePath: string): any`
Parses YAML content with custom tags, setting `_location` on Reference objects.

#### `loadYamlWithReferencesSync(filePath: string): any`
Loads a YAML file and resolves all `!reference` and `!reference-all` tags, returning the fully resolved object synchronously.

#### `parseYamlWithReferencesSync(content: string, filePath: string): any`
Parses YAML content with custom tags, setting `_location` on Reference objects synchronously.

#### `Reference` Class
Represents a `!reference` tag with properties:
- `_location`: Absolute path to the file containing the reference
- `path`: Relative path to the referenced YAML file

#### `ReferenceAll` Class
Represents a `!reference-all` tag with properties:
- `_location`: Absolute path to the file containing the reference
- `glob`: Glob pattern to match YAML files

## CLI Usage

The package includes a CLI tool called `yaml-reference-cli`:

```bash
# Basic usage
yaml-reference-cli config.yaml

# With conversion back to YAML (requires yq)
yaml-reference-cli config.yaml | yq -P

# Save output to file
yaml-reference-cli config.yaml | yq -P > .compiled/config.yaml

# Show help
yaml-reference-cli --help
```

### CLI Output
The CLI outputs JSON with:
- Keys sorted alphabetically
- 2-space indentation
- Exit code 0 for success, 1 for errors

## Resolution Rules

### For `!reference` tags:
1. The `path` property is parsed from the YAML mapping
2. `_location` is automatically set to the absolute path of the containing file
3. The referenced YAML file is read and parsed relative to `_location`
4. Any references within the referenced file are recursively resolved
5. The `Reference` object is replaced with the resolved content

### For `!reference-all` tags:
1. The `glob` property is parsed from the YAML mapping
2. `_location` is automatically set to the absolute path of the containing file
3. The glob pattern is evaluated relative to `_location`
4. For each matching YAML file:
   - The file is read and parsed
   - Any references are recursively resolved
5. The `ReferenceAll` object is replaced with an array of resolved contents
6. Files are sorted and resolved in deterministic alphabetical order for consistent results across systems
7. If no files match, an error is thrown

**Deterministic Behavior**: The library ensures predictable output by:
- Sorting `!reference-all` file matches alphabetically before resolution
- Rejecting scalar syntax (only mapping syntax is allowed)
- Using consistent error messages for validation failures

## Error Handling

The library throws descriptive errors for:
- Missing referenced files
- Invalid YAML syntax
- Circular references (detected via visited file path tracking)
- Invalid glob patterns
- Missing required properties (`path` for `!reference`, `glob` for `!reference-all`)

## Development

### Project Structure

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
