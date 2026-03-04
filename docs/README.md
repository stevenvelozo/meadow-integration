# Meadow Integration

A suite of tools for managing data into a centralized non-specific schema format called a **Comprehension**.

These tools are built to be usable from the command-line, as a web service, or within your own codebase.  This module presents these behaviors both as a suite of externally usable fable services, a command-line utility to leverage them and a set of web service behaviors.

In addition to data transformation, Meadow Integration includes a **Data Clone** pipeline for replicating entity data from a remote Meadow REST API into a local MySQL or MSSQL database.

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

### 5. Clone data from a remote API

Create a `.meadow.config.json` in your working directory:

```json
{
  "Source": {
    "ServerURL": "https://api.example.com/1.0/",
    "UserID": "sync-user",
    "Password": "sync-password"
  },
  "Destination": {
    "Provider": "MySQL",
    "MySQL": {
      "server": "127.0.0.1",
      "port": 3306,
      "user": "root",
      "password": "",
      "database": "meadow_clone"
    }
  },
  "SchemaPath": "./schema/Model-Extended.json"
}
```

Then run the clone:

```shell
npx meadow-integration data-clone
```

For incremental updates after the initial clone:

```shell
npx meadow-integration data-clone -s Ongoing
```

## Architecture

```
External Data (CSV / TSV / JSON)         Remote Meadow REST API
        |                                         |
        v                                         v
   TabularTransform Service              CloneRestClient
   (column mapping via Pict templates)   (authenticated HTTP)
        |                                         |
        v                                         v
   Comprehension Object                  Sync Service
   (Entity records keyed by GUID)        (Initial or Ongoing mode)
        |                                         |
        v                                         v
   Integration Adapter                   ConnectionManager
   (marshal to Meadow schema)            (MySQL or MSSQL pool)
        |                                         |
        v                                         v
   GUID Map                              Local Database
   (track external <-> Meadow IDs)       (tables auto-created
        |                                 from Meadow schema)
        v
   Meadow REST API
   (batch upsert / single upsert)
```

The left side is the **Data Transformation** pipeline: external files are parsed, transformed into comprehensions, and pushed to a Meadow API. The right side is the **Data Synchronization** pipeline: entity data is pulled from a remote Meadow API and written to a local database.

Both pipelines share the Fable service provider pattern for dependency injection, logging, and configuration.

## Next Steps

- [Overview](overview.md) -- Full feature overview and when to use each tool
- [Quick Start Guide](quickstart.md) -- Step-by-step walkthrough of all workflows
- [Architecture](architecture.md) -- System design with mermaid diagrams
- [CLI Reference](cli-reference.md) -- All commands and their options
- [REST API Reference](rest-api-reference.md) -- All REST endpoints with curl examples
- [Mapping Files](mapping-files.md) -- How to write column mapping configurations
- [Comprehensions](comprehensions.md) -- The comprehension data format in detail
- [Programmatic API](programmatic-api.md) -- Using services directly in your code
- [Integration Adapter](integration-adapter.md) -- Pushing data to Meadow REST APIs
- [Data Clone Overview](data-clone/overview.md) -- Synchronizing remote APIs to local databases
- [Examples](examples-walkthrough.md) -- Walkthrough of all runnable examples
