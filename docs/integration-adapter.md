# Integration Adapter

The Integration Adapter is the bridge between comprehension data and a running Meadow REST API.  It handles record marshaling, GUID generation, schema validation, batch operations, and retry logic.

## Overview

```
Source Records (from comprehension or external system)
        |
        v
    addSourceRecord()
        |
        v
    marshalRecord()  -- map external GUIDs to Meadow GUIDs
                     -- validate against Meadow schema
                     -- truncate strings to schema limits
                     -- strip reserved fields (CreateDate, etc.)
        |
        v
    pushRecordsToServer()  -- single or bulk upsert
                           -- automatic retry on failure
        |
        v
    GUIDMap updated  -- Meadow IDs stored for cross-entity lookups
```

## GUID Marshaling

External system GUIDs are transformed into deterministic Meadow GUIDs using this pattern:

```
{AdapterSetGUIDMarshalPrefix}-{EntityGUIDMarshalPrefix}-{ExternalGUID}
```

For example, with default settings and entity "Book":

```
External GUID: "12345"
Meadow GUID:   "INTG-DEF-E-Book-12345"
```

This ensures GUIDs are unique across integration sets and entities.

### Cross-Entity GUID Resolution

When a source record contains GUID fields for other entities (e.g. `GUIDAuthor` on a BookAuthorJoin record), the adapter looks up the corresponding Meadow ID via the GUIDMap:

```javascript
// Source record: { GUIDBookAuthorJoin: "BAJ_1", GUIDBook: "Book_1", GUIDAuthor: "Author_5" }
// Adapter marshals:
//   - GUIDBookAuthorJoin -> "INTG-DEF-E-BookAuthorJoin-BAJ_1"
//   - GUIDBook -> looks up Meadow ID for external GUID "Book_1" -> IDBook: 42
//   - GUIDAuthor -> looks up Meadow ID for external GUID "Author_5" -> IDAuthor: 17
```

This is why entity integration order matters -- entities that are referenced by other entities should be integrated first so their IDs are available in the GUIDMap.

## Batch Processing

The adapter automatically switches between single and bulk upsert modes:

- **Below threshold** (`< RecordThresholdForBulkUpsert`, default 1000): Records are upserted one at a time
- **Above threshold**: Records are batched into groups of `BulkUpsertBatchSize` (default 100) and sent as bulk upserts

## Retry Logic

Failed upsert operations are retried up to `RecordPushRetryThreshold` times (default 5), with a hard cap of 50 retries.  The adapter validates server responses to confirm:

1. The response contains the entity ID field
2. The ID is a positive number
3. The response GUID matches the sent GUID

If validation fails, the record is retried.

## Schema Validation

When `integrateRecords()` is called, the adapter fetches the entity schema from the Meadow API (`GET /Entity/Schema`).  During marshaling:

- String fields are truncated to their schema-defined `size`
- Non-string fields are passed through
- Unknown fields (not in schema) are dropped
- Reserved fields (`CreateDate`, `UpdateDate`, `Deleted`, `DeleteDate`) are always stripped

## Delete Operations

Records with `Deleted: true` in the source are queued for deletion.  The adapter looks up each record by GUID via the API, then issues a DELETE request using the Meadow ID.

## CLI Usage

The `load_comprehension` command wraps the Integration Adapter for CLI use:

```shell
npx meadow-integration load_comprehension ./my-comprehension.json \
  -p "MY-PREFIX" \
  -e "MY-ENTITY-PREFIX"
```

This automatically creates adapters for every entity in the comprehension and processes them in sequence.

## Static Helper

The `getAdapter()` static method provides a convenient way to get or create an adapter:

```javascript
const libAdapter = require('meadow-integration/source/Meadow-Service-Integration-Adapter.js');

// Gets existing adapter for 'Book' or creates a new one
let tmpAdapter = libAdapter.getAdapter(myFable, 'Book', 'BK');
```
