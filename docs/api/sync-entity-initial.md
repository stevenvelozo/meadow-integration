# MeadowSyncEntityInitial

Performs a full initial synchronization of a single entity from a remote Meadow API server to a local database. Downloads all records that do not yet exist locally by comparing max IDs, then inserts missing records in paginated batches.

**Source:** `source/services/clone/Meadow-Service-Sync-Entity-Initial.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowSyncEntityInitial`

## Constructor

```js
const syncEntity = fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityInitial', pOptions, pServiceHash);
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `MeadowEntitySchema` | `object` | Yes | -- | Entity schema object containing `TableName`, `Columns` (array), and `MeadowSchema`. |
| `ConnectionPool` | `object` | No | -- | Database connection pool (used for table/index creation). |
| `PageSize` | `number` | No | `100` | Number of records per paginated download request. |

**Validation:** The constructor throws an `Error` if:
- `MeadowEntitySchema` is missing or not an object.
- `MeadowEntitySchema.TableName` is missing or empty.
- `MeadowEntitySchema.Columns` is missing or not a non-empty array.
- `MeadowEntitySchema.MeadowSchema` is missing.

## Properties

### `EntitySchema`

`object` -- Deep copy of the provided `MeadowEntitySchema` option.

### `DefaultIdentifier`

`string` -- The default identifier column name from `EntitySchema.MeadowSchema.DefaultIdentifier` (typically `'IDAnimal'`, `'IDCustomer'`, etc.).

### `PageSize`

`number` -- Records per download page.

### `Meadow`

The Meadow ORM instance for this entity, loaded from the entity's `MeadowSchema` package object. Set by `initialize()`.

### `operation`

`MeadowOperation` -- Instance of the operation utility for timestamps and progress tracking.

## Methods

### `initialize(fCallback)`

Prepares the entity for synchronization by creating the local database table (if it does not exist) and setting up indexes on GUID and Deleted columns.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError)` | Callback invoked when initialization is complete. |

**Behavior:**
1. Loads the Meadow ORM instance from the entity's schema package.
2. Calls the provider's `createTable()` to ensure the table exists.
3. If the schema has a GUID column (`DataType == 'GUID'`), creates a unique index on it.
4. If the schema has a `Deleted` column, creates a non-unique index on it.
5. Index creation requires `fable.MeadowConnectionManager` to be available.

### `marshalRecord(pSourceRecord)`

Transforms a server-side record into a local record suitable for insertion, based on the entity schema columns.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSourceRecord` | `object` | The record object from the server. |

**Returns:** `object` -- The marshaled record with only schema-defined columns.

**Transformation rules:**
- `null`/`undefined` values are skipped.
- Object values are JSON-stringified.
- `DateTime` columns are formatted to `'YYYY-MM-DD HH:mm:ss.SSS'` in UTC.
- Empty string values are skipped (except for DateTime).
- Columns ending in `JSON` auto-stringify the corresponding non-JSON property from the source (e.g., `MetadataJSON` from `Metadata`).

### `sync(fCallback)`

Executes the full initial sync algorithm for this entity.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function()` | Callback invoked when sync completes (errors are logged, not passed). |

**Algorithm:**

1. **Get local max ID** -- Reads the highest-ID record from the local database.
2. **Get local count** -- Counts all local records.
3. **Get server max ID** -- Requests max ID from `{Entity}/Max/{DefaultIdentifier}`.
4. **Get server count** -- Requests count from `{Entity}s/Count`.
5. **Calculate estimated records** -- `Server.RecordCount - Local.RecordCount`.
6. **Generate paginated URLs** -- Creates URL partials filtered to `{DefaultIdentifier} > {LocalMaxID}`, sorted ascending, paginated by `PageSize`.
7. **Download and insert** -- For each page, downloads records and for each record:
   - Checks if the record already exists locally by ID.
   - If not found, marshals the record and creates it with identity insert enabled and all auto-stamps disabled.
   - Updates the progress tracker after each insert.
