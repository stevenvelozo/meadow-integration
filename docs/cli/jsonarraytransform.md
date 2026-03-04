# jsonarraytransform

Transform a JSON array file into a Comprehension JSON file. This command provides the same mapping and configuration capabilities as [csvtransform](csvtransform.md), but reads from a JSON array instead of a CSV file.

**Aliases:** `jsonarray_t`, `jsonarray_transform`

## Usage

```shell
mdwint jsonarraytransform <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the JSON array file to transform |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --entity <name>` | Entity name in the Comprehension | Auto-detected from filename |
| `-n, --guidname <name>` | Name of the GUID column in the generated Comprehension | `GUID<Entity>` |
| `-g, --guidtemplate <template>` | Pict template for generating the entity GUID | `GUID-<Entity>-{~Data:Record.<first_key>~}` |
| `-c, --columns <mappings>` | Inline column mappings in `Key={~D:col~}` format | Auto-detected 1:1 mapping |
| `-m, --mappingfile <path>` | Path to a JSON mapping file | -- |
| `-i, --incoming <path>` | Existing Comprehension file to merge into | -- |
| `-o, --output <path>` | Output file path | `./JSON-Comprehension-<filename>.json` |
| `-x, --extended` | Output full operation state, not just the Comprehension | `false` |

## Input Format

The input file must contain a valid JSON array of objects:

```json
[
  { "id": 1, "title": "The Hunger Games", "author": "Suzanne Collins" },
  { "id": 2, "title": "Harry Potter", "author": "J.K. Rowling" },
  { "id": 3, "title": "To Kill a Mockingbird", "author": "Harper Lee" }
]
```

The command validates that:
- The file contains valid JSON
- The parsed value is an array
- The array contains at least one record

## Configuration Priority

The same three-layer configuration priority applies as with `csvtransform`:

1. **Implicit** -- Auto-detected from the first record's keys
2. **Explicit** -- Loaded from a mapping file via `-m`
3. **User** -- Command-line options (`-e`, `-n`, `-g`, `-c`)

Each layer overrides the previous.

## Output Format

The output is a standard Comprehension JSON object:

```json
{
  "Book": {
    "Book_1": {
      "GUIDBook": "Book_1",
      "Title": "The Hunger Games",
      "Author": "Suzanne Collins"
    },
    "Book_2": {
      "GUIDBook": "Book_2",
      "Title": "Harry Potter",
      "Author": "J.K. Rowling"
    }
  }
}
```

## Examples

### Transform with a mapping file

```shell
mdwint jsonarraytransform ./data/books-array.json \
  -m mapping_Book.json \
  -o books-comprehension.json
```

### Transform with CLI options

```shell
mdwint jsonarraytransform ./data/books-array.json \
  -e Book \
  -n GUIDBook \
  -g "Book_{~D:Record.id~}" \
  -o books.json
```

### Implicit transform

```shell
mdwint jsonarraytransform ./data/books-array.json -o books.json
```

Entity name, GUID template, and mappings are all auto-detected from the filename and the keys of the first record in the array.

### Merge into an existing Comprehension

```shell
mdwint jsonarraytransform ./data/authors.json \
  -m mapping_Author.json \
  -i existing-store.json \
  -o existing-store.json
```

### Inline column mappings

```shell
mdwint jsonarraytransform ./data/books-array.json \
  -e Book \
  -g "Book_{~D:Record.id~}" \
  -c "Title={~D:Record.title~},Author={~D:Record.author~}" \
  -o books.json
```

### Extended output for debugging

```shell
mdwint jsonarraytransform ./data/books-array.json \
  -m mapping_Book.json \
  -x \
  -o debug-output.json
```

### Round-trip workflow: CSV to JSON array to Comprehension

```shell
# 1. Transform CSV to a Comprehension
mdwint csvtransform ./data/books.csv -e Book -o books-object.json

# 2. Convert to array format
mdwint comprehensionarray books-object.json -e Book -o books-array.json

# 3. Re-transform from JSON array with a different mapping
mdwint jsonarraytransform books-array.json -m new-mapping.json -o remapped.json
```

## Tips

- This command loads the entire JSON file into memory at once, unlike `csvtransform` which streams line by line. For very large datasets, consider converting to CSV first.
- The input file must be a JSON array at the top level (starting with `[`). If your data is nested inside an object, extract the array first.
- All features available in `csvtransform` work here, including Solvers, `MultipleGUIDUniqueness`, and mapping files.
- The default output filename uses a `JSON-Comprehension-` prefix rather than `CSV-Comprehension-`.

## Notes

- Unlike `csvtransform` and `tsvtransform`, this command does not have a `-q` (quotedelimiter) option since JSON parsing handles quoting natively.
- The command processes records synchronously (not streamed), so memory usage is proportional to file size.

## See Also

- [csvtransform](csvtransform.md) -- CSV equivalent
- [tsvtransform](tsvtransform.md) -- TSV equivalent
- [comprehensionarray](comprehensionarray.md) -- Convert Comprehension objects to arrays
- [Mapping Files](../mapping-files.md) -- Full mapping file specification
