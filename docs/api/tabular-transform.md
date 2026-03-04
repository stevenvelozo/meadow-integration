# Service-TabularTransform (MeadowIntegrationTabularTransform)

Transformation service for mapping tabular data records into Meadow entity comprehensions. Uses configurable column mapping templates to convert external data (CSV rows, API results, etc.) into entity records with auto-generated GUIDs, template-based field values, and optional solver-based transformations.

**Source:** `source/services/tabular/Service-TabularTransform.js`

**Extends:** `fable-serviceproviderbase`

## Constructor

```js
const transform = fable.serviceManager.instantiateServiceProvider('TabularTransform', pOptions);
```

No custom options are required.

## Mapping Configuration

A mapping configuration defines how incoming data fields map to entity record fields. It can be provided explicitly or generated automatically from the first record.

### Mapping Configuration Shape

```js
{
	"Entity": "Airport",
	"GUIDTemplate": "Airport-{~D:iata~}",
	"GUIDName": "GUIDAirport",              // Auto-derived as GUID{Entity} if omitted
	"Mappings":
	{
		"Code": "{~D:iata~}",
		"Name": "{~D:name~}",
		"Description": "{~D:name~} airport in {~D:city~}",
		"City": "{~D:city~}",
		"State": "{~D:state~}",
		"Country": "{~D:country~}",
		"Latitude": "{~D:lat~}",
		"Longitude": "{~D:long~}"
	},
	"Solvers": [],                           // Optional array of expression solver definitions
	"MultipleGUIDUniqueness": false,         // If true, supports multiple GUID uniqueness entries per record
	"ManyfestAddresses": false               // If true, uses Manyfest setValueAtAddress for nested paths
}
```

Template expressions use Fable's template engine syntax (e.g., `{~D:fieldname~}` or `{~Data:Record.fieldname~}`).

## Mapping Outcome Object

The mapping outcome object tracks the state and results of a transformation operation.

### `newMappingOutcomeObject()`

Creates a new, empty mapping outcome object.

**Returns:**

```js
{
	Comprehension: {},             // Generated records keyed by entity name, then by GUID
	ExistingComprehension: false,  // Optional existing comprehension for merging with previous data

	ImplicitConfiguration: false,  // Auto-generated configuration from first record
	ExplicitConfiguration: false,  // User-provided mapping configuration file
	UserConfiguration: {},         // Runtime overrides (e.g. different entity name)
	Configuration: false,          // Final merged configuration (Implicit + Explicit + User)

	ParsedRowCount: 0,             // Number of rows processed
	BadRecords: []                 // Records that failed validation (no GUID, invalid data)
}
```

## Methods

### `newMappingOutcomeObject()`

Creates a fresh mapping outcome container for a new transformation session.

**Returns:** `object` -- An empty mapping outcome object (see shape above).

### `generateMappingConfigurationPrototype(pRepresentativeString, pRecord)`

Auto-generates a mapping configuration from a representative string (typically a filename) and a sample record.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRepresentativeString` | `string` | A name used to derive the entity name (e.g. `'my favorite cats.csv'` becomes `'MyFavoriteCats'`). |
| `pRecord` | `object` | A sample record whose keys become the mapping fields. |

**Returns:** `object` -- A mapping configuration with auto-generated `Entity`, `GUIDTemplate`, and `Mappings`.

**Example:**

```js
const config = transform.generateMappingConfigurationPrototype('airport data', { iata: 'PDX', name: 'Portland' });
// Returns:
// {
//   Entity: 'AirportData',
//   GUIDTemplate: 'GUID-AirportData-{~Data:Record.iata~}',
//   Mappings: {
//     iata: '{~Data:Record.iata~}',
//     name: '{~Data:Record.name~}'
//   }
// }
```

### `createRecordFromMapping(pRecord, pMapping, pRecordPrototype)`

Creates a single entity record by applying a mapping configuration to an incoming data record.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pRecord` | `object` | The incoming data record (used as template data context). |
| `pMapping` | `object` | The mapping configuration with `GUIDName`, `GUIDTemplate`, and `Mappings`. |
| `pRecordPrototype` | `object\|null` | Optional base object to merge onto (deep-cloned). Defaults to `{}`. |

