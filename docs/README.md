# Meadow Integration

A suite of tools for managing data into a centralized non-specific schema format called a **Comprehension**.

These tools are built to be usable from the command-line, as a web service, or within your own codebase.  This module presents these behaviors both as a suite of externally usable fable services, a command-line utility to leverage them and a set of web service behaviors.

## What is a Comprehension?

A **Comprehension** is a JSON object that stores entity records keyed by their GUID.  It acts as an intermediate data format for integrating records from external systems (CSV, TSV, JSON) into Meadow entities.

```json
{
  "Book": {
    "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
    "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
  },
  "Author": {
    "Author_SuzanneCollins": { "GUIDAuthor": "Author_SuzanneCollins", "Name": "Suzanne Collins" }
  }
}
```

A single comprehension can hold multiple entity types, making it easy to model related data from the same source.

## Installation

```shell
npm install meadow-integration
```

Or for CLI usage:

```shell
npx meadow-integration --help
```

## Quick Start

### 1. Analyze a CSV file

```shell
npx meadow-integration csvcheck ./my-data.csv -o stats.json
```

This produces a JSON file with row/column counts, headers, and per-column statistics.

### 2. Transform a CSV into a Comprehension

```shell
npx meadow-integration csvtransform ./my-data.csv \
  -e "MyEntity" \
  -n "GUIDMyEntity" \
  -g "MyEntity_{~D:Record.id~}" \
  -o my-comprehension.json
```

### 3. Use a Mapping File for precise control

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

```shell
npx meadow-integration csvtransform ./books.csv -m mapping.json -o books.json
```

### 4. Merge multiple comprehensions

```shell
npx meadow-integration comprehensionintersect Set1.json -i Set2.json -e "MyEntity" -o merged.json
```

## Architecture

```
External Data (CSV / TSV / JSON)
        |
        v
   TabularTransform Service
   (column mapping via Pict templates)
        |
        v
   Comprehension Object
   (Entity records keyed by GUID)
        |
        v
   Integration Adapter
   (marshal to Meadow schema)
        |
        v
   GUID Map
   (track external <-> Meadow IDs)
        |
        v
   Meadow REST API
   (batch upsert / single upsert)
```

## Next Steps

- [CLI Reference](cli-reference.md) -- All commands and their options
- [REST API Reference](rest-api-reference.md) -- All REST endpoints with curl examples
- [Mapping Files](mapping-files.md) -- How to write column mapping configurations
- [Comprehensions](comprehensions.md) -- The comprehension data format in detail
- [Programmatic API](programmatic-api.md) -- Using services directly in your code
- [Integration Adapter](integration-adapter.md) -- Pushing data to Meadow REST APIs
- [Examples](examples-walkthrough.md) -- Walkthrough of all runnable examples
