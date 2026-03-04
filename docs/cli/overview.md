# CLI Overview

The `meadow-integration` CLI provides commands for transforming, analyzing, merging, and loading tabular data into the Meadow ecosystem. It is available as the `mdwint` binary when installed globally, or can be run directly with `npx`.

## Installation

```shell
# Global install
npm install -g meadow-integration

# Or run directly with npx
npx meadow-integration [command] [options]

# Or from within the repository
npm start -- [command] [options]
```

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| [csvcheck](csvcheck.md) | `csv_c`, `csv_check` | Analyze a CSV file and produce column-level statistics |
| [csvtransform](csvtransform.md) | `csv_t`, `csv_transform` | Transform a CSV file into a Comprehension JSON file |
| [tsvtransform](tsvtransform.md) | `tsv_t`, `tsv_transform` | Transform a TSV file into a Comprehension JSON file |
| [jsonarraytransform](jsonarraytransform.md) | `jsonarray_t`, `jsonarray_transform` | Transform a JSON array file into a Comprehension |
| [comprehensionintersect](comprehensionintersect.md) | `intersect` | Merge two Comprehension JSON files together |
| [comprehensionarray](comprehensionarray.md) | `comprehension_to_array`, `array` | Convert an object-keyed Comprehension into a JSON array |
| [objectarraytocsv](objectarraytocsv.md) | `object_array_to_csv`, `array_to_csv` | Convert a JSON array or Comprehension to CSV format |
| [load_comprehension](load-comprehension.md) | `load`, `push` | Push a Comprehension to Meadow REST APIs |
| [data-clone](data-clone.md) | `clone`, `sync` | Clone data from a Meadow API source to a local database |
| [serve](serve.md) | `server`, `rest` | Start the Meadow Integration REST API server |

## Typical Workflows

### Analyze and Transform CSV Data

```shell
# 1. Inspect the CSV structure
mdwint csvcheck data.csv -o stats.json

# 2. Transform to a Comprehension
mdwint csvtransform data.csv -m mapping.json -o comprehension.json
```

### Build a Multi-Entity Comprehension

```shell
# 1. Create the first entity
mdwint csvtransform data.csv -m mapping_Book.json -o store.json

# 2. Add another entity to the same file
mdwint csvtransform data.csv -m mapping_Author.json -i store.json -o store.json

# 3. Add join records
mdwint csvtransform data.csv -m mapping_Join.json -i store.json -o store.json
```

### Merge Data from Multiple Sources

```shell
# 1. Transform each source file
mdwint csvtransform source_a.csv -e Item -o set_a.json
mdwint csvtransform source_b.csv -e Item -o set_b.json

# 2. Merge by matching GUIDs
mdwint comprehensionintersect set_a.json -i set_b.json -e Item -o merged.json
```

### Export Comprehension to CSV

```shell
# 1. Convert from object to array format
mdwint comprehensionarray comprehension.json -e MyEntity -o array.json

# 2. Export array to CSV
mdwint objectarraytocsv array.json -o export.csv
```

### Push Data to a Meadow Server

```shell
mdwint load_comprehension comprehension.json -p "Import-2024"
```

### Clone API Data to a Local Database

```shell
mdwint data-clone -a https://api.example.com -d MySQL -dh localhost -dn mydb
```

## Related Documentation

- [Comprehensions](../comprehensions.md) -- Core data structure concepts
- [Mapping Files](../mapping-files.md) -- Detailed mapping file reference
- [REST API Reference](../rest-api-reference.md) -- Server endpoint documentation
- [Integration Adapter](../integration-adapter.md) -- Programmatic push/pull operations
