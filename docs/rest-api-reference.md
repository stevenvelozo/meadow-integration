# REST API Reference

The Meadow Integration Server exposes all CLI functionality as REST endpoints.  Start it with:

```shell
# Via CLI command
npx meadow-integration serve
npx meadow-integration serve -p 3000

# Or from the repository
npm start -- serve
npm start -- serve -p 3000
```

The server defaults to port `8086`.  The `MEADOW_INTEGRATION_PORT` environment variable is also respected.

All data endpoints accept `POST` with a JSON body (`Content-Type: application/json`).

The example `curl` commands below assume the server is running at `http://localhost:8086` and that file paths reference the example data shipped with this module (under `docs/examples/data/`).

---

## GET /1.0/Status

Server health check and endpoint listing.

```shell
curl http://localhost:8086/1.0/Status
```

**Response:**

```json
{
  "Product": "Meadow-Integration-Server",
  "Version": "1.0.2",
  "Status": "Running",
  "Endpoints": [
    "POST /1.0/CSV/Check",
    "POST /1.0/CSV/Transform",
    "POST /1.0/TSV/Check",
    "POST /1.0/TSV/Transform",
    "POST /1.0/JSONArray/Transform",
    "POST /1.0/JSONArray/TransformRecords",
    "POST /1.0/Comprehension/Intersect",
    "POST /1.0/Comprehension/IntersectFiles",
    "POST /1.0/Comprehension/ToArray",
    "POST /1.0/Comprehension/ToArrayFromFile",
    "POST /1.0/Comprehension/ToCSV",
    "POST /1.0/Comprehension/ToCSVFromFile",
    "POST /1.0/Comprehension/Push",
    "POST /1.0/Comprehension/PushFile",
    "POST /1.0/Entity/FromTabularFolder"
  ]
}
```

---

## CSV Operations

### POST /1.0/CSV/Check

Analyze a CSV file for column statistics.  Equivalent to CLI: `csvcheck <file>`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to the CSV file |
| `Records` | boolean | no | Include all parsed records in the output (default: `false`) |
| `QuoteDelimiter` | string | no | Quote character (default: `"`) |