8. **Early termination** -- If an empty page is returned, stops downloading.

**Progress tracking:** Uses `MeadowOperation` with tracker hash `FullSync-{TableName}`.

## Usage Examples

### Direct Instantiation and Sync

```js
const libFable = require('fable');
const libSyncEntityInitial = require('meadow-integration/source/services/clone/Meadow-Service-Sync-Entity-Initial');

const fable = new libFable({ Product: 'CloneApp' });

fable.serviceManager.addServiceType('MeadowSyncEntityInitial', libSyncEntityInitial);

const entitySchema = {
	TableName: 'Customer',
	Columns:
	[
		{ Column: 'IDCustomer', DataType: 'AutoIdentity' },
		{ Column: 'GUIDCustomer', DataType: 'GUID' },
		{ Column: 'Name', DataType: 'String' },
		{ Column: 'Email', DataType: 'String' },
		{ Column: 'CreateDate', DataType: 'DateTime' },
		{ Column: 'UpdateDate', DataType: 'DateTime' },
		{ Column: 'Deleted', DataType: 'Boolean' }
	],
	MeadowSchema:
	{
		DefaultIdentifier: 'IDCustomer',
		Schema: [
			{ Column: 'IDCustomer' },
			{ Column: 'GUIDCustomer' },
			{ Column: 'Name' },
			{ Column: 'Email' },
			{ Column: 'CreateDate' },
			{ Column: 'UpdateDate' },
			{ Column: 'Deleted' }
		]
	}
};

const syncEntity = fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityInitial',
	{
		MeadowEntitySchema: entitySchema,
		ConnectionPool: connectionPool,
		PageSize: 500
	},
	'SyncEntity-Customer');

syncEntity.initialize(
	(pError) =>
	{
		if (pError)
		{
			console.error('Initialization failed:', pError);
			return;
		}

		syncEntity.sync(
			() =>
			{
				console.log('Initial sync of Customer complete.');
			});
	});
```

### Marshaling a Record Manually

```js
const serverRecord = {
	IDCustomer: 42,
	GUIDCustomer: 'abc-123-def',
	Name: 'Alice',
	Email: 'alice@example.com',
	CreateDate: '2024-01-15T10:30:00.000Z',
	UpdateDate: '2024-06-20T14:00:00.000Z',
	Deleted: 0,
	Metadata: { tier: 'premium' }
};

const localRecord = syncEntity.marshalRecord(serverRecord);
// localRecord =>
// {
//   IDCustomer: 42,
//   GUIDCustomer: 'abc-123-def',
//   Name: 'Alice',
//   Email: 'alice@example.com',
//   CreateDate: '2024-01-15 10:30:00.000',
//   UpdateDate: '2024-06-20 14:00:00.000',
//   Deleted: 0
// }
```

## Sync Flow Diagram

```
Local DB                                Remote Server
--------                                -------------
1. Get max ID (local)
2. Get count (local)
                                        3. GET /Entity/Max/IDEntity
                                        4. GET /Entitys/Count
5. Calculate estimated new records
6. Generate paginated URL list
                                        7. GET /Entitys/FilteredTo/FBV~ID~GT~{localMax}~/0/{pageSize}
8. For each record:
   - Read by ID locally
   - If not found: marshal + create
                                        9. GET next page...
10. Repeat until pages exhausted
```

## Related Services

- [MeadowSync](./sync.md) -- The orchestrator that creates and manages instances of this class.
- [MeadowSyncEntityOngoing](./sync-entity-ongoing.md) -- The ongoing/differential variant of entity sync.
- [MeadowCloneRestClient](./clone-rest-client.md) -- Used via `fable.MeadowCloneRestClient` to download records.
- [MeadowOperation](./operation.md) -- Provides timestamp and progress tracking utilities used during sync.
- [MeadowConnectionManager](./connection-manager.md) -- Provides the connection pool and index creation.
