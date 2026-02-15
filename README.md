# Meadow Integration

A suite of tools for managing data into a centralized non-specific schema format called a **Comprehension**.

These tools are built to be usable from the command-line, as a web service, or within your own codebase.  This module presents these behaviors both as a suite of externally usable fable services, a command-line utility to leverage them and a set of web service behaviors.

## What is a Comprehension?

A Comprehension is a JSON object that stores entity records keyed by their GUID.  It acts as an intermediate format for integrating records from external systems (CSV, TSV, JSON) into Meadow entities.

```json
{
  "Book": {
    "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
    "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
  }
}
```

## Quick Start

```shell
npm install
```

### Analyze a CSV

```shell
npm start -- csvcheck ./docs/examples/data/books.csv -o stats.json
```

### Transform a CSV into a Comprehension

```shell
npm start -- csvtransform ./docs/examples/data/books.csv \
  -e "Book" -n "GUIDBook" -g "Book_{~D:Record.id~}" \
  -o books.json
```

### Use a Mapping File

```shell
npm start -- csvtransform ./docs/examples/data/books.csv \
  -m ./docs/examples/bookstore/mapping_books_Book.json \
  -o books.json
```

### Merge Multiple Data Sources

```shell
npm start -- comprehensionintersect Set1.json -i Set2.json -e "MyEntity" -o merged.json
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `csvcheck` | Analyze a CSV file for statistics |
| `csvtransform` | Transform a CSV into a comprehension |
| `tsvtransform` | Transform a TSV into a comprehension |
| `jsonarraytransform` | Transform a JSON array into a comprehension |
| `comprehensionintersect` | Merge two comprehension files |
| `comprehensionarray` | Convert object comprehension to array |
| `objectarraytocsv` | Export a JSON array to CSV |
| `load_comprehension` | Push a comprehension to Meadow REST APIs |

## Examples

The `examples/` folder contains 10 runnable scripts demonstrating all major features:

```shell
cd examples

# Analyze CSV structure
./Example-001-CSV-Check.sh

# Transform with auto-detection
./Example-002-CSV-Transform-Implicit.sh

# Transform with CLI options
./Example-003-CSV-Transform-CLI-Options.sh

# Transform with mapping file
./Example-004-CSV-Transform-Mapping-File.sh

# Multi-entity bookstore (Book, Author, BookAuthorJoin)
./Example-005-Multi-Entity-Bookstore.sh

# Merge three Seattle neighborhood CSVs
./Example-006-Multi-CSV-Intersect.sh

# Convert comprehension to array
./Example-007-Comprehension-To-Array.sh

# Export comprehension to CSV
./Example-008-Comprehension-To-CSV.sh

# Transform from JSON array
./Example-009-JSON-Array-Transform.sh

# Programmatic API usage
node Example-010-Programmatic-API.js
```

## Mapping Files

Mapping files define how source columns become comprehension fields:

```json
{
  "Entity": "Book",
  "GUIDTemplate": "Book_{~D:Record.id~}",
  "Mappings": {
    "Title": "{~D:Record.title~}",
    "Language": "{~D:Record.language_code~}",
    "ISBN": "{~D:Record.isbn~}",
    "Genre": "Unknown"
  }
}
```

For multi-record generation (e.g. splitting comma-separated authors), use Solvers:

```json
{
  "Entity": "Author",
  "MultipleGUIDUniqueness": true,
  "Solvers": ["NewRecordsGUIDUniqueness = STRINGGETSEGMENTS(IncomingRecord.authors,\",\")"],
  "GUIDTemplate": "Author_{~PascalCaseIdentifier:Record._GUIDUniqueness~}",
  "Mappings": {
    "Name": "{~D:Record._GUIDUniqueness~}"
  }
}
```

## Architecture

```
External Data (CSV / TSV / JSON)
        |
        v
   TabularTransform Service  -- column mapping via Pict templates
        |
        v
   Comprehension Object      -- entity records keyed by GUID
        |
        v
   Integration Adapter       -- marshal to Meadow schema
        |
        v
   GUID Map                  -- track external <-> Meadow IDs
        |
        v
   Meadow REST API           -- batch upsert / single upsert
```

## Documentation

Full documentation is available at `docs/index.html` (powered by pict-docuserve):

- [CLI Reference](docs/cli-reference.md)
- [Mapping Files](docs/mapping-files.md)
- [Comprehensions](docs/comprehensions.md)
- [Programmatic API](docs/programmatic-api.md)
- [Integration Adapter](docs/integration-adapter.md)
- [Examples Walkthrough](docs/examples-walkthrough.md)
- [Vocabulary](docs/vocabulary/)

## Testing

```shell
npm test
```

## License

MIT
