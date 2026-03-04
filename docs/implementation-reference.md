# Implementation Reference

This document covers the internal structure of Meadow Integration, including module layout, service patterns, configuration resolution, error handling, and extension points.

## Module Structure

```
meadow-integration/
├── package.json
├── Dockerfile
├── docker-compose.yml
├── scripts/
│   └── run.sh
├── source/
│   ├── Meadow-Integration.js                          # Main export (programmatic API)
│   ├── Meadow-Service-Integration-Adapter.js          # IntegrationAdapter service
│   ├── Meadow-Service-Integration-GUIDMap.js          # GUIDMap service
│   ├── cli/
│   │   ├── Meadow-Integration-CLI-Program.js          # CLI program setup
│   │   ├── Meadow-Integration-CLI-Run.js              # CLI entry point
│   │   ├── Default-Meadow-Integration-Configuration.json
│   │   └── commands/
│   │       ├── Meadow-Integration-Command-CSVCheck.js
│   │       ├── Meadow-Integration-Command-CSVTransform.js
│   │       ├── Meadow-Integration-Command-TSVCheck.js
│   │       ├── Meadow-Integration-Command-TSVTransform.js
│   │       ├── Meadow-Integration-Command-JSONArrayTransform.js
│   │       ├── Meadow-Integration-Command-ComprehensionIntersect.js
│   │       ├── Meadow-Integration-Command-ComprehensionArray.js
│   │       ├── Meadow-Integration-Command-ComprehensionPush.js
│   │       ├── Meadow-Integration-Command-ObjectArrayToCSV.js
│   │       ├── Meadow-Integration-Command-EntityFromTabularFolder.js
│   │       ├── Meadow-Integration-Command-DataClone.js
│   │       ├── Meadow-Integration-Command-ConvertXLSMToXLSX.js
│   │       └── Meadow-Integration-Command-Serve.js
│   ├── restserver/
│   │   ├── Meadow-Integration-Server.js               # REST server class
│   │   ├── Meadow-Integration-Server-Endpoints.js     # Endpoint registration
│   │   └── endpoints/
│   │       ├── Endpoint-CSVCheck.js
│   │       ├── Endpoint-CSVTransform.js
│   │       ├── Endpoint-TSVCheck.js
│   │       ├── Endpoint-TSVTransform.js
│   │       ├── Endpoint-JSONArrayTransform.js
│   │       ├── Endpoint-ComprehensionIntersect.js
│   │       ├── Endpoint-ComprehensionArray.js
│   │       ├── Endpoint-ComprehensionPush.js
│   │       ├── Endpoint-ObjectArrayToCSV.js
│   │       └── Endpoint-EntityFromTabularFolder.js
│   └── services/
│       ├── clone/
│       │   ├── Meadow-Service-ConnectionManager.js    # Database connection pooling
│       │   ├── Meadow-Service-RestClient.js           # Authenticated REST client
│       │   ├── Meadow-Service-Sync.js                 # Sync orchestrator
│       │   ├── Meadow-Service-Sync-Entity-Initial.js  # Initial sync strategy
│       │   ├── Meadow-Service-Sync-Entity-Ongoing.js  # Ongoing sync strategy
│       │   └── Meadow-Service-Operation.js            # Timing and progress tracking
│       └── tabular/
│           ├── Service-TabularCheck.js                # Statistics collection
│           └── Service-TabularTransform.js            # Record transformation
├── test/
├── examples/
└── docs/
```

## Service Registration Patterns

All services in Meadow Integration extend `fable-serviceproviderbase`. They follow the Fable service provider pattern for registration and instantiation.

### Registration and Instantiation

Services are registered with a service type name and then instantiated. This gives them access to `this.fable` (the Fable instance), `this.options` (merged configuration), and `this.log` (the Fable logger).

```javascript
// Register the service type
this.fable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);

// Instantiate with options and an optional service hash (name)
this.fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', tmpConfig.Destination);
```

