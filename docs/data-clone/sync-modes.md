# Sync Modes

The data clone system supports two sync modes: **Initial** and **Ongoing**. Each mode uses a different strategy for determining which records to fetch and how to write them to the local database.

## Initial Sync

**Purpose**: Perform a full clone of data from the source API to the local database.

### Strategy

1. **Read local max ID**: Query the local database for the maximum value of the entity's `DefaultIdentifier` (primary key).
2. **Read local count**: Count the total records in the local database.
3. **Read server max ID**: Query the source API for the maximum ID via `GET /{Entity}/Max/{DefaultIdentifier}`.
4. **Read server count**: Query the source API for the total count via `GET /{Entity}s/Count`.
5. **Estimate work**: Calculate the estimated number of new records as `Server.RecordCount - Local.RecordCount`.
6. **Generate paginated URLs**: Build a list of URL partials using the filter `FBV~{ID}~GT~{LocalMaxID}~FSF~{ID}~ASC~ASC` with pagination offsets.
7. **Fetch and insert**: For each page of records:
   - Check if the record exists locally by its ID.
   - If the record does not exist, marshal and create it.
   - If the record already exists, skip it.

### Key Characteristics

| Aspect | Behavior |
|--------|----------|
| Record creation | Yes |
| Record updates | No |
| Pagination | All pages generated upfront based on server count |
| Filter | Records with ID greater than local max |
| Sort | Ascending by DefaultIdentifier |
| Concurrency | 1 page at a time, 5 records in parallel per page |
| Progress tracking | Tracks estimated vs completed record count |

### When to Use

- First-time data cloning from a source API.
- Rebuilding a local database from scratch.
- When you only need new records and do not need to detect changes to existing records.

### Create Behavior

When creating records during Initial sync, the following flags are set on the Meadow query:

- `setDisableAutoIdentity(true)` -- Preserves the original ID from the source.
- `setDisableAutoDateStamp(true)` -- Preserves original CreateDate/UpdateDate values.
- `setDisableAutoUserStamp(true)` -- Preserves original CreatingIDUser/UpdatingIDUser values.
- `setDisableDeleteTracking(true)` -- Preserves the original Deleted flag.
- `AllowIdentityInsert = true` -- Allows inserting records with explicit ID values.

---

## Ongoing Sync

**Purpose**: Incrementally sync new and changed records from the source API.

### Strategy

1. **Check for UpdateDate column**: Verify that the entity schema contains an `UpdateDate` column.
2. **Read local max ID**: Same as Initial.
3. **Read local max UpdateDate**: Query for the most recent `UpdateDate` in the local database.
4. **Read local count**: Same as Initial.
5. **Read server max ID**: Same as Initial.
6. **Read server max UpdateDate**: Query the source API via `GET /{Entity}/Max/UpdateDate`.
7. **Read server count**: Same as Initial.
8. **Estimate request count**: Calculate `Math.ceil(Server.RecordCount / PageSize)`.
9. **Recursive fetch**: Using a recursive `anticipate` pattern:
   - Fetch a page of records sorted by ID ascending, starting from `LastRequestedID`.
   - For each record:
     - If it does not exist locally, create it.
     - If it exists, compare `UpdateDate` values. If the difference exceeds 5 milliseconds, update the local record.
     - If the dates are within 5ms, skip the record.
   - After processing the page, recursively add the next page fetch to the anticipate chain.
   - Continue until all estimated pages have been processed.

### Key Characteristics

| Aspect | Behavior |
|--------|----------|
| Record creation | Yes |
| Record updates | Yes |
| Pagination | Recursive, one page at a time |
| Filter | Records with ID greater than `LastRequestedID` (starts at 0) |
| Sort | Ascending by DefaultIdentifier |
| UpdateDate threshold | 5 milliseconds (changes smaller than 5ms are ignored) |
| Concurrency | Sequential pages, sequential records within each page |
| Progress tracking | Tracks request count against estimated total |

### Recursive Anticipate Pattern

The Ongoing sync uses a recursive pattern where each page fetch, upon completion, adds another page fetch to the `anticipate` queue. This ensures that the `LastRequestedID` advances as records are processed:

```
Page 1 (IDs 1-100) -> process -> update LastRequestedID to 100
  -> add Page 2 (IDs > 100) to anticipate queue
    Page 2 (IDs 101-200) -> process -> update LastRequestedID to 200
      -> add Page 3 (IDs > 200) to anticipate queue
        ...
```

This approach handles cases where the server record count changes during the sync process.

### When to Use

- After an Initial sync has been completed.
- When running periodic sync jobs to keep the local database up to date.
- When you need to detect and apply changes to existing records.

### Create and Update Behavior

**Creating** new records uses the same flags as Initial sync (disabled auto-identity, auto-date, auto-user, and delete tracking with `AllowIdentityInsert`).

**Updating** existing records also uses the same disabled flags to preserve the original metadata from the source.

---

## Comparison Table

| Feature | Initial | Ongoing |
|---------|---------|---------|
| Creates new records | Yes | Yes |
| Updates existing records | No | Yes |
| Starting point | Local max ID | ID 0 (scans all records) |
| Pagination strategy | Pre-computed URL list | Recursive anticipate |
| UpdateDate comparison | No | Yes (5ms threshold) |
| Schema requirement | DefaultIdentifier | DefaultIdentifier, UpdateDate |
| Typical use | First-time clone | Incremental updates |
| Performance | Fast (skips existing) | Thorough (checks every record) |

## Setting the Sync Mode

### Via CLI

```bash
mdwint data-clone --sync_mode Initial
mdwint data-clone --sync_mode Ongoing
```

### Via Configuration

In `.meadow.config.json`:

```json
{
    "Sync": {
        "DefaultSyncMode": "Initial"
    }
}
```

### Programmatically

```javascript
fable.MeadowSync.SyncMode = 'Ongoing';
```

The sync mode must be set **before** calling `loadMeadowSchema()`, because the mode determines which `SyncEntity` class (Initial or Ongoing) is instantiated for each entity.

## Record Marshaling

Both sync modes use the same `marshalRecord` method to prepare source records for local database insertion:

- Columns defined in the entity schema are mapped from the source record.
- `null` and `undefined` values are skipped.
- Object values are JSON-stringified.
- `DateTime` values are reformatted to `YYYY-MM-DD HH:mm:ss.SSS` in UTC.
- Empty string values are skipped for non-DateTime fields.
- Columns ending in `JSON` are auto-populated from matching object properties (e.g., `ConfigJSON` is populated from `Config` if `Config` is an object).

## Table and Index Creation

Both sync modes automatically:

1. Create the database table if it does not exist (via Meadow provider's `createTable`).
2. Create a unique index on the GUID column (if present).
3. Create a non-unique index on the Deleted column (if present).

This happens during the `initialize()` phase before any records are synced.

## Progress Tracking

Both modes use the `MeadowOperation` utility class for progress tracking:

- **Initial**: Tracks `FullSync-{TableName}` with estimated record count.
- **Ongoing**: Tracks `UpdateSync-{TableName}` with estimated request count.

Progress includes: percent complete, average operation time, and estimated completion time.