**Returns:** `object` -- The generated entity record with GUID and mapped fields.

**Behavior:**
- Sets the GUID field using `fable.parseTemplate(GUIDTemplate, pRecord)`.
- For each key in `Mappings`, resolves the template expression against `pRecord`.
- If `pMapping.ManyfestAddresses` is `true`, uses `fable.manifest.setValueAtAddress()` for nested property paths.

### `addRecordToComprehension(pIncomingRecord, pMappingOutcome, pNewRecordPrototype, pGUIDUniquenessString)`

Creates a record from mapping and adds it to the comprehension within the mapping outcome, handling duplicates and merging with existing data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pIncomingRecord` | `object` | The raw incoming data record. |
| `pMappingOutcome` | `object` | The mapping outcome object containing the comprehension. |
| `pNewRecordPrototype` | `object` | Optional record prototype for base values. |
| `pGUIDUniquenessString` | `string` | Optional uniqueness string injected as `_GUIDUniqueness` into the record before mapping. |

**Duplicate handling:**
- If the generated GUID already exists in the current `Comprehension`, the new record is merged onto the existing one via `Object.assign`.
- If the GUID exists in `ExistingComprehension` (previous run), it is pulled in and merged.
- If the record has no valid GUID, it is added to `BadRecords`.

### `transformRecord(pIncomingRecord, pMappingOutcomeObject)`

The primary entry point for transforming a single incoming record. Handles initialization, solver execution, and comprehension insertion.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pIncomingRecord` | `object` | The raw incoming data record. |
| `pMappingOutcomeObject` | `object` | The mapping outcome object (created via `newMappingOutcomeObject()`). |

**Behavior:**
1. Initializes the mapping outcome if not already done (merges Implicit, Explicit, and User configurations).
2. Increments `ParsedRowCount`.
3. Creates a solution context object with `IncomingRecord`, `MappingConfiguration`, `RowIndex`, `Fable`, and `AppData`.
4. If `Configuration.Solvers` is defined, executes each solver expression via `fable.ExpressionParser.solve()`. Solvers can modify `NewRecordPrototype` and `NewRecordsGUIDUniqueness`.
5. If `MultipleGUIDUniqueness` is enabled and uniqueness entries exist, creates one record per uniqueness entry.
6. Otherwise, creates a single record and adds it to the comprehension.

### Lifecycle Hooks

Two empty methods are available for subclass overrides:

- **`onBeforeInitializeMappingOutcomeObject(pMappingOutcomeObject)`** -- Called before configuration merging.
- **`onAfterInitializeMappingOutcomeObject(pMappingOutcomeObject)`** -- Called after configuration merging and GUID name setup.

## Usage Examples

### Basic CSV-to-Entity Transformation

```js
const libFable = require('fable');
const libTabularTransform = require('meadow-integration/source/services/tabular/Service-TabularTransform');

const fable = new libFable({ Product: 'DataImporter' });

fable.serviceManager.addServiceType('TabularTransform', libTabularTransform);
const transform = fable.serviceManager.instantiateServiceProvider('TabularTransform');

// Define the mapping configuration
const mappingConfig =
{
	Entity: 'Airport',
	GUIDTemplate: 'Airport-{~Data:Record.iata~}',
	Mappings:
	{
		Code: '{~Data:Record.iata~}',
		Name: '{~Data:Record.name~}',
		City: '{~Data:Record.city~}',
		State: '{~Data:Record.state~}',
		Country: '{~Data:Record.country~}'
	}
};

// Create a mapping outcome and set the explicit configuration
const outcome = transform.newMappingOutcomeObject();
outcome.ExplicitConfiguration = mappingConfig;

// Transform each CSV row
const csvRows =
[
	{ iata: 'PDX', name: 'Portland International', city: 'Portland', state: 'OR', country: 'US' },
	{ iata: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', state: 'WA', country: 'US' },
	{ iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', state: 'CA', country: 'US' }
];

for (const row of csvRows)
{
	transform.transformRecord(row, outcome);
}

console.log(`Parsed ${outcome.ParsedRowCount} rows.`);
console.log(`Bad records: ${outcome.BadRecords.length}`);
console.log('Airport records:', Object.keys(outcome.Comprehension.Airport));
// ['Airport-PDX', 'Airport-SEA', 'Airport-SFO']

const pdxRecord = outcome.Comprehension.Airport['Airport-PDX'];
console.log(pdxRecord);
// {
//   GUIDAirport: 'Airport-PDX',
//   Code: 'PDX',
//   Name: 'Portland International',
//   City: 'Portland',
//   State: 'OR',
//   Country: 'US'
// }
```