**Example** *(corresponds to [Example 001](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/CSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv"
  }'
```

**Response:**

```json
{
  "DataSet": "/path/to/docs/examples/data/books.csv",
  "FirstRow": { "id": "1", "book_id": "2767052", "title": "The Hunger Games (The Hunger Games, #1)", "..." : "..." },
  "RowCount": 9999,
  "LastRow": { "..." : "..." },
  "Headers": ["id", "book_id", "best_book_id", "work_id", "books_count", "isbn", "isbn13", "authors", "original_publication_year", "original_title", "title", "language_code", "..."],
  "ColumnCount": 23,
  "ColumnStatistics": {
    "id": { "Count": 9999, "EmptyCount": 0, "NumericCount": 9999, "FirstValue": "1", "LastValue": "10000" },
    "title": { "Count": 9999, "EmptyCount": 0, "NumericCount": 0, "FirstValue": "The Hunger Games (The Hunger Games, #1)", "LastValue": "..." },
    "language_code": { "Count": 9999, "EmptyCount": 1084, "NumericCount": 0, "FirstValue": "eng", "LastValue": "eng" }
  },
  "Records": null
}
```

---

### POST /1.0/CSV/Transform

Transform a CSV file into a comprehension.  Equivalent to CLI: `csvtransform <file>`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to the CSV file |
| `Entity` | string | no | Entity name (auto-detected from filename if omitted) |
| `GUIDName` | string | no | GUID column name (default: `GUID{Entity}`) |
| `GUIDTemplate` | string | no | Pict template for GUID generation |
| `Mappings` | object | no | Column mappings: `{ "OutputCol": "{~D:Record.inputCol~}" }` |
| `MappingConfiguration` | object | no | Full mapping config (same format as a mapping JSON file) |
| `IncomingComprehension` | object | no | Existing comprehension to merge new records into |
| `Extended` | boolean | no | Return full operation state instead of just the comprehension |
| `QuoteDelimiter` | string | no | Quote character (default: `"`) |

**Example -- implicit transform** *(corresponds to [Example 002](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv"
  }'
```

Entity name, GUID template, and column mappings are auto-detected from the filename and first row.

**Example -- with entity and GUID options** *(corresponds to [Example 003](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv",
    "Entity": "Book",
    "GUIDName": "GUIDBook",
    "GUIDTemplate": "Book_{~D:Record.id~}"
  }'
```

**Example -- with a mapping configuration** *(corresponds to [Example 004](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv",
    "MappingConfiguration": {
      "Entity": "Book",
      "GUIDTemplate": "Book_{~D:Record.id~}",
      "Mappings": {
        "Title": "{~D:Record.title~}",
        "Language": "{~D:Record.language_code~}",
        "PublicationYear": "{~D:Fable.Math.roundPrecise(Record.original_publication_year,0)~}",
        "ISBN": "{~D:Record.isbn~}",
        "Genre": "Unknown",
        "Type": "Book",
        "ImageURL": "{~D:Record.image_url~}"
      }
    }
  }'
```

**Example -- multi-entity bookstore** *(corresponds to [Example 005](examples-walkthrough.md))*:

Step 1: Create Book records.

```shell
curl -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv",
    "MappingConfiguration": {
      "Entity": "Book",
      "GUIDTemplate": "Book_{~D:Record.id~}",
      "Mappings": {
        "Title": "{~D:Record.title~}",
        "Language": "{~D:Record.language_code~}",
        "ISBN": "{~D:Record.isbn~}"
      }
    }
  }'
```

Step 2: Take the response from step 1 and pass it as `IncomingComprehension` to add Author records from the same CSV.

```shell
curl -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/docs/examples/data/books.csv",
    "MappingConfiguration": {
      "Entity": "Author",
      "MultipleGUIDUniqueness": true,
      "Solvers": ["NewRecordsGUIDUniqueness = STRINGGETSEGMENTS(IncomingRecord.authors,\",\")"],
      "GUIDTemplate": "Author_{~PascalCaseIdentifier:Record._GUIDUniqueness~}",
      "Mappings": {
        "Name": "{~D:Record._GUIDUniqueness~}"
      }
    },
    "IncomingComprehension": { "Book": { "...step 1 results..." : {} } }
  }'
```

**Response** (single-entity example):

```json
{
  "Book": {
    "Book_1": {
      "GUIDBook": "Book_1",
      "Title": "The Hunger Games (The Hunger Games, #1)",
      "Language": "eng",
      "ISBN": "439023483"
    },
    "Book_2": {
      "GUIDBook": "Book_2",
      "Title": "Harry Potter and the Sorcerer's Stone (Harry Potter, #1)",
      "Language": "eng",
      "ISBN": "439554934"
    }
  }
}
```

---

## TSV Operations

### POST /1.0/TSV/Check

Analyze a TSV file for column statistics.  Equivalent to CLI: `tsvcheck <file>`.

**Request Body:**

Same fields as `/1.0/CSV/Check`.  The delimiter is automatically set to tab.

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/TSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/airports.tsv"
  }'
```

---

### POST /1.0/TSV/Transform

Transform a TSV file into a comprehension.  Equivalent to CLI: `tsvtransform <file>`.

**Request Body:**

Same fields as `/1.0/CSV/Transform`.  The delimiter is automatically set to tab.

**Example** *(matches the TSV airport mapping in the [Mapping Files](mapping-files.md) docs)*:

```shell
curl -X POST http://localhost:8086/1.0/TSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/airports.tsv",
    "MappingConfiguration": {
      "Entity": "Airport",
      "GUIDTemplate": "Airport-{~D:iata~}",
      "Mappings": {
        "Code": "{~D:iata~}",
        "Name": "{~D:name~}",
        "City": "{~D:city~}",
        "State": "{~D:state~}",
        "Country": "{~D:country~}",
        "Latitude": "{~D:lat~}",
        "Longitude": "{~D:long~}"
      }
    }
  }'
```

---

## JSON Array Operations

### POST /1.0/JSONArray/Transform

Transform a JSON array file into a comprehension.  Equivalent to CLI: `jsonarraytransform <file>`.

**Request Body:**

Same fields as `/1.0/CSV/Transform`.

**Example** *(corresponds to [Example 009](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/JSONArray/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/books-array.json",
    "MappingConfiguration": {
      "Entity": "Book",
      "GUIDTemplate": "Book_{~D:Record.id~}",
      "Mappings": {
        "Title": "{~D:Record.title~}",
        "Language": "{~D:Record.language_code~}",
        "ISBN": "{~D:Record.isbn~}"
      }
    }
  }'
```

---

### POST /1.0/JSONArray/TransformRecords

Transform an in-memory JSON array into a comprehension.  No file needed -- records are passed directly in the request body.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Records` | array | yes | Array of record objects |
| `Entity` | string | no | Entity name |
| `GUIDName` | string | no | GUID column name |
| `GUIDTemplate` | string | no | Pict template for GUID generation |
| `Mappings` | object | no | Column mappings |
| `MappingConfiguration` | object | no | Full mapping config |
| `IncomingComprehension` | object | no | Existing comprehension to merge into |
| `Extended` | boolean | no | Return full operation state |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/JSONArray/TransformRecords \
  -H "Content-Type: application/json" \
  -d '{
    "Records": [
      { "id": "1", "title": "The Hunger Games", "language_code": "eng", "isbn": "439023483" },
      { "id": "2", "title": "Harry Potter and the Sorcerers Stone", "language_code": "eng", "isbn": "439554934" },
      { "id": "3", "title": "Twilight", "language_code": "eng", "isbn": "316015849" }
    ],
    "Entity": "Book",
    "GUIDTemplate": "Book_{~D:Record.id~}",
    "Mappings": {
      "Title": "{~D:Record.title~}",
      "Language": "{~D:Record.language_code~}",
      "ISBN": "{~D:Record.isbn~}"
    }
  }'
```

**Response:**

```json
{
  "Book": {
    "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng", "ISBN": "439023483" },
    "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter and the Sorcerers Stone", "Language": "eng", "ISBN": "439554934" },
    "Book_3": { "GUIDBook": "Book_3", "Title": "Twilight", "Language": "eng", "ISBN": "316015849" }
  }
}
```

---

## Comprehension Operations

### POST /1.0/Comprehension/Intersect

Merge two comprehension objects.  Equivalent to CLI: `comprehensionintersect`.

Records from the secondary comprehension are merged into the primary.  Matching GUIDs are overwritten by the secondary values.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `PrimaryComprehension` | object | yes | The base comprehension |
| `SecondaryComprehension` | object | yes | Comprehension to merge in |
| `Entity` | string | no | Entity to merge (auto-detected if omitted) |

**Example** *(corresponds to [Example 006](examples-walkthrough.md) -- merging Seattle neighborhood data)*:

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/Intersect \
  -H "Content-Type: application/json" \
  -d '{
    "PrimaryComprehension": {
      "Neighborhood": {
        "Ballard": { "GUIDNeighborhood": "Ballard", "HousingUnits": "15234" },
        "Capitol Hill": { "GUIDNeighborhood": "Capitol Hill", "HousingUnits": "18721" }
      }
    },
    "SecondaryComprehension": {
      "Neighborhood": {
        "Ballard": { "GUIDNeighborhood": "Ballard", "MedianRent": "1850" },
        "Capitol Hill": { "GUIDNeighborhood": "Capitol Hill", "MedianRent": "1650" }
      }
    },
    "Entity": "Neighborhood"
  }'
```

