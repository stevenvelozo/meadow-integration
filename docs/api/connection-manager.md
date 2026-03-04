# MeadowConnectionManager

Database connection manager supporting MySQL and MSSQL providers for the meadow data-clone services.

**Source:** `source/services/clone/Meadow-Service-ConnectionManager.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowConnectionManager`

## Constructor

```js
const connectionManager = fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', pOptions);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `Provider` | `string` | `'MySQL'` | Database provider to use. Supported values: `'MySQL'`, `'MSSQL'`. |
| `MySQL` | `object` | *(see below)* | MySQL-specific connection configuration. |
| `MySQL.server` | `string` | `'127.0.0.1'` | MySQL server hostname. |
| `MySQL.port` | `number` | `3306` | MySQL server port. |
| `MySQL.user` | `string` | `'root'` | MySQL authentication user. |
| `MySQL.password` | `string` | `''` | MySQL authentication password. |
| `MySQL.database` | `string` | `'meadow'` | MySQL database name. |
| `MySQL.connectionLimit` | `number` | `20` | Maximum number of connections in the MySQL pool. |
| `MSSQL` | `object` | *(see below)* | MSSQL-specific connection configuration. |
| `MSSQL.server` | `string` | `'127.0.0.1'` | MSSQL server hostname. |
| `MSSQL.port` | `number` | `1433` | MSSQL server port. |
| `MSSQL.user` | `string` | `'sa'` | MSSQL authentication user. |
| `MSSQL.password` | `string` | `''` | MSSQL authentication password. |
| `MSSQL.database` | `string` | `'meadow'` | MSSQL database name. |
| `MSSQL.ConnectionPoolLimit` | `number` | `20` | Maximum number of connections in the MSSQL pool. |

## Properties

### `connected`

*Getter* -- Returns `boolean`.

Indicates whether the connection manager has successfully established a connection to the database.

### `ConnectionPool`

The underlying database connection pool object. Set to `false` before `connect()` is called. After a successful connection, holds the provider-specific pool instance.

### `Provider`

The active database provider string (`'MySQL'` or `'MSSQL'`).

## Methods

### `connect(fCallback)`

Establishes a connection to the database using the configured provider.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError, pConnectionPool)` | Callback invoked when the connection attempt completes. On success, `pConnectionPool` is the active pool. |

**Behavior:**
- For `MySQL`: Requires the `meadow-connection-mysql` package. Registers and instantiates a `MeadowMySQLProvider` service, then calls `connectAsync`. Also applies `connectionLimit` to `fable.settings`.
- For `MSSQL`: Requires the `meadow-connection-mssql` package. Registers and instantiates a `MeadowMSSQLProvider` service, then calls `connectAsync`.
- For unsupported providers: Calls back with an `Error`.

### `createIndex(pEntitySchema, pColumn, pIsUnique, fCallback)`

Creates a database index on the specified column for the given entity, if the index does not already exist.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntitySchema` | `object` | Entity schema object. Must have a `TableName` property. |
| `pColumn` | `object` | Column descriptor object. Must have a `Column` property (string). |
| `pIsUnique` | `boolean` | If `true`, creates a unique index. |
| `fCallback` | `function(pError)` | Callback invoked when the index creation attempt completes. |

**Index naming convention (MySQL):** `AK_{TableName}_{ColumnName}`

**Provider-specific behavior:**
- **MySQL:** Checks `INFORMATION_SCHEMA.STATISTICS` for an existing index before creating. Silently ignores `ER_DUP_KEYNAME` errors.
- **MSSQL:** Uses `IF NOT EXISTS(SELECT * FROM sys.indexes ...)` to conditionally create. Errors are logged but not passed to the callback (the callback always succeeds).

## Usage Examples

### MySQL Connection

```js
const libFable = require('fable');
const libConnectionManager = require('meadow-integration/source/services/clone/Meadow-Service-ConnectionManager');

const fable = new libFable({ Product: 'MyApp' });

fable.serviceManager.addServiceType('MeadowConnectionManager', libConnectionManager);
const connectionManager = fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager',
	{
		Provider: 'MySQL',
		MySQL:
		{
			server: 'db.example.com',
			port: 3306,
			user: 'app_user',
			password: 'secret',
			database: 'production',
			connectionLimit: 10
		}
	});

connectionManager.connect(
	(pError, pConnectionPool) =>
	{
		if (pError)
		{
			console.error('Connection failed:', pError.message);
			return;
		}
		console.log('Connected:', connectionManager.connected); // true
		// pConnectionPool is now available for queries
	});
```

### MSSQL Connection

```js
const fable = new libFable({ Product: 'MyApp' });

fable.serviceManager.addServiceType('MeadowConnectionManager', libConnectionManager);
const connectionManager = fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager',
	{
		Provider: 'MSSQL',
		MSSQL:
		{
			server: 'sql.example.com',
			port: 1433,
			user: 'sa',
			password: 'secret',
			database: 'production',
			ConnectionPoolLimit: 20
		}
	});

connectionManager.connect(
	(pError, pConnectionPool) =>
	{
		if (pError)
		{
			console.error('MSSQL connection failed:', pError.message);
			return;
		}
		console.log('Connected to MSSQL:', connectionManager.connected);
	});
```

### Creating an Index

```js
const entitySchema = { TableName: 'Animal' };
const guidColumn = { Column: 'GUIDAnimal', DataType: 'GUID' };

connectionManager.createIndex(entitySchema, guidColumn, true,
	(pError) =>
	{
		if (pError)
		{
			console.error('Index creation failed:', pError.message);
			return;
		}
		// Index AK_Animal_GUIDAnimal now exists
		console.log('Index created successfully.');
	});
```

## Related Services

- [MeadowCloneRestClient](./clone-rest-client.md) -- REST client for communicating with the remote Meadow API server.
- [MeadowSync](./sync.md) -- Orchestrates full entity synchronization using a ConnectionManager pool.
- [MeadowSyncEntityInitial](./sync-entity-initial.md) -- Initial sync uses the connection pool for table and index creation.
- [MeadowSyncEntityOngoing](./sync-entity-ongoing.md) -- Ongoing sync uses the connection pool for table and index creation.
