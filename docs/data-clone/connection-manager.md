# ConnectionManager

The `MeadowConnectionManager` service manages database connections for the data clone system. It supports MySQL and MSSQL providers, handles connection pooling, and provides automatic index creation on synced tables.

## Provider Selection

Set the `Provider` property to choose the database backend:

| Provider | Value | Required Module |
|----------|-------|-----------------|
| MySQL | `"MySQL"` | `meadow-connection-mysql` |
| MSSQL | `"MSSQL"` | `meadow-connection-mssql` |

Both modules are included as dependencies in `meadow-integration`.

## MySQL Configuration

### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `server` | string | `"127.0.0.1"` | MySQL server hostname or IP address |
| `port` | number | `3306` | MySQL server port |
| `user` | string | `"root"` | Database username |
| `password` | string | `""` | Database password |
| `database` | string | `"meadow"` | Database name |
| `connectionLimit` | number | `20` | Maximum number of connections in the pool |

### Example

```javascript
const meadowIntegration = require('meadow-integration');
const libFable = require('fable');

const fable = new libFable({});

fable.serviceManager.addServiceType('MeadowConnectionManager', meadowIntegration.ConnectionManager);
fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', {
    Provider: 'MySQL',
    MySQL: {
        server: '127.0.0.1',
        port: 3306,
        user: 'app_user',
        password: 'secure_password',
        database: 'meadow_clone',
        connectionLimit: 20
    }
});

fable.MeadowConnectionManager.connect((pError, pConnectionPool) => {
    if (pError) {
        console.error('MySQL connection failed:', pError);
        return;
    }
    console.log('Connected to MySQL. Pool ready.');
    // pConnectionPool is the mysql2 pool instance
});
```

### How MySQL Connection Works

1. The `meadow-connection-mysql` module is loaded dynamically.
2. The `connectionLimit` is propagated to `fable.settings` for the Meadow provider.
3. MySQL settings are applied to `fable.settings.MySQL`.
4. The provider is registered as `MeadowMySQLProvider` and connected via `connectAsync`.
5. The resulting connection pool is stored in `ConnectionManager.ConnectionPool`.

## MSSQL Configuration

### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `server` | string | `"127.0.0.1"` | MSSQL server hostname or IP address |
| `port` | number | `1433` | MSSQL server port |
| `user` | string | `"sa"` | Database username |
| `password` | string | `""` | Database password |
| `database` | string | `"meadow"` | Database name |
| `ConnectionPoolLimit` | number | `20` | Maximum number of connections in the pool |

### Example

```javascript
const meadowIntegration = require('meadow-integration');
const libFable = require('fable');

const fable = new libFable({});

fable.serviceManager.addServiceType('MeadowConnectionManager', meadowIntegration.ConnectionManager);
fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', {
    Provider: 'MSSQL',
    MSSQL: {
        server: 'sql-server.local',
        port: 1433,
        user: 'sa',
        password: 'YourStrong!Passw0rd',
        database: 'meadow_clone',
        ConnectionPoolLimit: 20
    }
});

fable.MeadowConnectionManager.connect((pError, pConnectionPool) => {
    if (pError) {
        console.error('MSSQL connection failed:', pError);
        return;
    }
    console.log('Connected to MSSQL. Pool ready.');
});
```

### How MSSQL Connection Works

1. The `meadow-connection-mssql` module is loaded dynamically.
2. MSSQL settings are applied to `fable.settings.MSSQL`.
3. The provider is registered as `MeadowMSSQLProvider` and connected via `connectAsync`.
4. The resulting connection pool is stored in `ConnectionManager.ConnectionPool`.

## Automatic Index Creation

During sync initialization, the `SyncEntity` (both Initial and Ongoing) automatically creates indexes on two column types:

### GUID Column Index

A **unique** index is created on any column with `DataType: "GUID"` in the Meadow schema. The index is named `AK_{TableName}_{ColumnName}`.

### Deleted Column Index

A **non-unique** index is created on the `Deleted` column if it exists. This speeds up queries that filter on soft-deleted records.

### Index Creation Behavior

- **MySQL**: Uses `INFORMATION_SCHEMA.STATISTICS` to check if the index already exists before creating it. Duplicate key errors (`ER_DUP_KEYNAME`) are silently ignored.
- **MSSQL**: Uses `sys.indexes` with `IF NOT EXISTS` to conditionally create the index.
- If no GUID or Deleted columns exist on a table, index creation is skipped entirely.
- If no `ConnectionManager` or connection pool is available, index creation is skipped with a log message.

### Programmatic Index Creation

You can also create indexes manually:

```javascript
const entitySchema = {
    TableName: 'Book',
    Columns: [
        { Column: 'GUIDBook', DataType: 'GUID' }
    ]
};

fable.MeadowConnectionManager.createIndex(
    entitySchema,
    { Column: 'GUIDBook' },
    true,  // unique
    (pError) => {
        if (pError) {
            console.error('Index creation failed:', pError);
        } else {
            console.log('Index created successfully.');
        }
    }
);
```

## Connection Pooling

Both MySQL and MSSQL use connection pooling to manage database connections efficiently:

- **MySQL**: Uses the `connectionLimit` property (default 20) via the `mysql2` pool.
- **MSSQL**: Uses the `ConnectionPoolLimit` property (default 20) via the `mssql` pool.

The pool is created once during `connect()` and reused for all subsequent queries within the sync process.

## Checking Connection State

```javascript
if (fable.MeadowConnectionManager.connected) {
    console.log('Database is connected.');
} else {
    console.log('Database is not connected.');
}
```

## Default Configuration

The default configuration is exported as `MeadowConnectionManager.default_configuration`:

```json
{
    "Provider": "MySQL",
    "MySQL": {
        "server": "127.0.0.1",
        "port": 3306,
        "user": "root",
        "password": "",
        "database": "meadow",
        "connectionLimit": 20
    },
    "MSSQL": {
        "server": "127.0.0.1",
        "port": 1433,
        "user": "sa",
        "password": "",
        "database": "meadow",
        "ConnectionPoolLimit": 20
    }
}
```
