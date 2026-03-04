# MeadowSyncEntityOngoing

Performs ongoing (differential) synchronization of a single entity from a remote Meadow API server to a local database. Uses UpdateDate-based comparison to detect changed records, creating new records or updating existing ones as needed.

**Source:** `source/services/clone/Meadow-Service-Sync-Entity-Ongoing.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowSyncEntityOngoing`

## Constructor

```js
const syncEntity = fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityOngoing', pOptions, pServiceHash);
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `MeadowEntitySchema` | `object` | Yes | -- | Entity schema object containing `TableName`, `Columns` (array), and `MeadowSchema`. |
| `ConnectionPool` | `object` | No | -- | Database connection pool (used for table/index creation). |
| `PageSize` | `number` | No | `100` | Number of records per paginated download request. |

**Validation:** Same as `MeadowSyncEntityInitial` -- throws errors for missing or invalid schema properties.

## Properties

### `EntitySchema`

`object` -- Deep copy of the provided `MeadowEntitySchema` option.

### `DefaultIdentifier`

`string` -- The default identifier column name from `EntitySchema.MeadowSchema.DefaultIdentifier`.

### `PageSize`

`number` -- Records per download page.

### `Meadow`

The Meadow ORM instance for this entity. Set by `initialize()`.

### `operation`

`MeadowOperation` -- Instance of the operation utility for timestamps and progress tracking.

## Methods

### `initialize(fCallback)`

Prepares the entity for synchronization. Identical behavior to `MeadowSyncEntityInitial.initialize()`: creates the local table if needed and sets up GUID (unique) and Deleted (non-unique) indexes.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError)` | Callback invoked when initialization is complete. |

### `marshalRecord(pSourceRecord)`

Transforms a server-side record into a local record suitable for insertion or update.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSourceRecord` | `object` | The record object from the server. |

**Returns:** `object` -- The marshaled record.

**Differences from Initial sync marshaling:**
- Does **not** perform UTC DateTime formatting. Values are copied as-is (unlike Initial sync which formats DateTime columns to `'YYYY-MM-DD HH:mm:ss.SSS'`).
- Otherwise follows the same column-mapping logic: skips null/undefined, stringifies objects, handles `*JSON` columns.

### `addSyncAnticipateEntry(tmpSyncState, tmpAnticipate)`

Adds a recursive anticipate entry for paginated sync. This is an internal method that implements the core download-and-sync loop for ongoing sync.

| Parameter | Type | Description |
|-----------|------|-------------|
| `tmpSyncState` | `object` | Mutable sync state tracking `LastRequestedID`, `RequestsPerformed`, `EstimatedRequestCount`. |
| `tmpAnticipate` | `object` | Fable Anticipate instance for managing asynchronous operations. |

**Recursive pagination pattern:**
1. Downloads a page of records filtered to `ID > LastRequestedID`, sorted ascending.
2. For each record in the page, adds an anticipate entry that:
   - Updates `LastRequestedID` to track progress.
   - Reads the local record by ID.
   - If found: compares `UpdateDate` between server and local. Skips if difference is less than 5ms.
   - If the record exists and dates differ: marshals and updates via `Meadow.doUpdate()`.
   - If the record does not exist: marshals and creates via `Meadow.doCreate()` with identity insert enabled.
3. After processing the page, if `RequestsPerformed < EstimatedRequestCount`, recursively calls `addSyncAnticipateEntry` to fetch the next page.

### `sync(fCallback)`

Executes the full ongoing sync algorithm for this entity.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function()` | Callback invoked when sync completes (errors are logged, not passed). |

**Algorithm:**

1. **Detect UpdateDate column** -- Checks if the entity schema has an `UpdateDate` column.
2. **Get local max ID** -- Reads the highest-ID record from the local database.
3. **Get local max UpdateDate** -- Reads the record with the most recent `UpdateDate`.
4. **Get local count** -- Counts all local records.
5. **Get server max ID** -- Requests from `{Entity}/Max/{DefaultIdentifier}`.
6. **Get server max UpdateDate** -- Requests from `{Entity}/Max/UpdateDate`.
7. **Get server count** -- Requests from `{Entity}s/Count`.
8. **Calculate estimated requests** -- `ceil(Server.RecordCount / PageSize)`.
9. **Begin recursive sync** -- Calls `addSyncAnticipateEntry()` to start the paginated download-and-sync loop. All records on the server are scanned (not just those newer than the local max).

