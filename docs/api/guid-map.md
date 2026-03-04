# MeadowGUIDMap

In-memory bidirectional mapping service between Meadow GUIDs, Meadow IDs, and external system GUIDs. Used by the integration adapter to resolve entity references across system boundaries.

**Source:** `source/Meadow-Service-Integration-GUIDMap.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowGUIDMap`

## Constructor

```js
const guidMap = fable.addAndInstantiateServiceType('MeadowGUIDMap', libMeadowGUIDMap);
```

The `MeadowGUIDMap` is typically instantiated automatically by `MeadowIntegrationAdapter` if one does not already exist on the Fable instance.

### Options

The default options object is empty. No configuration is currently required.

## Internal Data Structures

The GUIDMap maintains three parallel in-memory maps, each keyed by entity name:

| Map | Description |
|-----|-------------|
| `_GUIDMap` | `{ Entity: { MeadowGUID: MeadowID } }` -- Maps Meadow GUIDs to numeric IDs. |
| `_IDMap` | `{ Entity: { MeadowID: MeadowGUID } }` -- Reverse map of numeric IDs to Meadow GUIDs. |
| `_ExternalGUIDMap` | `{ Entity: { ExternalGUID: MeadowGUID } }` -- Maps external system GUIDs to Meadow GUIDs. |

## Methods

### `addEntity(pEntity)`

Initializes the mapping tables for a given entity if they do not already exist.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name (e.g. `'Customer'`). |

**Returns:** `true`

Called automatically by other methods when an entity is encountered for the first time.

### `mapGUIDToID(pEntity, pGUID, pID)`

Stores a bidirectional mapping between a Meadow GUID and its numeric ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pGUID` | `string` | The Meadow GUID value. |
| `pID` | `number\|string` | The numeric ID value. |

**Returns:** `true`

Updates both `_GUIDMap[Entity][GUID] = ID` and `_IDMap[Entity][ID] = GUID`.

### `getIDFromGUID(pEntity, pGUID)`

Looks up the numeric ID for a given Meadow GUID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pGUID` | `string` | The Meadow GUID to look up. |

**Returns:** `number|string|false` -- The ID if found, or `false` if the GUID is not mapped.

### `getIDFromGUIDAsync(pEntity, pGUID, fCallback)`

Asynchronous version of `getIDFromGUID`. If the GUID is not in the local map, attempts to fetch the record from the server via `fable.MeadowRestClient.getEntityByGUID()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pGUID` | `string` | The Meadow GUID to look up. |
| `fCallback` | `function(pError, pID)` | Callback with the ID if found, or `false`. |

If the record is fetched from the server, the GUID-to-ID mapping is stored for future lookups.

### `getGUIDFromID(pEntity, pID)`

Looks up the Meadow GUID for a given numeric ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pID` | `number\|string` | The numeric ID to look up. |

**Returns:** `string|false` -- The GUID if found, or `false` if the ID is not mapped.

### `mapExternalGUIDtoMeadowGUID(pEntity, pExternalGUID, pMeadowGUID)`

Stores a one-directional mapping from an external system GUID to a Meadow GUID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pExternalGUID` | `string` | The external system's GUID value. |
| `pMeadowGUID` | `string` | The corresponding Meadow GUID. |

**Returns:** `true`

### `getMeadowGUIDFromExternalGUID(pEntity, pExternalGUID)`

Looks up the Meadow GUID for a given external system GUID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pExternalGUID` | `string` | The external system's GUID to look up. |

**Returns:** `string|false` -- The Meadow GUID if found, or `false`.

### `getMeadowIDFromExternalGUID(pEntity, pExternalGUID)`

Resolves an external system GUID all the way to a Meadow numeric ID by chaining `getMeadowGUIDFromExternalGUID()` and `getIDFromGUID()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pExternalGUID` | `string` | The external system's GUID to resolve. |

**Returns:** `number|string|false` -- The Meadow ID if both mappings exist, or `false`.

## Usage Examples

### Basic GUID-to-ID Mapping

```js
const libFable = require('fable');
const libGUIDMap = require('meadow-integration/source/Meadow-Service-Integration-GUIDMap');

const fable = new libFable({ Product: 'Mapper' });
const guidMap = fable.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);

// Store a mapping
guidMap.mapGUIDToID('Customer', 'INTG-CUST-001', 42);

// Look up by GUID
const id = guidMap.getIDFromGUID('Customer', 'INTG-CUST-001');
console.log(id); // 42

// Look up by ID (reverse)
const guid = guidMap.getGUIDFromID('Customer', 42);
console.log(guid); // 'INTG-CUST-001'
```

### External GUID Resolution Chain

```js
// Step 1: Map external GUID to Meadow GUID
guidMap.mapExternalGUIDtoMeadowGUID('Customer', 'CRM-42', 'INTG-DEF-E-Customer-CRM-42');

// Step 2: Map Meadow GUID to Meadow ID (done by the adapter after server upsert)
guidMap.mapGUIDToID('Customer', 'INTG-DEF-E-Customer-CRM-42', 100);

// Step 3: Resolve external GUID directly to Meadow GUID
const meadowGUID = guidMap.getMeadowGUIDFromExternalGUID('Customer', 'CRM-42');
console.log(meadowGUID); // 'INTG-DEF-E-Customer-CRM-42'

// Step 4: Resolve external GUID all the way to Meadow ID
const meadowID = guidMap.getMeadowIDFromExternalGUID('Customer', 'CRM-42');
console.log(meadowID); // 100
```

### Cross-Entity Reference Resolution

```js
// After integrating Customers, their mappings exist
guidMap.mapExternalGUIDtoMeadowGUID('Customer', 'CRM-42', 'INTG-DEF-E-Customer-CRM-42');
guidMap.mapGUIDToID('Customer', 'INTG-DEF-E-Customer-CRM-42', 100);

// When integrating Orders, resolve the Customer reference
const customerID = guidMap.getMeadowIDFromExternalGUID('Customer', 'CRM-42');
console.log(customerID); // 100

// The adapter uses this to set IDCustomer on the Order record
const orderRecord = {
	GUIDOrder: 'INTG-DEF-E-Order-ORD-500',
	IDCustomer: customerID,
	Total: 99.99
};
```

### Async GUID Lookup (Server Fallback)

```js
guidMap.getIDFromGUIDAsync('Customer', 'INTG-DEF-E-Customer-CRM-99',
	(pError, pID) =>
	{
		if (pError)
		{
			console.error('Lookup failed:', pError.message);
			return;
		}
		if (pID)
		{
			console.log('Found Customer ID:', pID);
		}
		else
		{
			console.log('Customer not found on server.');
		}
	});
```

## Mapping Flow Diagram

```
External System              MeadowGUIDMap                 Meadow Server
---------------              -------------                 -------------
CRM-42          --mapExternalGUIDtoMeadowGUID-->
                INTG-DEF-E-Customer-CRM-42
                              --mapGUIDToID-->
                              GUID: INTG-DEF-E-Customer-CRM-42  =>  ID: 100

Later lookups:
getMeadowGUIDFromExternalGUID('Customer', 'CRM-42')
  => 'INTG-DEF-E-Customer-CRM-42'

getMeadowIDFromExternalGUID('Customer', 'CRM-42')
  => 100

getGUIDFromID('Customer', 100)
  => 'INTG-DEF-E-Customer-CRM-42'
```

## Related Services

- [MeadowIntegrationAdapter](./integration-adapter.md) -- The primary consumer; uses GUIDMap for all GUID resolution during record marshaling and upsert.
