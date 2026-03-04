# objectarraytocsv

Convert a JSON array of objects or an entity Comprehension into a CSV file. Nested objects are automatically flattened using dot notation. This command is useful for exporting data to spreadsheets, sharing with tools that expect CSV input, or round-tripping data through the integration pipeline.

**Aliases:** `object_array_to_csv`, `array_to_csv`

## Usage

```shell
mdwint objectarraytocsv <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the JSON file containing the data to export |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --entity <name>` | Entity key to extract from a Comprehension object. Omit if the file is a plain JSON array. | `false` (expects array) |
| `-o, --output <path>` | Output CSV file path | `./Flattened-Object-<filename>.csv` or `./Flattened-Object-<filename>-Entity-<entity>.csv` |

## Input Formats

The command accepts several input formats:

### Plain JSON Array

A top-level array of objects (no `-e` flag needed):

```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" }
]
```

### Comprehension with Entity Flag

An object-keyed Comprehension, where you specify which entity to extract with `-e`:

```json
{
  "User": {
    "User_1": { "GUIDUser": "User_1", "Name": "Alice" },
    "User_2": { "GUIDUser": "User_2", "Name": "Bob" }
  }
}
```

### Single-Entity Comprehension (Auto-Detected)

If the input file is an object with a single key whose value is an object (not an array), the entity is auto-detected:

```json
{
  "Book": {
    "Book_1": { "Title": "The Hunger Games" },
    "Book_2": { "Title": "Harry Potter" }
  }
}
```

## Output Format

The output is a standard CSV file with:

- A header row containing all unique field names across all records, sorted alphabetically
- One data row per record
- Nested objects flattened with dot notation (e.g., `address.city`, `address.zip`)
- Values containing commas, double quotes, or newlines are properly escaped

Example output:

```csv
GUIDBook,ISBN,Language,Title
Book_1,0439023483,eng,The Hunger Games
Book_2,0439554934,eng,Harry Potter
```

## Examples

### Export a plain JSON array to CSV

```shell
mdwint objectarraytocsv ./data/books-array.json -o books.csv
```

### Export from a Comprehension with entity flag

```shell
mdwint objectarraytocsv ./store.json -e Book -o books.csv
```

### Auto-detect single entity

```shell
mdwint objectarraytocsv ./single-entity-comprehension.json -o export.csv
```

### Using the alias

```shell
mdwint array_to_csv ./data.json -o export.csv
```

### Full pipeline: CSV to Comprehension and back to CSV

```shell
# 1. Transform CSV to Comprehension
mdwint csvtransform ./raw-books.csv -m mapping_Book.json -o books.json

# 2. Convert Comprehension to array
mdwint comprehensionarray ./books.json -e Book -o books-array.json

# 3. Export array to CSV
mdwint objectarraytocsv ./books-array.json -o books-export.csv
```

### Export with nested objects

Given input:

```json
[
  { "name": "Alice", "address": { "city": "Seattle", "state": "WA" } },
  { "name": "Bob", "address": { "city": "Portland", "state": "OR" } }
]
```

The output CSV will have flattened column headers:

```csv
address.city,address.state,name
Seattle,WA,Alice
Portland,OR,Bob
```

## Tips

- If your Comprehension has multiple entity keys and you do not specify `-e`, the command will error and list the available entity keys. Always use `-e` for multi-entity Comprehensions.
- Column headers in the CSV are sorted alphabetically. This means the column order may differ from the original data or Comprehension.
- For Comprehensions in object format (not array format), use `comprehensionarray` first to convert to an array, then pipe to this command. Alternatively, pass the Comprehension directly with `-e` to extract the entity.
- The command handles `null` and `undefined` values by outputting empty strings in the CSV.

## Notes

- Arrays within records are serialized as their string representation in the CSV output.
- The output file uses streaming writes, making it efficient for large datasets.
- If no records are found in the input, the command will error.

## See Also

- [comprehensionarray](comprehensionarray.md) -- Convert object Comprehension to array format
- [csvtransform](csvtransform.md) -- Transform CSV files into Comprehensions
- [Comprehensions](../comprehensions.md) -- Data structure documentation