### Auto-Generated Configuration from Data

```js
const transform = fable.serviceManager.instantiateServiceProvider('TabularTransform');

// Auto-generate a mapping from a sample record
const sampleRecord = { iata: 'PDX', name: 'Portland', city: 'Portland', state: 'OR' };
const autoConfig = transform.generateMappingConfigurationPrototype('airports', sampleRecord);

console.log(autoConfig.Entity);        // 'Airports'
console.log(autoConfig.GUIDTemplate);  // 'GUID-Airports-{~Data:Record.iata~}'
console.log(autoConfig.Mappings);
// {
//   iata: '{~Data:Record.iata~}',
//   name: '{~Data:Record.name~}',
//   city: '{~Data:Record.city~}',
//   state: '{~Data:Record.state~}'
// }
```

### Creating a Single Record from Mapping

```js
const mapping =
{
	GUIDName: 'GUIDProduct',
	GUIDTemplate: 'PROD-{~Data:Record.sku~}',
	Mappings:
	{
		Name: '{~Data:Record.name~}',
		Price: '{~Data:Record.price~}'
	}
};

const record = transform.createRecordFromMapping(
	{ sku: 'ABC-123', name: 'Widget', price: '19.99' },
	mapping);

console.log(record);
// {
//   GUIDProduct: 'PROD-ABC-123',
//   Name: 'Widget',
//   Price: '19.99'
// }
```

### Merging with Existing Comprehension

```js
const outcome = transform.newMappingOutcomeObject();
outcome.ExplicitConfiguration = mappingConfig;

// Provide existing data from a previous run
outcome.ExistingComprehension =
{
	Airport:
	{
		'Airport-PDX': { GUIDAirport: 'Airport-PDX', Code: 'PDX', Name: 'Portland Intl', Rating: 5 }
	}
};

// Transform a record that matches an existing GUID
transform.transformRecord(
	{ iata: 'PDX', name: 'Portland International (Updated)', city: 'Portland', state: 'OR', country: 'US' },
	outcome);

// The existing record is merged with new data
const merged = outcome.Comprehension.Airport['Airport-PDX'];
console.log(merged.Rating);  // 5 (preserved from existing)
console.log(merged.Name);    // 'Portland International (Updated)' (overwritten by new data)
```

### Using User Configuration Overrides

```js
const outcome = transform.newMappingOutcomeObject();
outcome.ExplicitConfiguration = mappingConfig;

// Override the entity name at runtime
outcome.UserConfiguration = { Entity: 'InternationalAirport' };

transform.transformRecord(csvRows[0], outcome);

// Records are stored under the overridden entity name
console.log(Object.keys(outcome.Comprehension)); // ['InternationalAirport']
```

## Related Services

- [Service-TabularCheck](./tabular-check.md) -- Statistical analysis for tabular data; often used before transformation to validate the data shape.
- [MeadowIntegrationAdapter](./integration-adapter.md) -- Integrates the comprehension output from TabularTransform into a Meadow data store.
- [MeadowGUIDMap](./guid-map.md) -- Maintains GUID-to-ID mappings that may be needed during integration of transformed records.
