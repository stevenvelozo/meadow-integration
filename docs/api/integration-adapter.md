# MeadowIntegrationAdapter

Adapter for integrating records from an external system into a Meadow-backed data store. Handles GUID marshaling between external and internal identifiers, record transformation, schema-aware field truncation, and batch upsert operations with retry logic.

**Source:** `source/Meadow-Service-Integration-Adapter.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `IntegrationAdapter`

## Constructor

```js
const adapter = fable.instantiateServiceProvider('IntegrationAdapter', pOptions, pServiceHash);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `Entity` | `string` | `'DefaultEntity'` | The Meadow entity name this adapter manages (e.g. `'Customer'`). |
| `AdapterSetGUIDMarshalPrefix` | `string\|false` | `false` | Prefix for the adapter set in generated GUIDs. Falls back to `fable.settings.AdapterSetGUIDMarshalPrefix`, then `'INTG-DEF'`. |
| `EntityGUIDMarshalPrefix` | `string\|false` | `false` | Per-entity prefix in generated GUIDs. Defaults to `'E-{Entity}'`. |
| `PerformUpserts` | `boolean` | `true` | Whether to push marshaled records to the server. |
| `PerformDeletes` | `boolean` | `true` | Whether to process deleted records. |
| `RecordPushRetryThreshold` | `number` | `5` | Maximum number of retry attempts per upsert before giving up. Hard cap of 50. |
| `RecordThresholdForBulkUpsert` | `number` | `1000` | If total records exceed this count, uses bulk upsert. |
| `BulkUpsertBatchSize` | `number` | `100` | Number of records per bulk upsert batch. |
| `ApiURLPrefix` | `string` | `'/1.0/'` | URL prefix for the Meadow API. |
| `ServerURL` | `string` | *(auto)* | Server URL override. Defaults to `RestClient.serverURL` or `http://localhost:8086{ApiURLPrefix}`. |

## Properties

### `Entity`

`string` -- The entity name this adapter manages.

### `EntityGUIDName`

`string` -- The GUID column name, derived as `'GUID{Entity}'` (e.g. `'GUIDCustomer'`).

### `EntityIDName`

`string` -- The ID column name, derived as `'ID{Entity}'` (e.g. `'IDCustomer'`).

### `AdapterSetGUIDMarshalPrefix`

`string` -- The adapter set prefix used in GUID generation.

### `EntityGUIDMarshalPrefix`

`string` -- The entity-specific prefix used in GUID generation.

### `meadowSchema`

`object` -- The entity's JSON Schema, fetched from the server during `integrateRecords()`. Used for field type checking and string truncation.

## Methods

### `addSourceRecord(pRecord)`

Adds a record from the external system to the source record buffer for later marshaling.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRecord` | `object` | A record object. Must have a property matching `EntityGUIDName` (e.g. `GUIDCustomer`) with a truthy value. |

**Returns:** `false` if the record is invalid, otherwise `undefined`.

Records are keyed by their external GUID value in the internal `_SourceRecords` map.

### `generateMeadowGUIDFromExternalGUID(pExternalGUID)`

Generates a deterministic Meadow GUID from an external system GUID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pExternalGUID` | `string` | The external system's GUID value. |

**Returns:** `string` -- Format: `'{AdapterSetGUIDMarshalPrefix}-{EntityGUIDMarshalPrefix}-{pExternalGUID}'`

**Example:** `'INTG-DEF-E-Customer-EXT-12345'`

### `marshalRecord(pSourceRecord)`

Transforms an external source record into a Meadow-compatible record.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSourceRecord` | `object` | The external record with external GUIDs. |

**Returns:** `object` -- The marshaled record with internal Meadow GUIDs.

**Transformation logic:**
1. Generates the internal Meadow GUID for the entity from the external GUID.
2. Maps the external GUID to the Meadow GUID in the `MeadowGUIDMap`.
3. For other `GUID*` properties: looks up the corresponding Meadow ID via `MeadowGUIDMap.getMeadowIDFromExternalGUID()` and sets the `ID{Entity}` property.
4. For `_GUID*` properties (already-Meadow GUIDs): looks up the ID via `MeadowGUIDMap.getIDFromGUID()`.
5. For schema-defined properties: copies values, truncating strings that exceed the schema-defined `size`.
6. Strips reserved Meadow fields: `CreateDate`, `UpdateDate`, `Deleted`, `DeleteDate`.

### `marshalSourceRecords(fCallback, fMarshalExtraData)`

Marshals all records in the source buffer into the marshaled records buffer.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function()` | Callback invoked when marshaling is complete. |
| `fMarshalExtraData` | `function(pSourceRecord, pMarshaledRecord)` | Optional hook called after each record is marshaled. |

Deleted source records (where `Deleted === true`) are moved to the `_DeletedRecords` buffer instead. Duplicate GUIDs are merged with `Object.assign`.

### `integrateRecords(fCallback, fMarshalExtraData)`

