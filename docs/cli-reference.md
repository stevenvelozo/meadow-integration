# CLI Reference

The `meadow-integration` CLI (also available as `mdwint` when installed globally) provides commands for transforming, analyzing, and merging tabular data.

## Global Usage

```shell
npx meadow-integration [command] [options]

# Or from the repository:
npm start -- [command] [options]
```

---

## csvcheck

Analyze a CSV file and produce column-level statistics.

```shell
npx meadow-integration csvcheck <file> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<file>` | Path to the CSV file to analyze |

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --file <filepath>` | Alternate way to specify the CSV file |
| `-o, --output <filepath>` | Output file path. Default: `./CSV-Stats-[filename].json` |
| `-r, --records` | Include all parsed records in the output |

**Output:** A JSON file containing:
- `RowCount` / `ColumnCount` -- Number of data rows and columns
- `Headers` -- Array of column names
- `FirstRow` / `LastRow` -- The first and last records
- `ColumnStatistics` -- Per-column: Count, EmptyCount, NumericCount, FirstValue, LastValue

**Example:**
```shell
npx meadow-integration csvcheck ./data/books.csv -o book-stats.json
```

---

## csvtransform

Transform a CSV file into a Comprehension JSON file.

```shell
npx meadow-integration csvtransform <file> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<file>` | Path to the CSV file to transform |

**Options:**
| Option | Description |
|--------|-------------|
| `-e, --entity <name>` | Entity name in the comprehension |
| `-n, --guidname <name>` | GUID column name (e.g. `GUIDBook`) |
| `-g, --guidtemplate <template>` | Pict template for GUID values (e.g. `Book_{~D:Record.id~}`) |
| `-c, --columns <mappings>` | Inline column mappings: `Col1={~D:col1~},Col2={~D:col2~}` |
| `-m, --mappingfile <path>` | Path to a JSON mapping file |
| `-i, --incoming <path>` | Existing comprehension file to merge into |
| `-o, --output <path>` | Output file path |
| `-x, --extended` | Output full operation state, not just the comprehension |
| `-q, --quotedelimiter <char>` | Quote delimiter character (default: `"`) |

**Priority of configuration:**
1. Implicit -- auto-detected from the first CSV row
2. Explicit -- loaded from a mapping file (`-m`)
3. User -- command-line options (`-e`, `-g`, `-c`, etc.)

Each layer overrides the previous.

**Example:**
```shell
# With CLI options
npx meadow-integration csvtransform ./books.csv \
  -e Book -n GUIDBook -g "Book_{~D:Record.id~}" \
  -o books.json

# With mapping file
npx meadow-integration csvtransform ./books.csv \
  -m mapping_Book.json -o books.json

# Merging into existing comprehension
npx meadow-integration csvtransform ./books.csv \
  -m mapping_Author.json \
  -i books.json -o books.json
```

---

## tsvtransform

Transform a TSV file into a Comprehension.  Same interface as `csvtransform` but uses tab delimiters.

```shell
npx meadow-integration tsvtransform <file> [options]
```

All options are the same as `csvtransform`.  The delimiter is automatically set to tab (`\t`).

---

## jsonarraytransform

Transform a JSON array file into a Comprehension.

```shell
npx meadow-integration jsonarraytransform <file> [options]
```

All options are the same as `csvtransform`.  The input file must contain a valid JSON array.

---

## comprehensionintersect

Merge two Comprehension files together.  Records with the same GUID are merged (later values overwrite earlier ones).

```shell
npx meadow-integration comprehensionintersect <primary_file> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --intersect <path>` | Secondary comprehension file to merge |
| `-e, --entity <name>` | Entity name to merge (auto-detected if omitted) |
| `-o, --output <path>` | Output file path |

**Example:**
```shell
npx meadow-integration comprehensionintersect Set1.json \
  -i Set2.json -e Document -o merged.json
```

---

## comprehensionarray

Convert an object-keyed Comprehension into a JSON array.

```shell
npx meadow-integration comprehensionarray <file> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-e, --entity <name>` | Entity to extract (auto-detected if omitted) |
| `-o, --output <path>` | Output file path |

**Example:**
```shell
npx meadow-integration comprehensionarray books.json -e Book -o books-array.json
```

---

## objectarraytocsv

Convert a JSON array or entity comprehension to CSV format.

```shell
npx meadow-integration objectarraytocsv <file> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-e, --entity <name>` | Entity key to extract from the file (optional; expects a plain array if omitted) |
| `-o, --output <path>` | Output CSV file path |

Nested objects are flattened using dot notation (e.g. `address.city`).

---

## load_comprehension

Push a Comprehension to Meadow REST APIs via the Integration Adapter.

```shell
npx meadow-integration load_comprehension <file> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --prefix <prefix>` | GUID prefix for the push |
| `-e, --entityguidprefix <prefix>` | Per-entity GUID prefix |

This command automatically creates Integration Adapters for each entity in the comprehension and pushes records via upsert operations to the configured Meadow server.

---

## entitycomprehensionsfromtabularfolders

Generate entity comprehensions from a folder of tabular data files.

```shell
npx meadow-integration entitycomprehensionsfromtabularfolders <folder> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-e, --entity <name>` | Force all files to a specific entity |
| `-m, --mapping <path>` | Mapping hints file |
| `-o, --output <path>` | Output file path |

---

## serve

Start the Meadow Integration REST API server.  See [REST API Reference](rest-api-reference.md) for full endpoint documentation.

```shell
npx meadow-integration serve [options]
```

**Aliases:** `server`, `rest`

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Port to listen on (default: `8086`) |

The `MEADOW_INTEGRATION_PORT` environment variable is also respected.

**Example:**
```shell
npx meadow-integration serve -p 3000
```
