# comprehensionarray

Convert an object-keyed Comprehension into a JSON array. Comprehensions store records as `{ GUID: record }` objects for fast lookup and merging, but sometimes you need a plain array for export, UI consumption, or further processing.

**Aliases:** `comprehension_to_array`, `array`

## Usage

```shell
mdwint comprehensionarray <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the Comprehension file to convert |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --entity <name>` | Entity name to extract from the Comprehension | Auto-detected from the first key |
| `-o, --output <path>` | Output file path | `./Array-Comprehension-<filename>.json` |

## Input Format

The input is a standard object-keyed Comprehension:

```json
{
  "Book": {
    "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
    "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
  }
}
```

## Output Format

The output is a JSON array of the record objects:

```json
[
  { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
  { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
]
```

The GUID keys are discarded; only the record values are included in the array.

## Examples

### Basic conversion with explicit entity

```shell
mdwint comprehensionarray ./books.json -e Book -o books-array.json
```

### Auto-detect entity name

```shell
mdwint comprehensionarray ./books.json -o books-array.json
```

If `-e` is omitted, the entity name is inferred from the first key in the Comprehension. If the Comprehension has only one entity, this works automatically.

### Using the alias

```shell
mdwint array ./books.json -e Book -o books-array.json
```

### Pipeline: Comprehension to CSV export

This command is commonly used as an intermediate step when exporting to CSV:

```shell
# Step 1: Convert object Comprehension to array
mdwint comprehensionarray ./store.json -e Book -o books-array.json

# Step 2: Export array to CSV
mdwint objectarraytocsv ./books-array.json -o books.csv
```

### Extract one entity from a multi-entity Comprehension

```shell
# Extract just the Author records from a multi-entity file
mdwint comprehensionarray ./bookstore.json -e Author -o authors-array.json

# Extract just the BookAuthorJoin records
mdwint comprehensionarray ./bookstore.json -e BookAuthorJoin -o joins-array.json
```

## Tips

- When working with multi-entity Comprehensions, always specify the `-e` flag to select which entity to extract. Without it, only the first entity key is used.
- This command is non-destructive to the input file. The original Comprehension is not modified.
- The output array preserves the order in which object keys were enumerated, which is generally insertion order in modern JavaScript engines.

## Notes

- If the specified entity does not exist in the Comprehension, the output will be an empty array.
- If no entities are found in the Comprehension file, the command will error.

## See Also

- [objectarraytocsv](objectarraytocsv.md) -- Convert a JSON array to CSV format
- [csvtransform](csvtransform.md) -- Create Comprehensions from CSV files
- [Comprehensions](../comprehensions.md) -- Object vs. array format documentation
