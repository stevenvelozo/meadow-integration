# Data Clone System Overview

The data clone system synchronizes data from a remote Meadow API server to a local relational database. It is designed for offline access, reporting, data warehousing, and building local replicas of Meadow-managed datasets.

## What It Does

The data clone system connects to a source Meadow REST API, reads entity records using paginated queries, and writes them into a local MySQL or MSSQL database. Tables are auto-created from the Meadow schema, and indexes are built on GUID and Deleted columns for query performance.

## Why Use It

- **Offline access**: Work with your data without a persistent connection to the source API.
- **Reporting**: Run complex SQL queries against a local database without impacting the production API.
- **Data warehousing**: Aggregate data from Meadow APIs into a central database for analytics.
- **Development**: Maintain a local copy of production data for development and testing.

## Key Components

### ConnectionManager

Manages database connections for MySQL and MSSQL providers. Handles connection pooling, table creation, and index management.

See [connection-manager.md](connection-manager.md) for details.

### RestClient

A REST client service (`MeadowCloneRestClient`) that communicates with the source Meadow API. Handles authentication, session management, caching, and paginated entity retrieval via keep-alive HTTP connections.

Key capabilities:
- Session-based authentication (`authenticate` / `deauthenticate`)
- CRUD operations (`getEntity`, `createEntity`, `updateEntity`, `upsertEntity`, `deleteEntity`)
- Bulk retrieval with automatic pagination (`getEntitySet`)
- Built-in LRU object cache per entity type (30-second TTL, 10,000 entries)

### Sync

The `MeadowSync` service orchestrates the overall synchronization. It loads a Meadow schema, creates `SyncEntity` instances for each entity, and runs them in sequence.

### SyncEntity (Initial and Ongoing)

Two sync strategies are available:

- **MeadowSyncEntityInitial**: Full clone using ID-based pagination. Only creates new records.
- **MeadowSyncEntityOngoing**: Incremental sync using UpdateDate comparison. Creates new records and updates changed ones.

See [sync-modes.md](sync-modes.md) for a detailed comparison.

## Supported Providers

| Provider | Module | Default Port |
|----------|--------|-------------|
| MySQL | `meadow-connection-mysql` | 3306 |
| MSSQL | `meadow-connection-mssql` | 1433 |

## Sync Modes

| Mode | Strategy | Creates | Updates | Use Case |
|------|----------|---------|---------|----------|
| Initial | ID-based pagination from max local ID | Yes | No | First-time full clone |
| Ongoing | UpdateDate comparison across all records | Yes | Yes | Incremental sync after initial clone |

## Running a Data Clone

### Via CLI

```bash
mdwint data-clone \
  --api_server "https://api.example.com/1.0/" \
  --api_username "admin" \
  --api_password "secret" \
  --db_host "127.0.0.1" \
  --db_name "local_clone" \
  --schema_path "./schema/Model-Extended.json" \
  --sync_mode "Initial"
```

### Via Configuration File

Create a `.meadow.config.json` file (see [configuration.md](configuration.md)) and run:

```bash
mdwint data-clone
```

### Programmatically

```javascript
const meadowIntegration = require('meadow-integration');
const libFable = require('fable');

const fable = new libFable({});

// Register services
fable.serviceManager.addServiceType('MeadowCloneRestClient', meadowIntegration.CloneRestClient);
fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient', {
    ServerURL: 'https://api.example.com/1.0/',
    UserID: 'admin',
    Password: 'secret'
});

fable.serviceManager.addServiceType('MeadowConnectionManager', meadowIntegration.ConnectionManager);
fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', {
    Provider: 'MySQL',
    MySQL: {
        server: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: 'local_clone',
        connectionLimit: 20
    }
});

fable.serviceManager.addServiceType('MeadowSync', meadowIntegration.Sync);

// Authenticate, connect, load schema, sync
fable.MeadowCloneRestClient.authenticate((pAuthError) => {
    fable.MeadowConnectionManager.connect((pConnectError, pPool) => {
        fable.serviceManager.instantiateServiceProvider('MeadowSync', {
            ConnectionPool: pPool,
            PageSize: 100
        });
        fable.MeadowSync.SyncMode = 'Initial';
        const schema = require('./schema/Model-Extended.json');
        fable.MeadowSync.loadMeadowSchema(schema, (pLoadError) => {
            fable.MeadowSync.syncAll((pSyncError) => {
                console.log('Sync complete!');
            });
        });
    });
});
```

## Architecture Diagram

```
+-------------------+       HTTPS/HTTP       +-------------------+
|  Source Meadow    |  <-------------------> |  RestClient       |
|  API Server       |    GET /Entity/...     |  (MeadowClone     |
+-------------------+    Session Auth        |   RestClient)     |
                                             +--------+----------+
                                                      |
                                                      v
                                             +-------------------+
                                             |  MeadowSync       |
                                             |  (Orchestrator)   |
                                             +--------+----------+
                                                      |
                                         +------------+------------+
                                         |                         |
                                  +------+------+          +-------+-------+
                                  | SyncEntity  |          | SyncEntity    |
                                  | Initial     |          | Ongoing       |
                                  +------+------+          +-------+-------+
                                         |                         |
                                         v                         v
                                  +------+-------------------------+------+
                                  |       ConnectionManager               |
                                  |       (MySQL / MSSQL)                 |
                                  +---------------------------------------+
                                                      |
                                                      v
                                             +-------------------+
                                             |  Local Database   |
                                             |  (MySQL / MSSQL)  |
                                             +-------------------+
```

## Related Documentation

- [Connection Manager](connection-manager.md) -- Database connection setup and index creation
- [Sync Modes](sync-modes.md) -- Detailed comparison of Initial vs Ongoing sync
- [Configuration](configuration.md) -- Full `.meadow.config.json` reference
- [Docker Deployment](docker.md) -- Running data-clone in Docker
