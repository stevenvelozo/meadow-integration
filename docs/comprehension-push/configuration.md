# Comprehension Push Configuration Reference

The `load_comprehension` command (aliases: `load`, `push`) pushes a comprehension JSON file to a Meadow REST API using the Integration Adapter service. It is configured through a `.meadow.config.json` file and/or CLI flags.

## Configuration File

The configuration file is named `.meadow.config.json`. The CLI toolkit automatically searches for this file using the same cascading strategy as the data-clone command.

### Cascading Resolution Order

1. **Current working directory** -- `.meadow.config.json` in the directory where the command is run.
2. **Parent directories** -- Walks up the directory tree searching for `.meadow.config.json`.
3. **Home directory** -- `~/.meadow.config.json` as a fallback.

Settings from the configuration file are merged with the built-in defaults. CLI flags override configuration file values.

## Full Configuration Schema

```json
{
    "Source": {
        "ServerURL": "https://api.example.com/1.0/",
        "UserID": "integration_user",
        "Password": "integration_password"
    },
    "SessionManager": {
        "Sessions": {
            "Default": {
                "ServerURL": "https://api.example.com/1.0/",
                "Credentials": {
                    "username": "session_user",
                    "password": "session_password"
                }
            }
        }
    }
}
```

The `load_comprehension` command uses the same `Source` block as the `data-clone` command, and the same `SessionManager` block. The `Destination`, `SchemaPath`, and `Sync` blocks are not used by this command.

## Section Reference

### Source

Configuration for the Meadow REST API server to push comprehension data to.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ServerURL` | string | `"https://localhost:8080/1.0/"` | Base URL of the Meadow API (must include trailing `/1.0/`) |
| `UserID` | string or false | `false` | Username for API authentication; set to `false` to skip built-in auth |
| `Password` | string or false | `false` | Password for API authentication; set to `false` to skip built-in auth |

When `UserID` and `Password` are both `false`, the command skips built-in authentication. You can still authenticate via `SessionManager` (see below).

### SessionManager

Optional session-based authentication using `pict-sessionmanager`. This is the same mechanism used by the `data-clone` command, so the same `.meadow.config.json` file can drive both operations against the same server.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `Sessions` | object | `{}` | Map of session name to session configuration |

Each session is an object with:

| Property | Type | Description |
|----------|------|-------------|
| `ServerURL` | string | The server URL for this session |
| `Credentials` | object | Credential key-value pairs to pass to the authenticator |

When `SessionManager.Sessions` is empty or omitted, session-based authentication is skipped.

#### Authentication Order

The command authenticates in this order:

1. **SessionManager** -- If `SessionManager.Sessions` is configured, each session is authenticated first. The SessionManager is connected to the REST client so credentials are auto-injected into all subsequent requests.
2. **Built-in credentials** -- If `Source.UserID` and `Source.Password` are set, the command authenticates with the API using the standard `Authenticate` endpoint.
3. **No authentication** -- If neither is configured, requests are made unauthenticated.

Both mechanisms can be used together. SessionManager handles token/cookie injection while built-in auth provides a direct login.

## CLI Flag Overrides

All configuration values can be overridden via CLI flags. CLI flags take precedence over values from `.meadow.config.json`.

### Source (API) Flags

| Flag | Long Form | Description |
|------|-----------|-------------|
| `-a` | `--api_server` | API server URL (maps to `Source.ServerURL`) |
| `-u` | `--api_username` | API username (maps to `Source.UserID`) |
| `-w` | `--api_password` | API password (maps to `Source.Password`) |

### GUID Flags

| Flag | Long Form | Default | Description |
|------|-----------|---------|-------------|
| `-p` | `--prefix` | `"INTG-DEF"` | Adapter-set GUID marshal prefix. Applied to all entities. |
| `-e` | `--entityguidprefix` | Auto-generated | Per-entity GUID marshal prefix. Overrides the auto-generated prefix for all entities. |
| | `--allowguidtruncation` | `false` | Allow automatic prefix truncation when a generated GUID exceeds the server's column size. Without this flag, oversized GUIDs cause an error. |

The generated Meadow GUID follows this pattern:

```
{prefix}-{entityguidprefix}-{ExternalGUID}
```

For example, with `--prefix "MYAPP"` and entity `Book` with a comprehension GUID of `Book_1`:

```
MYAPP-E-Book-Book_1
```

When `--entityguidprefix` is not specified, the auto-generated prefix is the capital letters of the entity name (e.g. `Book` -> `B`, `BookAuthorJoin` -> `BAJ`).

### Batch and Performance Flags

| Flag | Long Form | Default | Description |
|------|-----------|---------|-------------|
| | `--bulkupsert` | `"true"` | Enable bulk upsert mode. Set to `"false"` to force single-record upserts. |
| | `--batchsize` | `100` | Number of records per bulk upsert batch. |
| | `--progressinterval` | `100` | How often (in records) to log per-entity progress. |
| | `--metaprogressinterval` | `0` | How often (in records) to log cross-entity meta progress. `0` disables meta progress logging. |

### Other Flags

| Flag | Long Form | Default | Description |
|------|-----------|---------|-------------|
| | `--logfile` | None | Path to write log output to a file. |

## Complete Working Examples

### Example 1: Minimal -- Push with CLI Credentials

No config file needed. Everything on the command line:

```bash
mdwint load_comprehension ./my-data.json \
  --api_server "https://api.example.com/1.0/" \
  --api_username "admin" \
  --api_password "admin_password" \
  --prefix "MYAPP"