**Response:**

```json
{
  "Neighborhood": {
    "Ballard": { "GUIDNeighborhood": "Ballard", "HousingUnits": "15234", "MedianRent": "1850" },
    "Capitol Hill": { "GUIDNeighborhood": "Capitol Hill", "HousingUnits": "18721", "MedianRent": "1650" }
  }
}
```

---

### POST /1.0/Comprehension/IntersectFiles

Merge two comprehension JSON files.  File-based version of the above.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to the primary comprehension file |
| `IntersectFile` | string | yes | Absolute path to the secondary comprehension file |
| `Entity` | string | no | Entity to merge |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/IntersectFiles \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/seattle-housing-chars.json",
    "IntersectFile": "/path/to/seattle-housing-costs.json",
    "Entity": "Neighborhood"
  }'
```

---

### POST /1.0/Comprehension/ToArray

Convert an object-keyed comprehension into a JSON array.  Equivalent to CLI: `comprehensionarray`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Comprehension` | object | yes | The comprehension object |
| `Entity` | string | no | Entity to extract (auto-detected if omitted) |

**Example** *(corresponds to [Example 007](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/ToArray \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
        "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
      }
    },
    "Entity": "Book"
  }'
```

**Response:**

```json
[
  { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
  { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
]
```

---

### POST /1.0/Comprehension/ToArrayFromFile

File-based version of the above.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to the comprehension file |
| `Entity` | string | no | Entity to extract |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/ToArrayFromFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/books-comprehension.json",
    "Entity": "Book"
  }'
```

---

### POST /1.0/Comprehension/ToCSV

Convert a comprehension or array of objects to CSV.  Equivalent to CLI: `objectarraytocsv`.

Returns `text/csv` content.  Nested objects are flattened using dot notation (e.g. `address.city`).

**Request Body (array form):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Records` | array | yes* | Array of record objects |

**Request Body (comprehension form):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Comprehension` | object | yes* | Comprehension object |
| `Entity` | string | no | Entity to extract (auto-detected for single-entity comprehensions) |

*Provide either `Records` or `Comprehension`.

**Example -- from array** *(corresponds to [Example 008](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/ToCSV \
  -H "Content-Type: application/json" \
  -d '{
    "Records": [
      { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng", "ISBN": "439023483" },
      { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng", "ISBN": "439554934" }
    ]
  }'
```

**Response** (`Content-Type: text/csv`):

```csv
GUIDBook,ISBN,Language,Title
Book_1,439023483,eng,The Hunger Games
Book_2,439554934,eng,Harry Potter
```

**Example -- from comprehension:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/ToCSV \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
        "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
      }
    },
    "Entity": "Book"
  }'
```

---

### POST /1.0/Comprehension/ToCSVFromFile

File-based version of the above.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to a JSON file (array or comprehension) |
| `Entity` | string | no | Entity to extract |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/ToCSVFromFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/books-array.json"
  }'
```

---

### POST /1.0/Comprehension/Push

Push a comprehension to Meadow REST APIs via the Integration Adapter.  Equivalent to CLI: `load_comprehension`.

Each entity in the comprehension gets its own adapter.  Records are marshaled to Meadow format and upserted to the target server.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Comprehension` | object | yes | The comprehension to push |
| `GUIDPrefix` | string | no | GUID marshal prefix (default: `INTG-DEF`) |
| `EntityGUIDPrefix` | string | no | Per-entity GUID prefix |
| `ServerURL` | string | no | Target Meadow API URL (default: `http://localhost:8086/1.0/`) |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/Push \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "Book_1": { "GUIDBook": "Book_1", "Title": "The Hunger Games", "Language": "eng" },
        "Book_2": { "GUIDBook": "Book_2", "Title": "Harry Potter", "Language": "eng" }
      }
    },
    "GUIDPrefix": "IMPORT-2024",
    "EntityGUIDPrefix": "BK",
    "ServerURL": "http://my-meadow-server:8080/1.0/"
  }'
```

**Response:**

```json
{
  "Success": true,
  "EntitiesPushed": ["Book"],
  "Message": "Pushed comprehension for 1 entity(ies)."
}
```

---

### POST /1.0/Comprehension/PushFile

File-based version of the above.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `File` | string | yes | Absolute path to the comprehension file |
| `GUIDPrefix` | string | no | GUID marshal prefix |
| `EntityGUIDPrefix` | string | no | Per-entity GUID prefix |
| `ServerURL` | string | no | Target Meadow API URL |

**Example:**

```shell
curl -X POST http://localhost:8086/1.0/Comprehension/PushFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/path/to/bookstore-comprehension.json",
    "GUIDPrefix": "IMPORT-2024",
    "ServerURL": "http://my-meadow-server:8080/1.0/"
  }'
