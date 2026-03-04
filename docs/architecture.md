# Architecture

This document describes the architectural design of Meadow Integration, covering both the data transformation and data synchronization pipelines.

## High-Level System Architecture

Meadow Integration sits between external data sources and the Meadow data access layer. It provides three interfaces (CLI, REST, Programmatic) that share a common set of services.

```mermaid
flowchart TB
    subgraph External["External Data Sources"]
        CSV["CSV Files"]
        TSV["TSV Files"]
        JSON["JSON Arrays"]
        API["Remote Meadow API"]
    end

    subgraph Interfaces["Interfaces"]
        CLI["CLI Program\n(pict-service-commandlineutility)"]
        REST["REST Server\n(Orator + Restify)"]
        PROG["Programmatic API\n(require meadow-integration)"]
    end

    subgraph Services["Core Services"]
        TC["TabularCheck"]
        TT["TabularTransform"]
        IA["IntegrationAdapter"]
        GM["GUIDMap"]
        CM["ConnectionManager"]
        CRC["CloneRestClient"]
        SYNC["Sync"]
        SEI["SyncEntityInitial"]
        SEO["SyncEntityOngoing"]
        OP["Operation"]
    end

    subgraph Targets["Targets"]
        MAPI["Meadow REST API\n(write)"]
        DB["Local Database\n(MySQL / MSSQL)"]
    end

    CSV --> CLI
    TSV --> CLI
    JSON --> CLI
    CSV --> REST
    TSV --> REST
    JSON --> REST

    CLI --> TC
    CLI --> TT
    CLI --> IA
    CLI --> SYNC
    REST --> TC
    REST --> TT
    REST --> IA
    PROG --> TC
    PROG --> TT
    PROG --> IA
    PROG --> SYNC

    TT --> IA
    IA --> GM
    IA --> MAPI

    API --> CRC
    CRC --> SYNC
    SYNC --> SEI
    SYNC --> SEO
    SEI --> CM
    SEO --> CM
    CM --> DB

    SYNC --> OP
    SEI --> OP
    SEO --> OP
```

The system divides cleanly into two pipelines that share the `Operation` utility for timing and progress tracking.

## Data Transformation Pipeline

The transformation pipeline converts tabular data into Meadow entity records. Each stage is a discrete service that can be used independently.

```mermaid
flowchart LR
    subgraph Input["1. Parse"]
        FILE["Source File\n(CSV / TSV / JSON)"]
        PARSE["Stream Parser\n(csv-parser / JSON.parse)"]
    end

    subgraph Transform["2. Transform"]
        RECORD["Raw Record"]
        MAPPING["Mapping Config\n(Implicit + Explicit + User)"]
        TEMPLATE["Pict Template Engine\n({~D:Record.col~})"]
        SOLVER["Solvers\n(Expression Parser)"]
    end

    subgraph Collect["3. Collect"]
        COMP["Comprehension\n{Entity: {GUID: Record}}"]
        MERGE["Intersect\n(merge by GUID)"]
    end

    subgraph Push["4. Push"]
        ADAPTER["IntegrationAdapter"]
        MARSHAL["Marshal Record\n(schema validation,\nstring truncation,\nGUID prefixing)"]
        GUIDMAP["GUIDMap\n(external <-> Meadow IDs)"]
        UPSERT["Upsert\n(single or bulk)"]
    end

    FILE --> PARSE --> RECORD
    MAPPING --> TEMPLATE
    RECORD --> TEMPLATE --> COMP
    RECORD --> SOLVER --> COMP
    COMP --> MERGE --> COMP
    COMP --> ADAPTER --> MARSHAL --> GUIDMAP --> UPSERT
```

### Stage Details

**Parse** -- CSV and TSV files are streamed through a parser that emits one record per row. JSON Array files are loaded and iterated. The `TabularCheck` service can analyze records without transforming them, producing column statistics.