Performs the full integration pipeline: fetch schema, marshal source records, and push to server.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError)` | Callback invoked when integration is complete. |
| `fMarshalExtraData` | `function(pSourceRecord, pMarshaledRecord)` | Optional hook for extra marshaling logic. |

**Pipeline stages (sequential via Anticipate):**
1. Fetches the entity's JSON Schema from `{ServerURL}{Entity}/Schema`.
2. Calls `marshalSourceRecords()` to transform all buffered source records.
3. Calls `pushRecordsToServer()` to upsert all marshaled records.

### `upsertSingleRecord(fCallback, pRecordGUID, pRetryCount)`

Upserts a single marshaled record to the server with retry logic.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function()` | Callback invoked when the upsert completes (or retries are exhausted). |
| `pRecordGUID` | `string` | The internal Meadow GUID of the record to upsert. |
| `pRetryCount` | `number` | Current retry count (incremented on failure). |

On successful upsert, maps the returned GUID to its server-assigned ID in the `MeadowGUIDMap`.

### `upsertBulkRecords(fCallback, pRecordGUIDs, pRetryCount)`

Upserts a batch of marshaled records to the server with retry logic.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function()` | Callback invoked when the bulk upsert completes. |
| `pRecordGUIDs` | `Array<string>` | Array of internal Meadow GUIDs to upsert. |
| `pRetryCount` | `number` | Current retry count. |

Sends all records in the batch to the server's bulk upsert endpoint. On success, maps all returned GUIDs to their IDs.

## Static Methods

### `MeadowIntegrationAdapter.getAdapter(pFable, pEntity, pEntityPrefix)`

Factory/lookup helper for getting or creating an adapter for a given entity.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFable` | `object` | The Fable instance. |
| `pEntity` | `string` | Entity name. |
| `pEntityPrefix` | `string` | Optional `EntityGUIDMarshalPrefix`. |

**Returns:** `MeadowIntegrationAdapter` -- An existing adapter instance if one is registered for the entity, otherwise creates and returns a new one.

## Usage Examples

### Basic Integration Workflow

```js
const libFable = require('fable');
const libAdapter = require('meadow-integration/source/Meadow-Service-Integration-Adapter');

const fable = new libFable(
	{
		Product: 'Importer',
		AdapterSetGUIDMarshalPrefix: 'CRM-SYNC'
	});

fable.serviceManager.addServiceType('IntegrationAdapter', libAdapter);

const customerAdapter = fable.instantiateServiceProvider('IntegrationAdapter',
	{
		Entity: 'Customer',
		EntityGUIDMarshalPrefix: 'CUST',
		ServerURL: 'https://api.example.com/1.0/',
		RecordPushRetryThreshold: 3
	},
	'Customer');

// Add source records from the external CRM
customerAdapter.addSourceRecord(
	{
		GUIDCustomer: 'CRM-42',
		Name: 'Alice Smith',
		Email: 'alice@example.com'
	});

customerAdapter.addSourceRecord(
	{
		GUIDCustomer: 'CRM-43',
		Name: 'Bob Jones',
		Email: 'bob@example.com'
	});

// Run the full pipeline
customerAdapter.integrateRecords(
	(pError) =>
	{
		if (pError)
		{
			console.error('Integration failed:', pError);
			return;
		}
		console.log('Customer integration complete!');
	});
```

### Using the Static getAdapter Helper

```js
const libAdapter = require('meadow-integration/source/Meadow-Service-Integration-Adapter');

// Returns an existing adapter if one is registered, otherwise creates a new one
const orderAdapter = libAdapter.getAdapter(fable, 'Order', 'ORD');

orderAdapter.addSourceRecord(
	{
		GUIDOrder: 'EXT-ORD-100',
		GUIDCustomer: 'CRM-42',
		Total: 99.99
	});

orderAdapter.integrateRecords(
	(pError) =>
	{
		console.log('Order integration complete!');
	});
```

### GUID Marshaling

```js
const adapter = libAdapter.getAdapter(fable, 'Product', 'PROD');

// Generate internal GUID from external one
const meadowGUID = adapter.generateMeadowGUIDFromExternalGUID('SKU-ABC-123');
// Result: 'CRM-SYNC-PROD-SKU-ABC-123'

// Marshal a record manually
const marshaled = adapter.marshalRecord(
	{
		GUIDProduct: 'SKU-ABC-123',
		Name: 'Widget',
		Price: 19.99,
		GUIDCategory: 'CAT-5'  // Will be looked up in GUIDMap
	});
// marshaled.GUIDProduct => 'CRM-SYNC-PROD-SKU-ABC-123'
// marshaled.IDCategory => (looked up from GUIDMap, or logged as warning if not found)
```

### With Extra Marshal Data Hook

```js
customerAdapter.integrateRecords(
	(pError) =>
	{
		console.log('Done!');
	},
	(pSourceRecord, pMarshaledRecord) =>
	{
		// Custom transformation after standard marshaling
		if (pSourceRecord.ExternalStatus === 'VIP')
		{
			pMarshaledRecord.Tier = 'Premium';
		}
	});
```

## Related Services

- [MeadowGUIDMap](./guid-map.md) -- Maintains the GUID-to-ID and external-to-internal GUID mappings used by this adapter.
- [MeadowCloneRestClient](./clone-rest-client.md) -- Alternative REST client for clone operations (this adapter uses its own `EntityProvider`).
- [MeadowOperation](./operation.md) -- Can be used alongside this adapter for progress tracking.
