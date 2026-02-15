# Mapping Files

Mapping files give you precise control over how source data columns become comprehension fields.  They are JSON files that define the entity name, GUID generation template, and field-by-field mappings using Pict templates.

## Basic Structure

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

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `Entity` | Yes | The entity name.  Determines the top-level key in the comprehension. |
| `GUIDTemplate` | Yes | Pict template that generates a unique GUID for each record. |
| `GUIDName` | No | Name of the GUID column (default: `GUID{Entity}`). |
| `Mappings` | Yes | Object mapping output field names to Pict template expressions. |
| `Solvers` | No | Array of fable expression strings to run before mapping. |
| `MultipleGUIDUniqueness` | No | When `true`, a single source row produces multiple output records. |
| `ManyfestAddresses` | No | When `true`, use Manyfest dot-notation for nested field assignment. |

## Pict Template Syntax

Templates use the `{~D:...~}` syntax to reference values from the current source record.  Each record is available as `Record.<column>`.

| Template | Description |
|----------|-------------|
| `{~D:Record.title~}` | Direct column reference |
| `{~D:Record.first~} {~D:Record.last~}` | String concatenation |
| `"Unknown"` | Static/literal value |
| `{~D:Fable.Math.roundPrecise(Record.year,0)~}` | Function call on the value |
| `{~PascalCaseIdentifier:Record.name~}` | Template with format modifier |

The full Pict template engine is available, including format modifiers and function calls through the Fable service container.

## Example: Simple Column Mapping

Given a CSV with columns `id, name, email, age`:

```json
{
  "Entity": "User",
  "GUIDTemplate": "User_{~D:Record.id~}",
  "Mappings": {
    "DisplayName": "{~D:Record.name~}",
    "EmailAddress": "{~D:Record.email~}",
    "Age": "{~D:Record.age~}"
  }
}
```

This produces records like:

```json
{
  "GUIDUser": "User_42",
  "DisplayName": "Alice Smith",
  "EmailAddress": "alice@example.com",
  "Age": "30"
}
```

## Example: Computed GUID from Multiple Columns

```json
{
  "Entity": "Transaction",
  "GUIDTemplate": "TXN_{~D:Record.date~}_{~D:Record.account_id~}_{~D:Record.seq~}",
  "Mappings": {
    "Amount": "{~D:Record.amount~}",
    "AccountID": "{~D:Record.account_id~}",
    "TransactionDate": "{~D:Record.date~}"
  }
}
```

Composite GUIDs are useful when the source data has no single unique key.

## Example: Multi-Record Generation with Solvers

When a single source row needs to produce multiple comprehension records, use `MultipleGUIDUniqueness` with a Solver expression that splits a value.

Given a books CSV where the `authors` column contains comma-separated names:

```json
{
  "Entity": "Author",
  "MultipleGUIDUniqueness": true,
  "Solvers": [
    "NewRecordsGUIDUniqueness = STRINGGETSEGMENTS(IncomingRecord.authors,\",\")"
  ],
  "GUIDTemplate": "Author_{~PascalCaseIdentifier:Record._GUIDUniqueness~}",
  "Mappings": {
    "Name": "{~D:Record._GUIDUniqueness~}"
  }
}
```

The Solver splits the comma-separated author names into an array stored in `NewRecordsGUIDUniqueness`.  For each entry, a record is created with `_GUIDUniqueness` set to that entry's value.

## Example: Join Table Mapping

To create many-to-many join records between Books and Authors:

```json
{
  "Entity": "BookAuthorJoin",
  "MultipleGUIDUniqueness": true,
  "Solvers": [
    "NewRecordsGUIDUniqueness = STRINGGETSEGMENTS(IncomingRecord.authors,\",\")"
  ],
  "GUIDTemplate": "BAJ_A_{~PascalCaseIdentifier:Record._GUIDUniqueness~}_B_{~D:Record.id~}",
  "Mappings": {
    "GUIDBook": "Book_{~D:Record.id~}",
    "GUIDAuthor": "Author_{~PascalCaseIdentifier:Record._GUIDUniqueness~}"
  }
}
```

This generates one join record per book-author pair, with cross-reference GUIDs that match the Book and Author entities.

## Configuration Priority

When running a transform, three layers of configuration are merged:

1. **Implicit** -- Auto-detected from the first record's columns (entity name from filename, 1:1 column mappings)
2. **Explicit** -- Loaded from a mapping file via `-m`
3. **User** -- Command-line options (`-e`, `-n`, `-g`, `-c`)

Each layer overrides the previous, so CLI options always win.