After instantiation, the service is available on the Fable instance by its type name:

```javascript
this.fable.MeadowConnectionManager.connect(fCallback);
```

### Lazy Service Initialization

Several services check whether a dependency is already registered before adding it. This prevents duplicate registration when multiple services share a dependency.

```javascript
if (!this.fable.hasOwnProperty('MeadowGUIDMap'))
{
    this.fable.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);
}
```

### Named Service Instances

When multiple instances of the same service type are needed (e.g., one `SyncEntity` per table), the third parameter to `instantiateServiceProvider` acts as a service hash:

```javascript
this.fable.serviceManager.instantiateServiceProvider(
    'MeadowSyncEntityInitial',
    tmpSyncEntityOptions,
    `SyncEntity-${tmpEntitySchema.TableName}`
);
```

These are stored in `this.fable.servicesMap.MeadowSyncEntityInitial` keyed by the hash.

## Configuration Resolution Order

### CLI Program Configuration

The CLI program (`pict-service-commandlineutility`) resolves configuration in this order:

1. **Default** -- `Default-Meadow-Integration-Configuration.json` baked into the module
2. **File** -- `.meadow.config.json` in the current working directory (auto-gathered by the CLI framework)
3. **Command-line** -- Flags passed to the specific command (e.g., `--api_server`, `--db_host`)

The result is available as `this.fable.ProgramConfiguration`.

### Data Clone Configuration

The `data-clone` command has its own `_resolveConfig()` method that builds the final configuration:

```javascript
const tmpConfig = JSON.parse(JSON.stringify(this.fable.ProgramConfiguration));

// Apply CLI overrides for Source
if (this.CommandOptions.api_server) tmpConfig.Source.ServerURL = this.CommandOptions.api_server;

// Apply CLI overrides for Destination
if (this.CommandOptions.db_host) tmpConfig.Destination[tmpProvider].server = this.CommandOptions.db_host;
```

### Transformation Mapping Configuration

The `TabularTransform` service uses a three-layer cascade for mapping configuration:

1. **Implicit** -- Auto-generated from the first incoming record. Entity name is derived from the filename, GUID template uses the first column, and all columns are mapped 1:1.
2. **Explicit** -- Loaded from a mapping file (JSON). Specifies entity name, GUID template, and selective column mappings with Pict template expressions.
3. **User** -- CLI flags (`-e`, `-g`, `-n`, `-c`) override individual values.

The layers merge with `Object.assign`:

```javascript
tmpMappingOutcome.Configuration = Object.assign(
    {},
    tmpMappingOutcome.ImplicitConfiguration,
    tmpMappingOutcome.ExplicitConfiguration,
    tmpMappingOutcome.UserConfiguration
);
```

## Error Handling Patterns

### Retry with Threshold

The `IntegrationAdapter` uses a retry pattern for upsert operations. If a push fails, it retries up to `RecordPushRetryThreshold` times (default: 5, hard cap: 50):

```javascript
upsertSingleRecord(fCallback, pRecordGUID, pRetryCount)
{
    let tmpRetryCount = (typeof(pRetryCount) === 'undefined') ? 0 : pRetryCount;

    if ((tmpRetryCount > this._RecordPushRetryThreshold) || (tmpRetryCount > 50))
    {
        this.log.error(`Retry threshold reached for ${this.Entity}.${pRecordGUID}`);
        return fCallback();
    }

    // ... attempt upsert, on failure:
    this.upsertSingleRecord(fCallback, pRecordGUID, tmpRetryCount++);
}
```

### Non-Fatal Continuation

Sync operations log errors but continue processing remaining records and entities. This prevents a single bad record from stopping an entire clone operation:

```javascript
if (pCreateError)
{
    this.log.error(`Error creating record ${this.EntitySchema.TableName}: ${pCreateError}`);
    return fEntitySyncComplete();  // Continue to next record
}
```

### Connection Failure