```

---

## Entity Generation

### POST /1.0/Entity/FromTabularFolder

Generate comprehensions from all tabular files (CSV, TSV, JSON) in a folder.  Equivalent to CLI: `entitycomprehensionsfromtabularfolders`.

Each file produces its own entity (inferred from filename) unless `Entity` is specified to force all files into one.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Folder` | string | yes | Absolute path to the folder |
| `Entity` | string | no | Force all files to this entity name |
| `MappingConfiguration` | object | no | Mapping hints applied to all files |

**Example** *(corresponds to the Seattle neighborhoods scenario in [Example 006](examples-walkthrough.md))*:

```shell
curl -X POST http://localhost:8086/1.0/Entity/FromTabularFolder \
  -H "Content-Type: application/json" \
  -d '{
    "Folder": "/path/to/docs/examples/data/seattle_neighborhoods/",
    "Entity": "Neighborhood",
    "MappingConfiguration": {
      "GUIDTemplate": "{~D:Record.Neighborhood Name~}",
      "Mappings": {
        "Name": "{~D:Record.Neighborhood Name~}"
      }
    }
  }'
```

**Response:**

```json
{
  "Neighborhood": {
    "Ballard": { "GUIDNeighborhood": "Ballard", "Name": "Ballard", "..." : "..." },
    "Fremont": { "GUIDNeighborhood": "Fremont", "Name": "Fremont", "..." : "..." }
  }
}
```