```

### Example 2: Config File with Built-in Authentication

`.meadow.config.json`:

```json
{
    "Source": {
        "ServerURL": "https://api.example.com/1.0/",
        "UserID": "integration_user",
        "Password": "integration_password"
    }
}
```

Run:

```bash
mdwint load_comprehension ./entities.json
```

### Example 3: Config File with SessionManager (Same as Clone)

This is the key use case: the same `.meadow.config.json` used for `data-clone` also works for `load_comprehension`, so you can clone data from a server and push comprehensions to the same server using the same credentials.

`.meadow.config.json`:

```json
{
    "Source": {
        "ServerURL": "https://api.example.com/1.0/",
        "UserID": "admin",
        "Password": "admin_password"
    },
    "SessionManager": {
        "Sessions": {
            "Default": {
                "ServerURL": "https://api.example.com/1.0/",
                "Credentials": {
                    "username": "admin",
                    "password": "admin_password"
                }
            }
        }
    },
    "Destination": {
        "Provider": "MySQL",
        "MySQL": {
            "server": "127.0.0.1",
            "database": "meadow_clone"
        }
    },
    "SchemaPath": "./schema/Model-Extended.json"
}
```

Clone data, then push a comprehension -- both use the same config:

```bash
mdwint data-clone
mdwint load_comprehension ./new-records.json --prefix "IMPORT-2026"
```

### Example 4: Large Import with Progress Tracking

```bash
mdwint load_comprehension ./large-dataset.json \
  --api_server "https://api.example.com/1.0/" \
  --api_username "admin" \
  --api_password "admin_password" \
  --prefix "BULK" \
  --batchsize 200 \
  --metaprogressinterval 500 \
  --progressinterval 50
```

This logs per-entity progress every 50 records and overall progress every 500 records.

### Example 5: Allow GUID Truncation for One-Time Import

When the generated GUID (prefix + external GUID) exceeds the server's GUID column size, the command errors by default. For one-time imports where GUID stability is not critical, you can allow automatic prefix truncation:

```bash
mdwint load_comprehension ./legacy-import.json \
  --api_server "https://api.example.com/1.0/" \
  --api_username "admin" \
  --api_password "admin_password" \
  --prefix "LEGACY-IMPORT-2026" \
  --allowguidtruncation
```

The adapter truncates the prefix to fit the column size while preserving the full external GUID.

### Example 6: Single-Record Upserts (Disable Bulk)

For debugging or when the server does not support bulk upserts:

```bash
mdwint load_comprehension ./debug-data.json \
  --api_server "https://localhost:8080/1.0/" \
  --bulkupsert false
```

## Comprehension File Format

The comprehension file is a JSON object where top-level keys are entity names and values are objects keyed by GUID containing record data:

```json
{
    "Book": {
        "Book_1": {
            "GUIDBook": "Book_1",
            "Title": "The Hunger Games",
            "Language": "eng"
        },
        "Book_2": {
            "GUIDBook": "Book_2",
            "Title": "Harry Potter",
            "Language": "eng"
        }
    },
    "Author": {
        "Author_SC": {
            "GUIDAuthor": "Author_SC",
            "Name": "Suzanne Collins"
        }
    }
}
```

Entities are processed in the order they appear in the file. Entities referenced by other entities (via foreign key GUIDs) should appear first so their Meadow IDs are available for cross-entity lookups.

### Cross-Entity GUID Resolution

Source records can reference other entities using GUID fields. The adapter resolves these to Meadow IDs during marshaling:

- **`GUIDEntityName`** -- External system GUID. The adapter looks up the corresponding Meadow ID from the session's local GUID map (populated when that entity was pushed earlier in the same session).
- **`_GUIDEntityName`** -- Meadow GUID (underscore prefix). The adapter performs an async server API lookup (`GET /Entity/By/GUIDEntity/{GUID}`) to resolve the Meadow ID. Use this for records that reference entities already on the server but not pushed in the current session.

For example, a BookAuthorJoin record referencing an existing Author already on the server:

```json
{
    "BookAuthorJoin": {
        "BAJ_1": {
            "GUIDBookAuthorJoin": "BAJ_1",
            "GUIDBook": "Book_1",
            "_GUIDAuthor": "Author_SC"
        }
    }
}
```

Here `GUIDBook` is resolved from the session map (Book was pushed earlier), while `_GUIDAuthor` triggers a server lookup.

## Using the Explanation Command

The CLI includes a built-in command to display the resolved configuration:

```bash
mdwint config
```

This shows the merged result of default values, configuration file values, and CLI overrides, helping you verify what settings will be used before running a push.