The `ConnectionManager` wraps database driver loading in try/catch blocks to handle cases where the driver package is not installed:

```javascript
try
{
    const libMeadowConnectionMySQL = require('meadow-connection-mysql');
    // ... connect
}
catch (pError)
{
    this.log.error(`Failed to load MySQL provider. Ensure meadow-connection-mysql is installed.`);
    return fCallback(pError);
}
```

### Validation at Construction

Sync entity services validate their options in the constructor, throwing errors for missing or invalid configuration rather than failing silently later:

```javascript
if (!this.options.hasOwnProperty('MeadowEntitySchema'))
{
    throw new Error('MeadowSyncEntityInitial requires a valid MeadowEntitySchema option.');
}
```

## Extension Points

### Custom Record Marshaling

The `IntegrationAdapter.integrateRecords` method accepts an optional `fMarshalExtraData` callback that runs after each record is marshaled. This allows injecting additional data or performing side effects:

```javascript
adapter.integrateRecords(fCallback,
    (pSourceRecord, pMarshaledRecord) =>
    {
        // Add computed fields, log specific records, etc.
        pMarshaledRecord.ComputedField = computeValue(pSourceRecord);
    });
```

### Custom REST Client Preparation

The `CloneRestClient` exposes a `prepareRequestOptions` method that can be overridden to add custom headers, authentication tokens, or request modifications:

```javascript
cloneClient.prepareRequestOptions = (pOptions) =>
{
    pOptions.headers = { 'X-Custom-Header': 'value' };
    return pOptions;
};
```

### Custom Sync Entity Lists

The `Sync` service accepts a `SyncEntityList` array in its options or via `ProgramConfiguration`. When provided, only the listed entities are synced, in the specified order. When empty, all entities in the loaded schema are synced:

```json
{
    "SyncEntityList": ["User", "Role", "Permission"]
}
```

### Per-Entity Sync Options

The `SyncEntityOptions` configuration key allows per-entity overrides:

```json
{
    "SyncEntityOptions": {
        "AuditLog": { "PageSize": 500 }
    }
}
```

### Solver-Based Multi-Entity Extraction

The `TabularTransform` service supports Solvers in mapping configurations. Solvers use the Fable Expression Parser to run arbitrary expressions during transformation, enabling extraction of multiple entity types from a single source row:

```json
{
    "Entity": "BookAuthor",
    "MultipleGUIDUniqueness": true,
    "GUIDTemplate": "BookAuthor_{~D:Record.book_id~}_{~D:_GUIDUniqueness~}",
    "Solvers": [
        "// Custom solver expressions that populate NewRecordsGUIDUniqueness"
    ]
}
```

### MappingOutcome Lifecycle Hooks

The `TabularTransform` service provides overridable hooks for the mapping outcome lifecycle:

- `onBeforeInitializeMappingOutcomeObject(pMappingOutcomeObject)` -- Called before the mapping configuration is resolved
- `onAfterInitializeMappingOutcomeObject(pMappingOutcomeObject)` -- Called after configuration is merged and the comprehension entity container is created

These can be overridden in a subclass to inject custom initialization logic.

## Testing Approach

Tests are written with Mocha in TDD style and run via Quackage:

```shell
npm test          # Run tests
npm run coverage  # Run with nyc coverage
```

Test files are located in the `test/` directory. The test suite covers:

- **Tabular parsing** -- Verifying CSV, TSV, and JSON array parsing with known input files
- **Transformation** -- Testing mapping configurations, GUID generation, and comprehension output
- **Comprehension operations** -- Intersect, array conversion, and CSV export
- **Integration Adapter** -- Record marshaling, GUID prefixing, and cross-entity ID resolution
- **REST endpoints** -- Starting the server and exercising each endpoint with HTTP requests
- **Data Clone services** -- ConnectionManager, CloneRestClient, and Sync service integration

Test data files are stored in the `debug/testdata/` directory and include sample CSV, TSV, and JSON files along with mapping configurations and expected outputs.
