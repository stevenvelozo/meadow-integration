# MeadowOperation

Utility class providing timestamp management, progress tracking, and memory usage logging for long-running data-clone and sync operations.

**Source:** `source/services/clone/Meadow-Service-Operation.js`

**Note:** This is a plain class (not a Fable service provider). It is instantiated directly with `new MeadowOperation(pFable)`.

## Constructor

```js
const libMeadowOperation = require('meadow-integration/source/services/clone/Meadow-Service-Operation');
const operation = new libMeadowOperation(fable);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFable` | `object` | A Fable instance. The `log` property is used for logging. |

## Properties

### `timeStamps`

`object` -- Map of timestamp hash names to epoch millisecond values. Populated by `createTimeStamp()`.

### `progressTrackers`

`object` -- Map of progress tracker hash names to progress tracker objects. Populated by `createProgressTracker()`.

### `log`

Reference to `pFable.log` for logging output.

## Timestamp Methods

### `createTimeStamp(pTimeStampHash)`

Records the current time as a named timestamp.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pTimeStampHash` | `string` | `'Default'` | Name for this timestamp. |

**Returns:** `number` -- The epoch millisecond value of the timestamp.

### `getTimeDelta(pTimeStampHash)`

Calculates the elapsed time in milliseconds since the named timestamp was created.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pTimeStampHash` | `string` | `'Default'` | Name of the timestamp to measure from. |

**Returns:** `number` -- Elapsed milliseconds, or `-1` if the timestamp does not exist.

### `logTimeDelta(pTimeStampHash, pMessage)`

Logs the elapsed time since the named timestamp and returns it.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pTimeStampHash` | `string` | `'Default'` | Name of the timestamp to measure from. |
| `pMessage` | `string` | `'Elapsed for {hash}: '` | Custom message prefix for the log output. |

**Returns:** `number` -- Elapsed milliseconds.

**Log output format:** `{pMessage} ({milliseconds}ms)`

## Progress Tracker Methods

### Progress Tracker Object Shape

```js
{
	Hash: 'TrackerName',           // The tracker's identifier
	StartTime: 1700000000000,      // Epoch ms when tracker was created
	EndTime: 0,                    // Epoch ms elapsed at completion (0 while running)
	CurrentTime: 0,                // Epoch ms elapsed at last update
	PercentComplete: -1,           // 0-100 float, -1 before first update
	AverageOperationTime: -1,      // ms per operation, -1 before first update
	EstimatedCompletionTime: -1,   // ms remaining, -1 before calculable
	TotalCount: 100,               // Total expected operations
	CurrentCount: -1               // Completed operations (-1 before first update)
}
```

### `createProgressTracker(pTotalOperations, pProgressTrackerHash)`

Creates a new progress tracker with the specified total operation count.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pTotalOperations` | `number` | `100` | Total number of operations expected. |
| `pProgressTrackerHash` | `string` | `'DefaultProgressTracker'` | Name for this tracker. |

**Returns:** `object` -- The progress tracker object.

Also creates a corresponding timestamp with the same hash name.

### `updateProgressTrackerStatus(pProgressTrackerHash, pCurrentOperations)`

Sets the current operation count to an absolute value and recalculates statistics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pProgressTrackerHash` | `string` | `'DefaultProgressTracker'` | Tracker name. |
| `pCurrentOperations` | `number` | -- | The absolute current operation count. |

**Returns:** `object|false` -- The updated progress tracker object, or `false` if the operation count is `NaN`.

Creates the tracker automatically if it does not exist.

### `incrementProgressTrackerStatus(pProgressTrackerHash, pIncrementSize)`

Increments the current operation count by a given amount and recalculates statistics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pProgressTrackerHash` | `string` | `'DefaultProgressTracker'` | Tracker name. |
| `pIncrementSize` | `number` | -- | How many operations to add to the current count. |

**Returns:** `object|false` -- The updated progress tracker object, or `false` if the increment is `NaN`.