**Transform** -- The `TabularTransform` service applies a three-layer configuration cascade to each record:

1. **Implicit** -- Auto-generated from the first record's keys (column names become field names, the first column is used for GUID generation)
2. **Explicit** -- Loaded from a mapping file that specifies entity name, GUID template, and column-to-field mappings
3. **User** -- Command-line overrides for entity name, GUID name, GUID template, and inline column mappings

Each layer merges on top of the previous one using `Object.assign`, so User settings always win.

Pict template expressions resolve column values at transformation time. Solvers (powered by the Fable Expression Parser) enable multi-entity extraction from a single source row by dynamically generating multiple GUID uniqueness entries.

**Collect** -- Transformed records accumulate in a Comprehension object. Records with duplicate GUIDs within the same parse are merged. Records can also be merged with an existing Comprehension loaded from disk.

**Push** -- The `IntegrationAdapter` marshals comprehension records into Meadow-compatible format. It fetches the target entity schema from the Meadow API, validates field types, truncates strings that exceed schema-defined sizes, and strips reserved columns (`CreateDate`, `UpdateDate`, `Deleted`, `DeleteDate`). Cross-entity GUID references are resolved through the `GUIDMap`. Records are pushed via upsert -- individually for small sets, or in configurable bulk batches (default threshold: 1000 records, batch size: 100) for large sets.

## Data Synchronization Pipeline

The Data Clone pipeline replicates entity data from a remote Meadow API into a local relational database.

```mermaid
flowchart TB
    subgraph Config["Configuration"]
        MCFG[".meadow.config.json"]
        SCHEMA["Extended Schema JSON\n(from Stricture)"]
        CLIOPTS["CLI Overrides\n(--api_server, --db_host, etc.)"]
    end

    subgraph Auth["1. Authenticate"]
        CRC["CloneRestClient"]
        SESSION["Session Management\n(cookie / token)"]
    end

    subgraph Connect["2. Connect"]
        CM["ConnectionManager"]
        POOL["Connection Pool\n(MySQL or MSSQL)"]
    end

    subgraph Init["3. Initialize Schema"]
        LOAD["Load Extended Schema"]
        CREATE["Create Tables\n(if not exist)"]
        INDEX["Create Indexes\n(GUID unique, Deleted)"]
    end

    subgraph Sync["4. Sync Entities"]
        COMPARE["Compare\nlocal vs. remote\n(max ID, count, UpdateDate)"]
        DOWNLOAD["Download Pages\n(filtered + sorted)"]
        WRITE["Marshal + Write\n(create or update)"]
        PROGRESS["Progress Tracking\n(Operation service)"]
    end

    MCFG --> CRC
    CLIOPTS --> CRC
    MCFG --> CM
    CLIOPTS --> CM
    SCHEMA --> LOAD

    CRC --> SESSION --> DOWNLOAD
    CM --> POOL --> WRITE
    LOAD --> CREATE --> INDEX

    COMPARE --> DOWNLOAD --> WRITE
    WRITE --> PROGRESS
```

### Stage Details

**Authenticate** -- The `CloneRestClient` authenticates with the remote Meadow API by posting credentials to `/Authenticate`. The resulting session cookie or token is attached to all subsequent requests. If no credentials are configured, authentication is skipped (for unauthenticated APIs). HTTP keep-alive is enabled for connection reuse.

**Connect** -- The `ConnectionManager` establishes a connection pool to the local database. It supports MySQL (via `meadow-connection-mysql`) and MSSQL (via `meadow-connection-mssql`). The provider is selected by the `Destination.Provider` configuration key.

