# Examples Walkthrough

The `examples/` folder contains runnable scripts that demonstrate meadow-integration features.  Each script is self-contained and writes output to `examples/output/`.

## Data Sources

The examples use data from `docs/examples/data/`:

- **books.csv** -- 10,000 book records (id, title, author, isbn, ratings, etc.)
- **seattle_neighborhoods/** -- Three Seattle census datasets sharing a Neighborhood Name column

## Example 001: CSV Check

Analyzes a CSV file to understand its structure before transforming it.

```shell
./examples/Example-001-CSV-Check.sh
```

**What it does:** Runs `csvcheck` on books.csv and produces a statistics file showing row/column counts, headers, and per-column analysis (empty counts, numeric counts, first/last values).

**When to use:** As the first step with any new data source to understand what you are working with.

## Example 002: CSV Transform (Implicit)

Transforms a CSV with auto-detected settings.

```shell
./examples/Example-002-CSV-Transform-Implicit.sh
```

**What it does:** Runs `csvtransform` with no mapping file or options.  The entity name is derived from the filename, the GUID is generated from the first column, and all columns are mapped 1:1.

**When to use:** Quick exploration of what a comprehension looks like before writing a mapping file.

## Example 003: CSV Transform (CLI Options)

Controls the entity name and GUID template via command-line flags.

```shell
./examples/Example-003-CSV-Transform-CLI-Options.sh
```

**What it does:** Uses `-e Book`, `-n GUIDBook`, and `-g "Book_{~D:Record.id~}"` to explicitly define the entity and GUID structure.

**When to use:** One-off transforms where you want specific entity naming but do not need column filtering.

## Example 004: CSV Transform (Mapping File)

Uses a JSON mapping file for precise column control.

```shell
./examples/Example-004-CSV-Transform-Mapping-File.sh
```

**What it does:** Reads `mapping_books_Book.json` which maps only 7 fields from the 23-column CSV.  Demonstrates computed fields (`PublicationYear` using `Math.roundPrecise`) and static values (`Genre: "Unknown"`).

**When to use:** Production data integration where you want to control exactly which fields are included and how they are named.

## Example 005: Multi-Entity Bookstore

Builds a complete relational data set from a single CSV.

```shell
./examples/Example-005-Multi-Entity-Bookstore.sh
```

**What it does:** Runs three `csvtransform` passes on books.csv with different mapping files to create:
1. **Book** entities (one per book)
2. **Author** entities (unique authors, split from comma-separated values using Solvers)
3. **BookAuthorJoin** entities (many-to-many relationships)

Each pass uses `-i` to merge into the same comprehension file.

**When to use:** When a single data source needs to be decomposed into multiple related entity types.

## Example 006: Multi-CSV Intersect

Merges three CSV files that share a common key.

```shell
./examples/Example-006-Multi-CSV-Intersect.sh
```

**What it does:** Transforms three Seattle neighborhood CSVs into separate comprehensions keyed on Neighborhood Name, then uses `comprehensionintersect` to merge them into one unified dataset.

**When to use:** When the same entities have data spread across multiple source files (e.g. different database tables or API responses).

## Example 007: Comprehension to Array

Converts from object-keyed format to a JSON array.

```shell
./examples/Example-007-Comprehension-To-Array.sh
```

**What it does:** Creates a Book comprehension, then converts it from `{ "Book_1": {...} }` format to `[ {...}, {...} ]` format.

**When to use:** When downstream consumers need an array (UI tables, further processing, export).

## Example 008: Comprehension to CSV

Full round-trip from CSV through comprehension back to CSV.

```shell
./examples/Example-008-Comprehension-To-CSV.sh
```

**What it does:** CSV -> Comprehension -> Array -> CSV export.

**When to use:** Reviewing transformed data in a spreadsheet, or creating filtered/cleaned CSVs.

## Example 009: JSON Array Transform

Transforms a JSON array file into a comprehension.

```shell
./examples/Example-009-JSON-Array-Transform.sh
```

**What it does:** Creates a JSON array from CSV data, then uses `jsonarraytransform` with a mapping file to create a new comprehension.

**When to use:** When your source data comes as JSON (e.g. API responses) instead of CSV.

## Example 010: Programmatic API

Uses meadow-integration services directly in Node.js code.

```shell
node examples/Example-010-Programmatic-API.js
```

**What it does:** Demonstrates three services without the CLI:
1. **TabularCheck** -- collecting statistics on parsed CSV records
2. **TabularTransform** -- building a comprehension with explicit configuration
3. **GUIDMap** -- tracking bidirectional GUID-to-ID mappings

**When to use:** When you are building data integration into a larger application and need programmatic control.
