# MeadowSync

Top-level synchronization orchestrator for the data-clone pipeline. Loads a Meadow schema, creates per-entity sync objects (Initial or Ongoing), and coordinates syncing all entities in sequence.

**Source:** `source/services/clone/Meadow-Service-Sync.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowSync`

## Constructor

```js
const sync = fable.serviceManager.instantiateServiceProvider('MeadowSync', pOptions);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `SyncEntityList` | `Array<string>` | `[]` | Ordered list of entity table names to sync. If empty, all entities in the schema are synced. Also read from `fable.ProgramConfiguration.SyncEntityList`. |
| `SyncEntityOptions` | `object` | `{}` | Per-entity sync options keyed by table name. Also read from `fable.ProgramConfiguration.SyncEntityOptions`. |
| `ConnectionPool` | `object` | *(none)* | Database connection pool passed through to per-entity sync objects. |
| `PageSize` | `number` | `100` | Number of records per download page, passed through to per-entity sync objects. |

## Properties

### `SyncMode`

`string` -- Controls which sync strategy is used when `loadMeadowSchema()` creates entity sync objects.

| Value | Behavior |
|-------|----------|
| `'Initial'` *(default)* | Creates `MeadowSyncEntityInitial` instances. Performs a full ID-based sync of all missing records. |
| `'Ongoing'` | Creates `MeadowSyncEntityOngoing` instances. Performs UpdateDate-based differential sync, creating or updating records. |

Set this property **before** calling `loadMeadowSchema()`.

### `SyncEntityList`

`Array<string>` -- The list of entity table names to synchronize, in order. Populated from options, `ProgramConfiguration`, or automatically from the loaded schema.

### `SyncEntityOptions`

`object` -- Per-entity options map. Keys are table names.

### `MeadowSyncEntities`

`object` -- Map of table name to instantiated `MeadowSyncEntityInitial` or `MeadowSyncEntityOngoing` service instances. Populated by `loadMeadowSchema()`.

### `MeadowSchemaTableList`

`Array<string>` -- List of all table names found in the loaded Meadow schema. Set by `loadMeadowSchema()`.

## Methods

### `loadMeadowSchema(pSchema, fCallback)`

Loads a compiled Meadow schema and creates per-entity sync objects.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSchema` | `object` | A compiled Meadow schema with a `Tables` property. Each key is a table name; each value is an entity schema object with `TableName`, `Columns`, and `MeadowSchema`. |
| `fCallback` | `function(pError)` | Callback invoked after all entity sync objects are initialized (tables created, indexes set up). |

**Behavior:**
1. Iterates through every table in the schema.
2. For tables that are in `SyncEntityList` (or all tables if the list is empty), creates a sync entity object according to `SyncMode`.
3. Calls `initialize()` on each entity sync object to ensure the local table and indexes exist.
4. If `SyncEntityList` was empty, populates it with all initialized entity names.

### `syncEntity(pEntityHash, fCallback)`

Syncs a single entity by its table name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntityHash` | `string` | The table name of the entity to sync (e.g. `'Animal'`). |
| `fCallback` | `function(pError)` | Callback invoked when the entity sync completes. |

Logs a warning and returns immediately if the entity does not exist in `MeadowSyncEntities`.

### `syncAll(fCallback)`

Syncs all entities in `SyncEntityList` sequentially.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError)` | Callback invoked when all entities have been synced. |

Iterates through `SyncEntityList` with a concurrency of 1, calling `syncEntity()` for each.

## Usage Examples

### Full Initial Sync Workflow

```js
const libFable = require('fable');
const libConnectionManager = require('meadow-integration/source/services/clone/Meadow-Service-ConnectionManager');
const libRestClient = require('meadow-integration/source/services/clone/Meadow-Service-RestClient');
const libSync = require('meadow-integration/source/services/clone/Meadow-Service-Sync');

const fable = new libFable({ Product: 'DataClone' });

// Register services
fable.serviceManager.addServiceType('MeadowConnectionManager', libConnectionManager);
fable.serviceManager.addServiceType('MeadowCloneRestClient', libRestClient);
fable.serviceManager.addServiceType('MeadowSync', libSync);

// Instantiate connection manager
const connectionManager = fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager',
	{
		Provider: 'MySQL',
		MySQL: { server: '127.0.0.1', user: 'root', password: '', database: 'clone_db' }
	});

// Instantiate REST client
const restClient = fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
	{
		ServerURL: 'https://api.example.com/1.0/',
		UserID: 'sync_user',
		Password: 'sync_password'
	});

// Connect, authenticate, then sync
connectionManager.connect(
	(pConnError) =>
	{
		if (pConnError) { throw pConnError; }

		restClient.authenticate(
			(pAuthError) =>
			{
				if (pAuthError) { throw pAuthError; }

				const sync = fable.serviceManager.instantiateServiceProvider('MeadowSync',
					{
						ConnectionPool: connectionManager.ConnectionPool,
						PageSize: 200,
						SyncEntityList: ['Customer', 'Order', 'Product']
					});

				// Use initial sync mode (the default)
				sync.SyncMode = 'Initial';

				const meadowSchema = require('./my-compiled-schema.json');
				sync.loadMeadowSchema(meadowSchema,
					(pLoadError) =>
					{
						if (pLoadError) { throw pLoadError; }

						sync.syncAll(
							(pSyncError) =>
							{
								if (pSyncError)
								{
									console.error('Sync failed:', pSyncError);
								}
								else
								{
									console.log('Initial sync complete!');
								}

								restClient.deauthenticate(() => { process.exit(0); });
							});
					});
			});
	});
```

### Ongoing (Differential) Sync

```js
const sync = fable.serviceManager.instantiateServiceProvider('MeadowSync',
	{
		ConnectionPool: connectionManager.ConnectionPool,
		PageSize: 100
	});

// Switch to ongoing mode before loading schema
sync.SyncMode = 'Ongoing';

sync.loadMeadowSchema(meadowSchema,
	(pLoadError) =>
	{
		sync.syncAll(
			(pSyncError) =>
			{
				console.log('Ongoing sync complete!');
			});
	});
```

### Syncing a Single Entity

```js
sync.loadMeadowSchema(meadowSchema,
	(pLoadError) =>
	{
		sync.syncEntity('Customer',
			(pSyncError) =>
			{
				console.log('Customer sync complete!');
			});
	});
```

## Related Services

- [MeadowConnectionManager](./connection-manager.md) -- Provides the database connection pool.
- [MeadowCloneRestClient](./clone-rest-client.md) -- REST client used by entity sync objects to download records.
- [MeadowSyncEntityInitial](./sync-entity-initial.md) -- Created by MeadowSync when `SyncMode` is `'Initial'`.
- [MeadowSyncEntityOngoing](./sync-entity-ongoing.md) -- Created by MeadowSync when `SyncMode` is `'Ongoing'`.