**Initialize Schema** -- The Meadow extended schema JSON (produced by Stricture's `build` command) is loaded. For each entity in the schema (or a configured subset), the sync service uses the Meadow provider to create the table if it does not exist. It then creates a unique index on the GUID column and a non-unique index on the Deleted column using the `ConnectionManager`.

**Sync Entities** -- Entities are synced sequentially in the order defined by `SyncEntityList` (or schema order if the list is empty). Two sync strategies are available:

- **Initial** -- Queries the local max ID and the remote max ID and record count. Generates paginated URL partials filtered to records with IDs greater than the local maximum. Downloads each page and creates records locally with identity insert enabled so primary keys match the remote system.
- **Ongoing** -- Extends Initial sync with `UpdateDate` comparison. After identifying new records by ID, it also compares `UpdateDate` timestamps. Records where the remote `UpdateDate` differs from the local `UpdateDate` by more than 5 milliseconds are updated. This handles both new records and modifications.

## Service Dependency Diagram

All services extend `fable-serviceproviderbase` and register with a Fable instance. The diagram below shows the dependency relationships.

```mermaid
classDiagram
    class FableServiceProviderBase {
        +fable
        +options
        +log
        +serviceType
    }

    class TabularCheck {
        +serviceType: TabularCheck
        +newStatisticsObject()
        +collectStatistics()
    }

    class TabularTransform {
        +serviceType: TabularTransform
        +newMappingOutcomeObject()
        +transformRecord()
        +addRecordToComprehension()
        +createRecordFromMapping()
    }

    class IntegrationAdapter {
        +serviceType: IntegrationAdapter
        +Entity
        +addSourceRecord()
        +integrateRecords()
        +marshalRecord()
        +pushRecordsToServer()
    }

    class GUIDMap {
        +serviceType: MeadowGUIDMap
        +mapGUIDToID()
        +getIDFromGUID()
        +mapExternalGUIDtoMeadowGUID()
        +getMeadowIDFromExternalGUID()
    }

    class ConnectionManager {
        +serviceType: MeadowConnectionManager
        +Provider
        +ConnectionPool
        +connect()
        +createIndex()
    }

    class CloneRestClient {
        +serviceType: MeadowCloneRestClient
        +serverURL
        +authenticate()
        +deauthenticate()
        +getJSON()
        +upsertEntity()
        +getEntitySet()
    }

    class Sync {
        +serviceType: MeadowSync
        +SyncMode
        +SyncEntityList
        +loadMeadowSchema()
        +syncEntity()
        +syncAll()
    }

    class SyncEntityInitial {
        +serviceType: MeadowSyncEntityInitial
        +EntitySchema
        +PageSize
        +initialize()
        +sync()
        +marshalRecord()
    }

    class SyncEntityOngoing {
        +serviceType: MeadowSyncEntityOngoing
        +EntitySchema
        +PageSize
        +initialize()
        +sync()
        +marshalRecord()
    }

    class Operation {
        +timeStamps
        +progressTrackers
        +createTimeStamp()
        +createProgressTracker()
        +printProgressTrackerStatus()
    }

    FableServiceProviderBase <|-- TabularCheck
    FableServiceProviderBase <|-- TabularTransform
    FableServiceProviderBase <|-- IntegrationAdapter
    FableServiceProviderBase <|-- GUIDMap
    FableServiceProviderBase <|-- ConnectionManager
    FableServiceProviderBase <|-- CloneRestClient
    FableServiceProviderBase <|-- Sync
    FableServiceProviderBase <|-- SyncEntityInitial
    FableServiceProviderBase <|-- SyncEntityOngoing

    IntegrationAdapter --> GUIDMap : uses
    Sync --> SyncEntityInitial : creates
    Sync --> SyncEntityOngoing : creates
    SyncEntityInitial --> Operation : uses
    SyncEntityOngoing --> Operation : uses
    SyncEntityInitial ..> CloneRestClient : reads from
    SyncEntityOngoing ..> CloneRestClient : reads from
    SyncEntityInitial ..> ConnectionManager : writes to
    SyncEntityOngoing ..> ConnectionManager : writes to
```

## Configuration Cascade

Configuration for the CLI flows through multiple layers, each overriding the previous.

```mermaid
flowchart LR
    DEF["Default Configuration\n(Default-Meadow-Integration-\nConfiguration.json)"]
    FILE[".meadow.config.json\n(working directory)"]
    CLI["Command-Line Flags\n(--api_server, --db_host, etc.)"]

    DEF -->|"base"| MERGED["Resolved Configuration"]
    FILE -->|"overrides"| MERGED
    CLI -->|"overrides"| MERGED
```

For data transformation, the mapping configuration has its own three-layer cascade:

```mermaid
flowchart LR
    IMP["Implicit\n(auto-detected from\nfirst record)"]
    EXP["Explicit\n(mapping file\nvia -m flag)"]
    USR["User\n(CLI flags:\n-e, -g, -n, -c)"]

    IMP -->|"base"| FINAL["Final Mapping Config"]
    EXP -->|"overrides"| FINAL
    USR -->|"overrides"| FINAL
```

## Sync Mode Comparison

The two sync modes serve different purposes and have different performance characteristics.

```mermaid
flowchart TB
    subgraph Initial["Initial Sync"]
        I1["Query local max ID"]
        I2["Query remote max ID + count"]
        I3["Generate paginated URL partials\n(filter: ID > local max)"]
        I4["Download each page"]
        I5["For each record:\nRead local by ID"]
        I6{"Record\nexists?"}
        I7["Skip"]
        I8["Create with\nidentity insert"]

        I1 --> I2 --> I3 --> I4 --> I5 --> I6
        I6 -->|"yes"| I7
        I6 -->|"no"| I8
    end

    subgraph Ongoing["Ongoing Sync"]
        O1["Query local max ID + UpdateDate"]
        O2["Query remote max ID + UpdateDate + count"]
        O3["Iterate all records\n(paginated, ID ascending)"]
        O4["For each record:\nRead local by ID"]
        O5{"Record\nexists?"}
        O6{"UpdateDate\ndifference\n> 5ms?"}
        O7["Update record"]
        O8["Skip"]
        O9["Create with\nidentity insert"]

        O1 --> O2 --> O3 --> O4 --> O5
        O5 -->|"yes"| O6
        O5 -->|"no"| O9
        O6 -->|"yes"| O7
        O6 -->|"no"| O8
    end
```

| Aspect | Initial | Ongoing |
|--------|---------|---------|
| **Purpose** | First-time clone or catch-up | Incremental sync of changes |
| **Strategy** | Only downloads records with IDs above local max | Walks all records and compares timestamps |
| **Handles new records** | Yes | Yes |
| **Handles updates** | No | Yes (by UpdateDate comparison) |
| **Performance** | Faster for first clone (skips existing) | Slower per run but keeps data current |
| **Typical usage** | Run once, then switch to Ongoing | Run on a schedule (cron, Docker) |

## Docker Deployment

The included Dockerfile builds a production image for running Data Clone as a containerized service. The image is based on `node:20-bookworm` and expects a `.meadow.config.json` to be provided at runtime (via volume mount or baked into a derived image).

```mermaid
flowchart LR
    subgraph Build["Docker Build"]
        BASE["node:20-bookworm"]
        DEPS["npm install --omit=dev"]
        SRC["Copy source + scripts"]
    end

    subgraph Runtime["Docker Runtime"]
        CFG[".meadow.config.json\n(volume mount)"]
        SCHEMA["Extended Schema\n(volume mount)"]
        RUN["scripts/run.sh"]
    end

    subgraph External["External"]
        REMOTE["Remote Meadow API"]
        LOCAL["Local Database"]
    end

    BASE --> DEPS --> SRC --> RUN
    CFG --> RUN
    SCHEMA --> RUN
    RUN --> REMOTE
    RUN --> LOCAL
```

The `docker-compose.yml` can be used to run the Data Clone alongside a local MySQL or MSSQL container for development and testing.
