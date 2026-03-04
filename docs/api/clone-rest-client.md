# MeadowCloneRestClient

REST client for communicating with a remote Meadow API server. Provides authentication, session management, CRUD operations, and paginated entity set downloads for the data-clone pipeline.

**Source:** `source/services/clone/Meadow-Service-RestClient.js`

**Extends:** `fable-serviceproviderbase`

**Service Type:** `MeadowCloneRestClient`

## Constructor

```js
const restClient = fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient', pOptions);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `DownloadBatchSize` | `number` | `100` | Number of records per page when downloading entity sets. |
| `ServerURL` | `string` | `'https://localhost:8080/1.0/'` | Base URL for all API requests. |
| `UserID` | `string\|false` | `false` | Username for authentication. If `false`, `authenticate()` is a no-op. |
| `Password` | `string\|false` | `false` | Password for authentication. If `false`, `authenticate()` is a no-op. |
| `SessionToken` | `string` | *(none)* | Optional pre-existing session token to use instead of authenticating. |

## Properties

### `session`

*Getter* -- Returns the current session data object, or `false` if not authenticated.

### `loggedIn`

*Getter* -- Returns `boolean`. `true` after a successful call to `authenticate()`, `false` after `deauthenticate()` or before login.

### `serverURL`

The base URL string used for all API requests.

### `cache`

Object map of per-entity `ObjectCache` instances. Populated automatically by `getEntity()` and `getEntitySet()`.

## Methods

### `authenticate(fCallback)`

Authenticates with the Meadow API server using the configured `UserID` and `Password`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError, pSessionData)` | Callback with the session data on success. |

Posts to `{ServerURL}/Authenticate` with `{ UserName, Password }`. On success, stores session data and sets a `UserSession` cookie for subsequent requests.

If `UserID` or `Password` is falsy, authentication is skipped and the callback is invoked immediately.

### `deauthenticate(fCallback)`

Logs out from the Meadow API server and clears session data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fCallback` | `function(pError, pSessionData)` | Callback invoked after logout. `pSessionData` will be `false`. |

### `getJSON(pURL, fCallback)`

Performs a GET request for JSON data at the given URL path (appended to `ServerURL`).

| Parameter | Type | Description |
|-----------|------|-------------|
| `pURL` | `string` | URL path appended to `ServerURL`. |
| `fCallback` | `function(pError, pResponse, pBody)` | Standard REST callback. |

### `createEntity(pEntity, pRecord, fCallback)`

Creates a new entity record on the server via POST.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name (e.g. `'Animal'`). |
| `pRecord` | `object` | Record data to create. |
| `fCallback` | `function(pError, pBody)` | Callback with the created record body. |

### `updateEntity(pEntity, pRecord, fCallback)`

Updates an existing entity record on the server via PUT.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pRecord` | `object` | Record data to update (must include the identifier). |
| `fCallback` | `function(pError, pBody)` | Callback with the updated record body. |

### `upsertEntity(pEntity, pRecord, fCallback)`

Creates or updates an entity record on the server via PUT to the `/Upsert` endpoint.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pRecord` | `object` | Record data to upsert. |
| `fCallback` | `function(pError, pBody)` | Callback with the upserted record body. |

### `deleteEntity(pEntity, pIDRecord, fCallback)`

Deletes an entity record by ID from the server via DELETE.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pIDRecord` | `number\|string` | The ID of the record to delete. |
| `fCallback` | `function(pError, pBody)` | Callback with the response body. |

### `getEntity(pEntity, pIDRecord, fCallback)`

