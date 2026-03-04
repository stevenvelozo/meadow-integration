# csvcheck

Analyze a CSV file and produce column-level statistics. This is typically the first step when working with a new data set, helping you understand the structure, column names, and data characteristics before writing mapping files.

**Aliases:** `csv_c`, `csv_check`

## Usage

```shell
mdwint csvcheck <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the CSV file to analyze |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <filepath>` | Alternate way to specify the CSV file path | -- |
| `-o, --output <filepath>` | Output file path for the statistics JSON | `./CSV-Stats-<filename>.json` |
| `-r, --records` | Include all parsed records in the output statistics object | `false` |
| `-q, --quotedelimiter <char>` | The quote delimiter character for CSV parsing | `"` |

## Output Format

The command writes a JSON file containing the following structure:

```json
{
  "RowCount": 100,
  "ColumnCount": 8,
  "Headers": ["id", "name", "email", "age", "city", "state", "zip", "joined"],
  "FirstRow": { "id": "1", "name": "Alice Smith", "..." : "..." },
  "LastRow": { "id": "100", "name": "Bob Jones", "..." : "..." },
  "ColumnStatistics": {
    "id": { "Count": 100, "EmptyCount": 0, "NumericCount": 100, "FirstValue": "1", "LastValue": "100" },
    "name": { "Count": 100, "EmptyCount": 2, "NumericCount": 0, "FirstValue": "Alice Smith", "LastValue": "Bob Jones" }
  }
}
```

| Field | Description |
|-------|-------------|
| `RowCount` | Total number of data rows (excluding header) |
| `ColumnCount` | Number of columns detected |
| `Headers` | Array of column header names |
| `FirstRow` | The first data record as a key-value object |
| `LastRow` | The last data record as a key-value object |
| `ColumnStatistics` | Per-column statistics including count, empty count, numeric count, first value, and last value |

When the `-r` flag is used, an additional `Records` property is included containing every parsed row.

## Console Output

In addition to writing the statistics file, the command prints a summary to the console:

```
Parsing CSV file [./data/books.csv]...
...CSV parser completed, examined 100 rows of data.
...Found 8 columns in the CSV file.
...Writing statistics to file [./CSV-Stats-books.csv.json]...
...Statistics written.
Summary: 100 rows, 8 columns in [./data/books.csv].
  Headers: id, name, email, age, city, state, zip, joined
  First Row: {"id":"1","name":"Alice Smith",...}
  Last Row: {"id":"100","name":"Bob Jones",...}
  Column Statistics:
    -> [id]: {"Count":100,"EmptyCount":0,"NumericCount":100,...}
    -> [name]: {"Count":100,"EmptyCount":2,"NumericCount":0,...}
```

## Examples

### Basic CSV analysis

```shell
mdwint csvcheck ./data/books.csv
```

Writes statistics to `./CSV-Stats-books.csv.json`.

### Specify an output file

```shell
mdwint csvcheck ./data/books.csv -o ./output/book-stats.json
```

### Include all records in the output

```shell
mdwint csvcheck ./data/users.csv -r -o ./output/user-stats-full.json
```

This is useful for debugging or when you want to inspect the fully parsed data alongside the statistics.

### Using the alias

```shell
mdwint csv_check ./data/products.csv -o product-stats.json
```

## Tips

- Run `csvcheck` before writing a mapping file. The `Headers` array in the output tells you the exact column names to reference in your `{~D:Record.<column>~}` templates.
- The `ColumnStatistics` can help identify which columns contain numeric data, which have empty values, and which might be good candidates for GUID generation.
- Use the `-r` flag sparingly on large files, as it embeds every record in the output JSON.
- If your CSV uses a non-standard quote character, pass it with `-q`. For example, `-q "'"` for single-quoted fields.