---

## CLI-to-REST Equivalence

Every CLI command has a corresponding REST endpoint.  The table below maps between the two:

| CLI Command | REST Endpoint | Notes |
|-------------|---------------|-------|
| `csvcheck <file>` | `POST /1.0/CSV/Check` | `File` in body |
| `csvtransform <file>` | `POST /1.0/CSV/Transform` | `-m` becomes `MappingConfiguration`, `-i` becomes `IncomingComprehension` |
| `tsvcheck <file>` | `POST /1.0/TSV/Check` | `File` in body |
| `tsvtransform <file>` | `POST /1.0/TSV/Transform` | Same mapping as csvtransform |
| `jsonarraytransform <file>` | `POST /1.0/JSONArray/Transform` | Or use `/TransformRecords` for in-memory |
| `comprehensionintersect <file> -i <file2>` | `POST /1.0/Comprehension/Intersect` | Or `/IntersectFiles` for file paths |
| `comprehensionarray <file>` | `POST /1.0/Comprehension/ToArray` | Or `/ToArrayFromFile` for file paths |
| `objectarraytocsv <file>` | `POST /1.0/Comprehension/ToCSV` | Or `/ToCSVFromFile` for file paths |
| `load_comprehension <file>` | `POST /1.0/Comprehension/Push` | Or `/PushFile` for file paths |
| `entc_ftf <folder>` | `POST /1.0/Entity/FromTabularFolder` | `Folder` in body |
| *(new)* | `POST /1.0/JSONArray/TransformRecords` | In-memory only, no CLI equivalent |

For file-based CLI commands, the REST API offers both an in-memory variant (pass data directly in the request body) and a file variant (pass a `File` path).  The in-memory variants are useful when chaining operations in a pipeline without writing intermediate files to disk.
