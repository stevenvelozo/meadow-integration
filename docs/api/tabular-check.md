# Service-TabularCheck (MeadowIntegrationTabularCheck)

Statistical analysis service for tabular data records. Collects column-level statistics including row counts, empty value counts, numeric detection, and first/last values for data quality inspection before transformation or integration.

**Source:** `source/services/tabular/Service-TabularCheck.js`

**Extends:** `fable-serviceproviderbase`

## Constructor

```js
const tabularCheck = fable.serviceManager.instantiateServiceProvider('TabularCheck', pOptions);
```

No custom options are required.

## Methods

### `newStatisticsObject(pTabularDatasetName)`

Creates a new, empty statistics container object for tracking dataset metrics.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pTabularDatasetName` | `string` | A name identifying the dataset (e.g. `'airports.csv'`). |

**Returns:** `object` -- A statistics object with the following shape:

```js
{
	DataSet: 'airports.csv',       // Name of the dataset
	FirstRow: null,                // Reference to the first record processed
	RowCount: 0,                   // Total number of rows processed
	LastRow: null,                 // Reference to the most recent record processed
	Headers: [],                   // Array of column name strings, in discovery order
	ColumnCount: 0,                // Total unique columns discovered
	ColumnStatistics: {},          // Per-column statistics (see below)
	Records: null                  // Array of all records (only if pStoreFullRecord is true)
}
```

### `collectStatistics(pRecord, pStatisticsObject, pStoreFullRecord)`

Processes a single record and updates the statistics object with its data.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pRecord` | `object` | -- | A single data record (key-value object). |
| `pStatisticsObject` | `object` | *(auto-created)* | The statistics object to update. If not a valid object, a new one is created automatically. |
| `pStoreFullRecord` | `boolean` | `false` | If `true`, pushes the full record into `Records` array for later inspection. |

**Returns:** `object` -- The updated statistics object.

**Per-column statistics shape** (each entry in `ColumnStatistics`):

```js
{
	Count: 0,           // Number of records that have this column
	EmptyCount: 0,      // Number of records where this column is null or empty string
	NumericCount: 0,    // Number of records where this column's value is numeric
	FirstValue: null,   // The first non-null value seen for this column
	LastValue: null      // The most recent value seen for this column
}
```

**Behavior notes:**
- Each call increments `RowCount` by 1.
- The first record processed is stored as `FirstRow`; every record updates `LastRow`.
- New columns are added to `Headers` and `ColumnStatistics` as they are discovered.
- A value is considered numeric if `fable.Math.parsePrecise(value, NaN)` returns a valid number.
- A value is considered empty if it is strictly `null` or an empty string `''`.
- Callers are responsible for ensuring each record is only sent through once.

## Statistics Object Shape (Complete)

```js
{
	DataSet: 'my-dataset',
	FirstRow: { Name: 'Alice', Age: '30', City: 'Portland' },
	RowCount: 1000,
	LastRow: { Name: 'Zoe', Age: '25', City: 'Seattle' },
	Headers: ['Name', 'Age', 'City'],
	ColumnCount: 3,
	ColumnStatistics:
	{
		Name:
		{
			Count: 1000,
			EmptyCount: 5,
			NumericCount: 0,
			FirstValue: 'Alice',
			LastValue: 'Zoe'
		},
		Age:
		{
			Count: 1000,
			EmptyCount: 12,
			NumericCount: 988,
			FirstValue: '30',
			LastValue: '25'
		},
		City:
		{
			Count: 1000,
			EmptyCount: 50,
			NumericCount: 0,
			FirstValue: 'Portland',
			LastValue: 'Seattle'
		}
	},
	Records: null
}
```

## Usage Examples

### Basic Dataset Statistics

```js
const libFable = require('fable');
const libTabularCheck = require('meadow-integration/source/services/tabular/Service-TabularCheck');

const fable = new libFable({ Product: 'DataInspector' });

fable.serviceManager.addServiceType('TabularCheck', libTabularCheck);
const checker = fable.serviceManager.instantiateServiceProvider('TabularCheck');

// Create a statistics container
const stats = checker.newStatisticsObject('customers.csv');

// Process records one by one (e.g. from a CSV stream)
const records =
[
	{ Name: 'Alice', Email: 'alice@example.com', Age: '30' },
	{ Name: 'Bob', Email: '', Age: '25' },
	{ Name: '', Email: 'charlie@example.com', Age: 'unknown' },
	{ Name: 'Diana', Email: 'diana@example.com', Age: '35' }
];

for (const record of records)
{
	checker.collectStatistics(record, stats);
}

console.log(`Dataset: ${stats.DataSet}`);
console.log(`Rows: ${stats.RowCount}`);           // 4
console.log(`Columns: ${stats.ColumnCount}`);      // 3
console.log(`Headers: ${stats.Headers.join(', ')}`); // Name, Email, Age

console.log('Name empty count:', stats.ColumnStatistics.Name.EmptyCount);     // 1
console.log('Email empty count:', stats.ColumnStatistics.Email.EmptyCount);   // 1
console.log('Age numeric count:', stats.ColumnStatistics.Age.NumericCount);   // 3 (30, 25, 35)
console.log('Age first value:', stats.ColumnStatistics.Age.FirstValue);       // '30'
```

### Storing Full Records for Inspection

```js
const stats = checker.newStatisticsObject('products.csv');
stats.Records = []; // Must initialize the Records array before enabling storage

for (const record of productRecords)
{
	checker.collectStatistics(record, stats, true);
}

console.log(`Stored ${stats.Records.length} records for inspection.`);
console.log('First stored record:', stats.Records[0]);
```

### Auto-Created Statistics Object

```js
// If you pass a non-object, a statistics object is created automatically
const stats = checker.collectStatistics({ Name: 'Alice', Age: '30' }, null);
console.log(stats.DataSet); // 'Unknown-{uuid}'
console.log(stats.RowCount); // 1
```

### Analyzing Column Quality

```js
const stats = checker.newStatisticsObject('orders.csv');

for (const record of orderRecords)
{
	checker.collectStatistics(record, stats);
}

// Report columns with high empty rates
for (const header of stats.Headers)
{
	const colStats = stats.ColumnStatistics[header];
	const emptyRate = (colStats.EmptyCount / colStats.Count * 100).toFixed(1);

	if (colStats.EmptyCount > 0)
	{
		console.log(`Column "${header}": ${emptyRate}% empty (${colStats.EmptyCount}/${colStats.Count})`);
	}

	// Detect likely numeric columns
	const numericRate = (colStats.NumericCount / colStats.Count * 100).toFixed(1);
	if (colStats.NumericCount > colStats.Count * 0.9)
	{
		console.log(`Column "${header}": likely numeric (${numericRate}% numeric values)`);
	}
}
```

## Related Services

- [Service-TabularTransform](./tabular-transform.md) -- Transforms tabular records using mapping configurations; often used after TabularCheck validates the data shape.
- [MeadowIntegrationAdapter](./integration-adapter.md) -- Integrates transformed records into a Meadow data store.