**Progress tracking:** Uses `MeadowOperation` with tracker hash `UpdateSync-{TableName}`.

## Differences from Initial Sync

| Aspect | Initial | Ongoing |
|--------|---------|---------|
| **Strategy** | ID-based gap fill | Full scan with UpdateDate comparison |
| **Filter** | Only records with `ID > LocalMaxID` | All records, paginated by ascending ID |
| **Existing records** | Skips (already present) | Compares `UpdateDate`, updates if changed |
| **DateTime marshaling** | Formats to `YYYY-MM-DD HH:mm:ss.SSS` UTC | Copies values as-is |
| **Pagination** | Pre-computed URL list | Recursive anticipate pattern |
| **UpdateDate threshold** | N/A | Skips updates if difference < 5ms |
| **Progress tracker hash** | `FullSync-{TableName}` | `UpdateSync-{TableName}` |

## Usage Examples

### Direct Instantiation and Ongoing Sync

```js
const libFable = require('fable');
const libSyncEntityOngoing = require('meadow-integration/source/services/clone/Meadow-Service-Sync-Entity-Ongoing');

const fable = new libFable({ Product: 'CloneApp' });

fable.serviceManager.addServiceType('MeadowSyncEntityOngoing', libSyncEntityOngoing);

const entitySchema = {
	TableName: 'Order',
	Columns:
	[
		{ Column: 'IDOrder', DataType: 'AutoIdentity' },
		{ Column: 'GUIDOrder', DataType: 'GUID' },
		{ Column: 'CustomerID', DataType: 'Integer' },
		{ Column: 'Total', DataType: 'Decimal' },
		{ Column: 'CreateDate', DataType: 'DateTime' },
		{ Column: 'UpdateDate', DataType: 'DateTime' },
		{ Column: 'Deleted', DataType: 'Boolean' }
	],
	MeadowSchema:
	{
		DefaultIdentifier: 'IDOrder',
		Schema:
		[
			{ Column: 'IDOrder' },
			{ Column: 'GUIDOrder' },
			{ Column: 'CustomerID' },
			{ Column: 'Total' },
			{ Column: 'CreateDate' },
			{ Column: 'UpdateDate' },
			{ Column: 'Deleted' }
		]
	}
};

const syncEntity = fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityOngoing',
	{
		MeadowEntitySchema: entitySchema,
		ConnectionPool: connectionPool,
		PageSize: 250
	},
	'SyncEntity-Order');

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
				console.log('Ongoing sync of Order complete.');
			});
	});
```

### Using via MeadowSync Orchestrator

```js
const sync = fable.serviceManager.instantiateServiceProvider('MeadowSync',
	{
		ConnectionPool: connectionPool,
		PageSize: 200,
		SyncEntityList: ['Customer', 'Order', 'Product']
	});

// Set ongoing mode before loading schema
sync.SyncMode = 'Ongoing';

sync.loadMeadowSchema(compiledSchema,
	(pLoadError) =>
	{
		sync.syncAll(
			(pSyncError) =>
			{
				console.log('Ongoing sync of all entities complete.');
			});
	});
```

## Sync Flow Diagram

```
Local DB                                Remote Server
--------                                -------------
1. Check for UpdateDate column
2. Get max ID (local)
3. Get max UpdateDate (local)
4. Get count (local)
                                        5. GET /Entity/Max/IDEntity
                                        6. GET /Entity/Max/UpdateDate
                                        7. GET /Entitys/Count
8. Calculate estimated request count
                                        9. GET page (ID > LastRequestedID, ascending)
10. For each record:
    - Read by ID locally
    - If found & UpdateDate diff >= 5ms: marshal + update
    - If not found: marshal + create
    - Update LastRequestedID
                                        11. Recursively fetch next page...
12. Repeat until all pages processed
```

## Related Services

- [MeadowSync](./sync.md) -- The orchestrator that creates and manages instances of this class.
- [MeadowSyncEntityInitial](./sync-entity-initial.md) -- The initial full-sync variant.
- [MeadowCloneRestClient](./clone-rest-client.md) -- Used via `fable.MeadowCloneRestClient` to download records.
- [MeadowOperation](./operation.md) -- Provides timestamp and progress tracking utilities.
- [MeadowConnectionManager](./connection-manager.md) -- Provides the connection pool and index creation.
