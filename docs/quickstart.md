# Quick Start

This guide walks through the core workflows of Meadow Integration, from analyzing a CSV file to cloning a remote Meadow API into a local database.

## Installation

Install the package from npm:

```shell
npm install meadow-integration
```

For CLI usage without a global install:

```shell
npx meadow-integration --help
```

If you install globally (or add it to your project), the `mdwint` shorthand is also available:

```shell
npm install -g meadow-integration
mdwint --help
```

## Your First CSV Analysis

Start by inspecting a CSV file to understand its structure. The `csvcheck` command produces statistics about rows, columns, and per-column data quality.

```shell
npx meadow-integration csvcheck ./data/books.csv -o book-stats.json
```

This writes a JSON file containing:

- Row and column counts
- Header names
- First and last rows as sample data
- Per-column statistics: total count, empty count, numeric count, first value, and last value

Use this to verify your data before transforming it.

## Your First CSV Transformation

Transform a CSV into a Comprehension -- the intermediate JSON format used across all Meadow Integration operations.

```shell
npx meadow-integration csvtransform ./data/books.csv \
  -e "Book" \
  -n "GUIDBook" \
  -g "Book_{~D:Record.id~}" \
  -o books-comprehension.json
```

This produces a JSON file where each record is keyed by its generated GUID:

```json
{
  "Book": {
    "Book_1": { "GUIDBook": "Book_1", "id": "1", "title": "The Hunger Games", ... },
    "Book_2": { "GUIDBook": "Book_2", "id": "2", "title": "Harry Potter", ... }
  }
}
```

**Flags explained:**

- `-e Book` -- The entity name in the comprehension
- `-n GUIDBook` -- The name of the GUID column on each record
- `-g "Book_{~D:Record.id~}"` -- A Pict template that generates each record's GUID from its `id` column
- `-o books-comprehension.json` -- Where to write the output

## Using Mapping Files

For production use, mapping files give you precise control over which columns map to which fields and how GUIDs are generated.

Create a file called `mapping_Book.json`:

```json
{
  "Entity": "Book",
  "GUIDTemplate": "Book_{~D:Record.id~}",
  "Mappings": {
    "Title": "{~D:Record.title~}",
    "Language": "{~D:Record.language_code~}",
    "ISBN": "{~D:Record.isbn~}",
    "AverageRating": "{~D:Record.average_rating~}"
  }
}
```

Then run the transform with the mapping file:

```shell
npx meadow-integration csvtransform ./data/books.csv \
  -m mapping_Book.json \
  -o books-comprehension.json
```

The mapping file acts as the "Explicit" configuration layer. Any CLI flags you pass (like `-e` or `-g`) override the mapping file as the "User" layer.

## Merging Comprehensions

When data comes from multiple files or sources, merge them with `comprehensionintersect`. Records with the same GUID are combined, with later values overwriting earlier ones.

First, create a second comprehension from a different source:

```shell
npx meadow-integration csvtransform ./data/book-ratings.csv \
  -m mapping_BookRatings.json \
  -o ratings-comprehension.json
```

Then merge them:

```shell
npx meadow-integration comprehensionintersect books-comprehension.json \
  -i ratings-comprehension.json \
  -e Book \
  -o merged-books.json
```

You can also merge during transformation by passing an existing comprehension with `-i`:

```shell
npx meadow-integration csvtransform ./data/authors.csv \
  -m mapping_Author.json \
  -i books-comprehension.json \
  -o full-comprehension.json
```

This adds `Author` records to the same comprehension that already contains `Book` records.

## Pushing to a Meadow API

Once your comprehension is ready, push it to a running Meadow REST API:

```shell
npx meadow-integration load_comprehension ./full-comprehension.json \
  -p "IMPORT-2024"
```

This creates an Integration Adapter for each entity type in the comprehension. For each record, the adapter:

1. Generates a Meadow-compatible GUID using the configured prefix
2. Resolves cross-entity ID references through the GUID Map
3. Upserts the record to the Meadow API (single or bulk, based on record count)

The `-p` flag sets the adapter set GUID marshal prefix, which namespaces the import.

## Setting Up Data Clone

Data Clone replicates a remote Meadow API into a local database. Configuration is stored in a `.meadow.config.json` file in your working directory.

Create `.meadow.config.json`:

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
      "password": "localpass",
      "database": "meadow_clone",
      "connectionLimit": 20
    }
  },
  "SchemaPath": "./schema/Model-Extended.json",
  "Sync": {
    "DefaultSyncMode": "Initial",
    "PageSize": 100,
    "SyncEntityList": [],
    "SyncEntityOptions": {}
  }
}
```

**Configuration sections:**

- **Source** -- The remote Meadow REST API to read from. `UserID` and `Password` are optional; if omitted, authentication is skipped.
- **Destination** -- The local database to write to. Supports `MySQL` and `MSSQL` providers.
- **SchemaPath** -- Path to the Meadow extended schema JSON (generated by Stricture). This defines which tables and columns to create locally.
- **Sync** -- Controls the sync behavior. Leave `SyncEntityList` empty to sync all entities in the schema, or list specific entity names to sync a subset.

## Running a Data Clone

With the configuration in place, run the clone:

```shell
npx meadow-integration data-clone
```

This will:

1. Authenticate with the source API (if credentials are configured)
2. Connect to the local database
3. Load the Meadow schema and create any missing tables
4. Add indexes on GUID and Deleted columns
5. Download and insert all records for each entity

For subsequent runs, switch to Ongoing mode to only sync changes:

```shell
npx meadow-integration data-clone -s Ongoing
```

You can also override configuration from the command line:

```shell
npx meadow-integration data-clone \
  --api_server https://api.example.com/1.0/ \
  --db_host 127.0.0.1 \
  --db_name meadow_clone \
  --schema_path ./schema/Model-Extended.json \
  --sync_mode Initial
```

## Next Steps

- [Overview](overview.md) -- Full feature overview and when to use each tool
- [Architecture](architecture.md) -- System design with diagrams
- [Mapping Files](mapping-files.md) -- Detailed mapping configuration reference
- [Comprehensions](comprehensions.md) -- The comprehension data format in depth
- [CLI Reference](cli-reference.md) -- All commands and their options
- [REST API Reference](rest-api-reference.md) -- All REST endpoints
- [Examples](examples-walkthrough.md) -- Walkthrough of all runnable examples
