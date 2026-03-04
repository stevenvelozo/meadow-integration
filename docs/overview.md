# Overview

Meadow Integration is a toolkit for bridging external data sources and the Meadow data access layer. It handles two complementary workflows: **data transformation** (getting data _into_ Meadow) and **data synchronization** (replicating data _from_ a Meadow API to a local database).

## Why Meadow Integration Exists

Applications built on the Retold stack use Meadow as their data access layer, with entities defined by Stricture schemas and exposed through auto-generated REST APIs. Meadow Integration fills the gaps around that core:

- **Ingestion** -- External data (CSV exports, TSV dumps, JSON feeds) needs to be converted into the entity format that Meadow expects before it can be loaded.
- **Merging** -- Data often comes from multiple sources that describe the same entities. These sources need to be reconciled by shared keys before loading.
- **Cloning** -- Teams running analytics, reporting, or development work need local copies of production data without direct database access. Data Clone pulls entity records through the Meadow REST API and writes them into a local MySQL or MSSQL database.

## Three Modes of Operation

Meadow Integration exposes its functionality through three interfaces. All three share the same underlying service implementations.

### CLI

The `meadow-integration` command-line program (also available as `mdwint` when installed globally) provides commands for every operation. It is built on `pict-service-commandlineutility` and reads configuration from a `.meadow.config.json` file if one exists in the working directory.

```shell
npx meadow-integration csvtransform ./books.csv -m mapping.json -o books.json
npx meadow-integration data-clone --api_server https://api.example.com/1.0/ --schema_path ./schema.json
```

### REST API

The `serve` command starts an HTTP server (powered by Orator and Restify) that exposes every transformation and merge operation as a POST endpoint. This lets other services call Meadow Integration over the network.

```shell
npx meadow-integration serve -p 8086
```

Endpoints are grouped under `/1.0/` and include CSV, TSV, JSON Array, and Comprehension operations.

### Programmatic API

The module exports its services directly for use in your own Node.js code:

```javascript
const MeadowIntegration = require('meadow-integration');

// TabularCheck, IntegrationServer, ConnectionManager,
// CloneRestClient, Sync, SyncEntityInitial,
// SyncEntityOngoing, Operation
```

Services follow the Fable service provider pattern: instantiate them with a Fable instance and they get access to logging, configuration, and dependency injection automatically.

## Data Transformation Pipeline

The transformation pipeline converts external tabular data into Meadow-compatible entity records through a format called a **Comprehension**.

```
External Data (CSV / TSV / JSON Array)
        |
        v
  TabularTransform Service
  (column mapping via Pict templates)
        |
        v
  Comprehension Object
  (entity records keyed by GUID)
        |
        v
  Integration Adapter
  (marshal to Meadow schema, resolve cross-entity GUIDs)
        |
        v
  GUID Map
  (track external <-> Meadow IDs)
        |
        v
  Meadow REST API
  (single upsert or bulk upsert)
```

**Key steps:**

1. **Parse** -- The source file is parsed into individual records (rows).
2. **Map** -- Each record is transformed using a mapping configuration. Pict template expressions (`{~D:Record.column_name~}`) resolve column values. A GUID is generated for each record from a template.
3. **Collect** -- Transformed records are gathered into a Comprehension object, keyed by their generated GUID. Duplicate GUIDs are merged automatically.
4. **Marshal** -- The Integration Adapter converts comprehension records into Meadow entity format, prefixing GUIDs and resolving cross-entity ID references through the GUID Map.
5. **Push** -- Records are upserted to the target Meadow REST API, either individually or in bulk batches (configurable threshold).

## Data Synchronization Pipeline

The Data Clone pipeline replicates entities from a remote Meadow REST API into a local relational database.

```
Remote Meadow REST API
        |
        v
  CloneRestClient
  (authenticated HTTP, session management, caching)
        |
        v
  Sync Service
  (orchestrates per-entity sync in schema order)
        |
        v
  SyncEntity (Initial or Ongoing)
  (paginated download, record comparison, create/update)
        |
        v
  ConnectionManager
  (MySQL or MSSQL connection pool)
        |
        v
  Local Database
  (tables auto-created from Meadow schema, indexes on GUID and Deleted columns)
```

**Key steps:**

1. **Connect** -- The ConnectionManager establishes a connection pool to the local database. The CloneRestClient authenticates with the remote API (if credentials are configured).
2. **Schema** -- The Meadow extended schema JSON is loaded. Tables are created locally if they do not exist. Indexes are added on GUID and Deleted columns.
3. **Compare** -- For each entity, the sync service compares local and remote max IDs and record counts to determine what needs to be synchronized.
4. **Download** -- Records are fetched from the remote API in configurable page sizes using filtered, sorted endpoint calls.
5. **Write** -- Each downloaded record is marshaled into the local schema format and either created or updated in the local database. Identity insert is enabled so that primary keys match the remote system.

Two sync modes are available:

- **Initial** -- Downloads all records with IDs greater than the local maximum. Intended for first-time clones or catch-up operations.
- **Ongoing** -- Compares `UpdateDate` timestamps between local and remote records and updates any that have changed. Handles both new records and modifications.

## Key Concepts

### Comprehension

A JSON object that stores entity records keyed by their GUID. A single comprehension can hold multiple entity types. This is the intermediate data format that connects all transformation operations.

### GUID

A deterministic, template-generated identifier that uniquely identifies a record across systems. GUIDs are composed from a configurable template (e.g., `Book_{~D:Record.isbn~}`), ensuring the same source data always produces the same key.

### Entity

A named type of record corresponding to a Meadow schema table (e.g., `Book`, `Author`, `Airport`). Entities have a standard identity column (`IDEntityName`), a GUID column (`GUIDEntityName`), and timestamping columns (`CreateDate`, `UpdateDate`).

### Mapping

A configuration object that describes how to transform source columns into entity fields. It includes the entity name, a GUID template, and a dictionary of field-to-template mappings. Optional Solvers allow multi-entity extraction from a single source row.

## When to Use Which Tool

| Scenario | Tool |
|----------|------|
| One-off CSV/TSV analysis | `csvcheck` CLI command |
| Transform a file into entity records | `csvtransform` / `tsvtransform` / `jsonarraytransform` CLI commands |
| Combine multiple data sources | `comprehensionintersect` CLI command |
| Push transformed data to a Meadow API | `load_comprehension` CLI command or Comprehension Push REST endpoint |
| Expose transformations as a service | `serve` CLI command (REST API) |
| Replicate a Meadow API to a local database | `data-clone` CLI command |
| Run data clone in a container | Docker deployment with `.meadow.config.json` |
| Use services in your own code | Programmatic API via `require('meadow-integration')` |
