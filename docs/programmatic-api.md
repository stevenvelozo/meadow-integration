# Programmatic API

Meadow Integration services can be used directly in your Node.js code without the CLI.  This is useful when integrating data transformation into larger applications or custom workflows.

## Services Overview

| Service | Purpose |
|---------|---------|
| `MeadowIntegrationTabularCheck` | Collect statistics on tabular data |
| `MeadowIntegrationTabularTransform` | Transform records into comprehensions |
| `MeadowGUIDMap` | Track bidirectional GUID-to-ID mappings |
| `IntegrationAdapter` | Marshal and push records to Meadow REST APIs |

## Setup

All services are registered with a Pict/Fable instance.  Use `pict` (not `fable`) when you need template parsing:

```javascript
const libPict = require('pict');

let _Pict = new libPict({ LogLevel: 3 });

// CSV parsing
_Pict.instantiateServiceProvider('CSVParser');

// Statistics service
const libTabularCheck = require('meadow-integration/source/services/tabular/Service-TabularCheck.js');
_Pict.addAndInstantiateServiceType('MeadowIntegrationTabularCheck', libTabularCheck);

// Transform service
const libTabularTransform = require('meadow-integration/source/services/tabular/Service-TabularTransform.js');
_Pict.addAndInstantiateServiceType('MeadowIntegrationTabularTransform', libTabularTransform);
```

## TabularCheck: Collecting Statistics

```javascript
// Create a statistics container
let tmpStats = _Pict.MeadowIntegrationTabularCheck.newStatisticsObject('MyDataSet');

// Feed records through
for (let tmpRecord of myRecords)
{
    _Pict.MeadowIntegrationTabularCheck.collectStatistics(tmpRecord, tmpStats);
}

// Inspect results
console.log(`${tmpStats.RowCount} rows, ${tmpStats.ColumnCount} columns`);
console.log('Headers:', tmpStats.Headers);

// Per-column statistics
for (let tmpKey of Object.keys(tmpStats.ColumnStatistics))
{
    let tmpCol = tmpStats.ColumnStatistics[tmpKey];
    console.log(`  ${tmpKey}: ${tmpCol.Count} values, ${tmpCol.EmptyCount} empty`);
}
```

### Statistics Object Shape

```javascript
{
    DataSet: 'MyDataSet',
    RowCount: 1000,
    ColumnCount: 5,
    Headers: ['id', 'name', 'email', 'age', 'city'],
    FirstRow: { id: '1', name: 'Alice', ... },
    LastRow: { id: '1000', name: 'Zach', ... },
    ColumnStatistics: {
        'id': { Count: 1000, EmptyCount: 0, NumericCount: 1000, FirstValue: '1', LastValue: '1000' },
        'name': { Count: 1000, EmptyCount: 5, NumericCount: 0, FirstValue: 'Alice', LastValue: 'Zach' }
    }
}
```

## TabularTransform: Building Comprehensions

```javascript
// Create a mapping outcome (holds state for the transform)
let tmpOutcome = _Pict.MeadowIntegrationTabularTransform.newMappingOutcomeObject();

// Set explicit configuration (equivalent to a mapping file)
tmpOutcome.ExplicitConfiguration = {
    Entity: 'User',
    GUIDTemplate: 'User_{~D:Record.id~}',
    Mappings: {
        DisplayName: '{~D:Record.name~}',
        Email: '{~D:Record.email~}'
    }
};

// Auto-detect implicit configuration from first record
tmpOutcome.ImplicitConfiguration =
    _Pict.MeadowIntegrationTabularTransform.generateMappingConfigurationPrototype(
        'users.csv', myRecords[0]);

// Merge configuration layers
tmpOutcome.Configuration = Object.assign({},
    tmpOutcome.ImplicitConfiguration,
    tmpOutcome.ExplicitConfiguration);
tmpOutcome.Configuration.GUIDName = `GUID${tmpOutcome.Configuration.Entity}`;
tmpOutcome.Comprehension[tmpOutcome.Configuration.Entity] = {};

// Transform each record
for (let tmpRecord of myRecords)
{
    _Pict.MeadowIntegrationTabularTransform.addRecordToComprehension(
        tmpRecord, tmpOutcome);
}

// Access results
let tmpUsers = tmpOutcome.Comprehension.User;
console.log(`Created ${Object.keys(tmpUsers).length} user records`);
```

## GUIDMap: Tracking External System IDs

The GUIDMap service maintains bidirectional mappings between external system identifiers and Meadow internal IDs.

```javascript
const libGUIDMap = require('meadow-integration/source/Meadow-Service-Integration-GUIDMap.js');
_Pict.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);

// Map Meadow GUIDs to numeric IDs
_Pict.MeadowGUIDMap.mapGUIDToID('Book', 'Book_1', 101);

// Look up in both directions
_Pict.MeadowGUIDMap.getIDFromGUID('Book', 'Book_1');    // 101
_Pict.MeadowGUIDMap.getGUIDFromID('Book', 101);         // 'Book_1'

// Track external system GUIDs
_Pict.MeadowGUIDMap.mapExternalGUIDtoMeadowGUID('Book', 'LEGACY-123', 'Book_1');
_Pict.MeadowGUIDMap.getMeadowGUIDFromExternalGUID('Book', 'LEGACY-123');  // 'Book_1'
_Pict.MeadowGUIDMap.getMeadowIDFromExternalGUID('Book', 'LEGACY-123');    // 101
```

## Integration Adapter: Pushing to Meadow APIs

The Integration Adapter marshals comprehension records into Meadow entity format and pushes them to a REST API.

```javascript
const libAdapter = require('meadow-integration/source/Meadow-Service-Integration-Adapter.js');

_Pict.addServiceType('IntegrationAdapter', libAdapter);
let tmpAdapter = _Pict.instantiateServiceProvider('IntegrationAdapter',
    { Entity: 'Book', ApiURLPrefix: '/1.0/' }, 'Book');

// Add source records (must have a GUID{Entity} field)
tmpAdapter.addSourceRecord({ GUIDBook: 'Book_1', Title: 'Example', ISBN: '1234' });
tmpAdapter.addSourceRecord({ GUIDBook: 'Book_2', Title: 'Another', ISBN: '5678' });

// Run the full integration pipeline
tmpAdapter.integrateRecords(
    (pError) =>
    {
        if (pError) console.error('Integration failed:', pError);
        else console.log('Records pushed successfully');
    });
```

### Adapter Options

| Option | Default | Description |
|--------|---------|-------------|
| `Entity` | `'DefaultEntity'` | Entity name |
| `PerformUpserts` | `true` | Enable upsert operations |
| `PerformDeletes` | `true` | Enable delete operations |
| `RecordPushRetryThreshold` | `5` | Max retries per record |
| `RecordThresholdForBulkUpsert` | `1000` | Records threshold for bulk mode |
| `BulkUpsertBatchSize` | `100` | Batch size for bulk upserts |
| `ApiURLPrefix` | `'/1.0/'` | API URL prefix |

See `examples/Example-010-Programmatic-API.js` for a complete runnable example.