Retrieves a single entity record by ID. Uses an in-memory cache (max age 30s, max 10000 entries) to avoid redundant requests.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pIDRecord` | `number\|string` | The ID of the record to retrieve. |
| `fCallback` | `function(pError, pBody)` | Callback with the record body (from cache or server). |

### `getEntitySet(pEntity, pMeadowFilterExpression, fCallback)`

Downloads a full set of entity records matching a Meadow filter expression. Automatically paginates using `DownloadBatchSize`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | `string` | Entity name. |
| `pMeadowFilterExpression` | `string` | Meadow filter expression (e.g. `'FBV~Deleted~EQ~0'`). |
| `fCallback` | `function(pError, pEntitySet)` | Callback with the full array of records. |

**Algorithm:**
1. Requests the count from `{Entity}s/Count/FilteredTo/{Filter}`.
2. Generates paginated URL fragments based on `DownloadBatchSize`.
3. Downloads each page sequentially and concatenates results.

### `setSessionToken(pSessionToken)`

Manually sets the session token for subsequent requests. The token is appended as a `SessionToken` query parameter when no session data cookie is present.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSessionToken` | `string` | The session token string. |

### `setSessionData(pSessionData)`

Sets session data and configures the `UserSession` cookie on the underlying REST client.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSessionData` | `object` | Session data object. If it has a `SessionID` property, that value is used as the cookie. |

### `resetSessionData()`

Clears all session data and cookies. Called internally by `deauthenticate()`.

## Usage Examples

### Authentication and Reading Entities

```js
const libFable = require('fable');
const libRestClient = require('meadow-integration/source/services/clone/Meadow-Service-RestClient');

const fable = new libFable({ Product: 'CloneApp' });

fable.serviceManager.addServiceType('MeadowCloneRestClient', libRestClient);
const restClient = fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
	{
		ServerURL: 'https://api.example.com/1.0/',
		UserID: 'sync_user',
		Password: 'sync_password',
		DownloadBatchSize: 250
	});

restClient.authenticate(
	(pError, pSessionData) =>
	{
		if (pError)
		{
			console.error('Auth failed:', pError.message);
			return;
		}
		console.log('Logged in:', restClient.loggedIn);
		console.log('Session ID:', pSessionData.SessionID);
	});
```

### Reading a Single Entity

```js
restClient.getEntity('Animal', 42,
	(pError, pRecord) =>
	{
		if (pError)
		{
			console.error('Read failed:', pError.message);
			return;
		}
		console.log('Animal name:', pRecord.Name);
	});
```

### Downloading a Filtered Entity Set

```js
restClient.getEntitySet('Animal', 'FBV~Deleted~EQ~0',
	(pError, pRecords) =>
	{
		if (pError)
		{
			console.error('Download failed:', pError.message);
			return;
		}
		console.log(`Downloaded ${pRecords.length} animals.`);

		for (const tmpRecord of pRecords)
		{
			console.log(`  ${tmpRecord.IDAnimal}: ${tmpRecord.Name}`);
		}
	});
```

### Using a Pre-existing Session Token

```js
const restClient = fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
	{
		ServerURL: 'https://api.example.com/1.0/',
		SessionToken: 'abc-123-def-456'
	});

// No need to call authenticate() -- the token is appended automatically
restClient.getJSON('Animal/1',
	(pError, pResponse, pBody) =>
	{
		console.log('Record:', pBody);
	});
```

### Upserting and Deleting Records

```js
// Upsert
restClient.upsertEntity('Animal', { GUIDAnimal: 'ANIMAL-001', Name: 'Felix', Type: 'Cat' },
	(pError, pBody) =>
	{
		console.log('Upserted:', pBody);
	});

// Delete
restClient.deleteEntity('Animal', 42,
	(pError, pBody) =>
	{
		console.log('Deleted:', pBody);
	});
```

### Deauthentication

```js
restClient.deauthenticate(
	(pError) =>
	{
		console.log('Logged out. Session:', restClient.session); // false
	});
```

## Related Services

- [MeadowConnectionManager](./connection-manager.md) -- Manages the local database connection pool.
- [MeadowSync](./sync.md) -- Orchestrator that uses this REST client to download records from the server.
- [MeadowSyncEntityInitial](./sync-entity-initial.md) -- Uses this client to fetch max IDs, counts, and paginated record sets.
- [MeadowSyncEntityOngoing](./sync-entity-ongoing.md) -- Uses this client for update-based differential sync.
