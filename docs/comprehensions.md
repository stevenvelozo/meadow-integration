# Comprehensions

A Comprehension is the core data structure in meadow-integration.  It is a JSON object that stores entity records keyed by their GUID, providing fast lookup and easy merging across data sources.

## Object Format

The standard comprehension format stores records as properties of an entity object:

```json
{
  "EntityName": {
    "GUID-1": { "GUIDEntityName": "GUID-1", "Field1": "value", "Field2": "value" },
    "GUID-2": { "GUIDEntityName": "GUID-2", "Field1": "value", "Field2": "value" }
  }
}
```

### Benefits of Object Format

- **O(1) lookup** by GUID -- no scanning required
- **Natural deduplication** -- duplicate GUIDs merge automatically
- **Easy merging** -- `Object.assign()` combines records from multiple sources
- **Multi-entity support** -- one file can hold Books, Authors, and Joins

## Array Format

For export or consumption by other tools, comprehensions can be converted to arrays:

```json
[
  { "GUIDEntityName": "GUID-1", "Field1": "value", "Field2": "value" },
  { "GUIDEntityName": "GUID-2", "Field1": "value", "Field2": "value" }
]
```

Convert between formats using:

```shell
# Object -> Array
npx meadow-integration comprehensionarray input.json -e MyEntity -o output.json

# Array -> CSV
npx meadow-integration objectarraytocsv input.json -o output.csv
```

## Multi-Entity Comprehensions

A single comprehension file can contain records for multiple entity types.  This is created by running `csvtransform` multiple times with different mapping files, passing the `-i` flag to merge into the existing comprehension:

```shell
# Create Book entities
npx meadow-integration csvtransform books.csv -m mapping_Book.json -o store.json

# Add Author entities to the same file
npx meadow-integration csvtransform books.csv -m mapping_Author.json -i store.json -o store.json

# Add BookAuthorJoin entities
npx meadow-integration csvtransform books.csv -m mapping_Join.json -i store.json -o store.json
```

Result:

```json
{
  "Book": { "Book_1": {...}, "Book_2": {...} },
  "Author": { "Author_SuzanneCollins": {...}, "Author_JKRowling": {...} },
  "BookAuthorJoin": { "BAJ_A_SuzanneCollins_B_1": {...} }
}
```

## Merging Comprehensions

The `comprehensionintersect` command merges two comprehension files.  Records with matching GUIDs have their fields merged (later values overwrite earlier ones):

```shell
npx meadow-integration comprehensionintersect file1.json -i file2.json -e MyEntity -o merged.json
```

This is particularly useful when the same entities have data spread across multiple source files (e.g. housing characteristics and housing costs for the same neighborhoods).

## GUID Design

GUIDs are the primary key for comprehension records.  Good GUID design ensures:

- **Uniqueness** -- Each record gets a distinct key
- **Determinism** -- The same source data always generates the same GUID
- **Mergeability** -- Related data from different sources can be matched

### GUID Template Patterns

| Pattern | Use Case |
|---------|----------|
| `Entity_{~D:Record.id~}` | Single-column natural key |
| `{~D:Record.date~}_{~D:Record.seq~}` | Composite key |
| `{~PascalCaseIdentifier:Record.name~}` | Name-based key (normalized) |
| `{~D:Record.shared_key~}` | Cross-file merge key |

When the same GUID template is used across multiple csvtransform runs on different source files, the records are automatically merged in the comprehension.