Creates the tracker automatically if it does not exist.

### `setProgressTrackerEndTime(pProgressTrackerHash, pCurrentOperations)`

Marks the progress tracker as complete by setting the end time. Optionally updates the final operation count.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pProgressTrackerHash` | `string` | `'DefaultProgressTracker'` | Tracker name. |
| `pCurrentOperations` | `number` | *(none)* | Optional final operation count. |

**Returns:** `object|false` -- The finalized progress tracker object, or `false` if the tracker does not exist.

### `printProgressTrackerStatus(pProgressTrackerHash)`

Logs the current status of a progress tracker in a human-readable format.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pProgressTrackerHash` | `string` | `'DefaultProgressTracker'` | Tracker name. |

**Log output varies by state:**
- **No operations completed:** Reports elapsed time since start.
- **In progress:** Reports percent complete, operation counts, elapsed time, median time per operation, and estimated completion time in both milliseconds and minutes.
- **Completed (EndTime set):** Reports final operation counts and total elapsed time.

## Memory Methods

### `logMemoryResourcesUsed()`

Logs the current heap memory usage of the Node.js process.

**Log output format:** `Memory usage at {X.XX} MB`

## Usage Examples

### Timing an Operation

```js
const libMeadowOperation = require('meadow-integration/source/services/clone/Meadow-Service-Operation');
const operation = new libMeadowOperation(fable);

operation.createTimeStamp('DataLoad');

// ... perform work ...

const elapsed = operation.getTimeDelta('DataLoad');
console.log(`Data load took ${elapsed}ms`);

// Or log it directly with a custom message
operation.logTimeDelta('DataLoad', 'Data loading completed');
// Logs: "Data loading completed (1234ms)"
```

### Tracking Progress of a Batch Operation

```js
const operation = new libMeadowOperation(fable);

const totalRecords = 5000;
operation.createProgressTracker(totalRecords, 'ImportRecords');

// Print initial status
operation.printProgressTrackerStatus('ImportRecords');
// Logs: ">> Progress Tracker ImportRecords has no completed operations. {X}ms have elapsed since it was started."

// Process records in batches
let processedCount = 0;
for (const batch of recordBatches)
{
	// Process the batch...
	processedCount += batch.length;

	operation.updateProgressTrackerStatus('ImportRecords', processedCount);
	operation.printProgressTrackerStatus('ImportRecords');
	// Logs: ">> Progress Tracker ImportRecords is 25.000% completed - 1250 / 5000 operations over 3200ms (median 2.560 per). Estimated completion in 9600ms or 0.16 minutes"
}

// Mark complete
operation.setProgressTrackerEndTime('ImportRecords', totalRecords);
operation.printProgressTrackerStatus('ImportRecords');
// Logs: ">> Progress Tracker ImportRecords is done and completed 5000 / 5000 operations in 12800ms."
```

### Incrementing Progress One at a Time

```js
const operation = new libMeadowOperation(fable);
operation.createProgressTracker(100, 'SyncCustomers');

for (const record of records)
{
	// Process record...
	operation.incrementProgressTrackerStatus('SyncCustomers', 1);
}

operation.setProgressTrackerEndTime('SyncCustomers');
operation.printProgressTrackerStatus('SyncCustomers');
```

### Logging Memory Usage

```js
const operation = new libMeadowOperation(fable);

operation.logMemoryResourcesUsed();
// Logs: "Memory usage at 45.23 MB"

// ... perform memory-intensive operation ...

operation.logMemoryResourcesUsed();
// Logs: "Memory usage at 128.71 MB"
```

## Related Services

- [MeadowSyncEntityInitial](./sync-entity-initial.md) -- Uses MeadowOperation for timing and progress tracking during initial sync.
- [MeadowSyncEntityOngoing](./sync-entity-ongoing.md) -- Uses MeadowOperation for timing and progress tracking during ongoing sync.
