# csvtransform

Transform a CSV file into a Comprehension JSON file. This is the primary command for converting tabular data into the Meadow Comprehension format. It supports implicit mapping (auto-detected from column headers), explicit mapping files, and command-line configuration options.

**Aliases:** `csv_t`, `csv_transform`

## Usage

```shell
mdwint csvtransform <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the CSV file to transform |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --entity <name>` | Entity name in the Comprehension | Auto-detected from filename |
| `-n, --guidname <name>` | Name of the GUID column in the generated Comprehension | `GUID<Entity>` |
| `-g, --guidtemplate <template>` | Pict template for generating the entity GUID | `GUID-<Entity>-{~Data:Record.<first_column>~}` |
| `-c, --columns <mappings>` | Inline column mappings in `Key={~D:col~}` format | Auto-detected 1:1 mapping |
| `-m, --mappingfile <path>` | Path to a JSON mapping file | -- |
| `-i, --incoming <path>` | Existing Comprehension file to merge into | -- |
| `-o, --output <path>` | Output file path | `./CSV-Comprehension-<filename>.json` |
| `-x, --extended` | Output full operation state, not just the Comprehension | `false` |
| `-q, --quotedelimiter <char>` | Quote delimiter character for CSV parsing | `"` |

## Configuration Priority

When running a transform, three layers of configuration are merged. Each layer overrides the previous:

1. **Implicit** -- Auto-detected from the first CSV row. The entity name is derived from the filename, and a 1:1 column mapping is generated.
2. **Explicit** -- Loaded from a mapping file via `-m`. See [Mapping Files](../mapping-files.md) for the full specification.
3. **User** -- Command-line options (`-e`, `-n`, `-g`, `-c`). These always take highest priority.

## Output Format

The standard output is a Comprehension JSON object:

```json
{
  "Book": {
    "Book_1": {
      "GUIDBook": "Book_1",
      "Title": "The Hunger Games",
      "Language": "eng",
      "ISBN": "0439023483"
    },
    "Book_2": {
      "GUIDBook": "Book_2",
      "Title": "Harry Potter",
      "Language": "eng",
      "ISBN": "0439554934"
    }
  }
}
```

When the `-x` flag is used, the output includes the full operation state with configuration details, implicit/explicit configurations, and parsed row counts.

## Examples

### Implicit transform (auto-detect everything)

```shell
mdwint csvtransform ./data/books.csv -o books.json
```

The entity name, GUID template, and column mappings are all auto-detected from the filename and CSV headers.

### Transform with CLI options

```shell
mdwint csvtransform ./data/books.csv \
  -e Book \
  -n GUIDBook \
  -g "Book_{~D:Record.id~}" \
  -o books.json
```

### Transform with inline column mappings

```shell
mdwint csvtransform ./data/books.csv \
  -e Book \
  -g "Book_{~D:Record.id~}" \
  -c "Title={~D:Record.title~},Language={~D:Record.language_code~},ISBN={~D:Record.isbn~}" \
  -o books.json
```

### Transform with a mapping file

```shell
mdwint csvtransform ./data/books.csv \
  -m mapping_Book.json \
  -o books.json
```

Where `mapping_Book.json` contains:

```json
{
  "Entity": "Book",
  "GUIDTemplate": "Book_{~D:Record.id~}",
  "Mappings": {
    "Title": "{~D:Record.title~}",
    "Language": "{~D:Record.language_code~}",
    "ISBN": "{~D:Record.isbn~}"
  }
}
```

### Merge into an existing Comprehension

```shell
# First pass: create Book entities
mdwint csvtransform ./data/books.csv \
  -m mapping_Book.json \
  -o store.json

# Second pass: add Author entities to the same file
mdwint csvtransform ./data/books.csv \
  -m mapping_Author.json \
  -i store.json \
  -o store.json
```

### Extended output for debugging

```shell
mdwint csvtransform ./data/books.csv \
  -m mapping_Book.json \
  -x \
  -o debug-output.json
```

### Custom quote delimiter

```shell
mdwint csvtransform ./data/pipe-quoted.csv \
  -m mapping.json \
  -q "'" \
  -o output.json
```

## Tips

- Use `csvcheck` first to inspect your CSV and get the exact column header names for your mapping templates.
- When building multi-entity Comprehensions from a single CSV, use the `-i` flag on subsequent passes to merge entities into one file.
- Inline column mappings (`-c`) do not support commas or equal signs within template values. Use a mapping file (`-m`) for complex mappings.
- Duplicate GUIDs within the same transform run are merged automatically, with later values overwriting earlier ones.
- The `-x` flag is useful for debugging mapping issues. It outputs the full operation state including which configuration layer was used.

## Notes

- If no output file is specified, the default is `./CSV-Comprehension-<filename>.json`.
- If no incoming comprehension file is specified, the default path is checked; if it exists, it is loaded and merged into.
- The command uses streaming line-by-line parsing, so it can handle large CSV files without loading the entire file into memory.

## See Also

- [Mapping Files](../mapping-files.md) -- Full mapping file specification
- [Comprehensions](../comprehensions.md) -- Core data structure documentation
- [tsvtransform](tsvtransform.md) -- Same command for tab-delimited files
- [jsonarraytransform](jsonarraytransform.md) -- Same command for JSON array files
