# data-clone

Clone data from a Meadow API source to a local MySQL or MSSQL database. This command connects to a Meadow REST API server, reads entity data according to an extended schema definition, and writes it into a local relational database. It supports both initial full clones and ongoing incremental synchronization.

**Aliases:** `clone`, `sync`

## Usage

```shell
mdwint data-clone [options]
```

## Options

### API Connection

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --api_server <url>` | Source Meadow API server URL | -- |
| `-u, --api_username <username>` | API authentication username | -- |
| `-p, --api_password <password>` | API authentication password | -- |

### Database Connection

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --db_provider <provider>` | Database provider: `MySQL` or `MSSQL` | `MySQL` |
| `-dh, --db_host <host>` | Database server hostname or IP address | -- |
| `-dp, --db_port <port>` | Database server port | Provider default (3306 for MySQL, 1433 for MSSQL) |
| `-du, --db_username <username>` | Database authentication username | -- |
| `-dw, --db_password <password>` | Database authentication password | -- |
| `-dn, --db_name <name>` | Target database name | -- |

### Schema and Sync

| Option | Description | Default |
|--------|-------------|---------|
| `-sp, --schema_path <path>` | Path to a Meadow extended schema JSON file defining the entities and fields to clone | -- |
| `-s, --sync_mode <mode>` | Synchronization mode: `Initial` for a full clone, `Ongoing` for incremental updates | `Initial` |
| `-w, --post_run_delay <minutes>` | Minutes to wait after a sync run completes before exiting (or re-running in ongoing mode) | `0` |

## Configuration File

Instead of passing all options on the command line, you can create a `.meadow.config.json` file in your working directory. The command reads this file automatically and merges its values with any CLI flags provided (CLI flags take precedence).

### MySQL Configuration

```json
{
  "api_server": "https://api.example.com",
  "api_username": "integration-user",
  "api_password": "secret-token",

  "db_provider": "MySQL",
  "db_host": "localhost",
  "db_port": 3306,
  "db_username": "root",
  "db_password": "mysql-password",
  "db_name": "meadow_clone",

  "schema_path": "./schema/extended-schema.json",
  "sync_mode": "Initial",
  "post_run_delay": 0
}
```

### MSSQL Configuration

```json
{
  "api_server": "https://api.example.com",
  "api_username": "integration-user",
  "api_password": "secret-token",

  "db_provider": "MSSQL",
  "db_host": "sql-server.local",
  "db_port": 1433,
  "db_username": "sa",
  "db_password": "mssql-password",
  "db_name": "MeadowClone",

  "schema_path": "./schema/extended-schema.json",
  "sync_mode": "Initial"
}
```

### With Entity List

You can scope the clone to specific entities by including an `entities` array in the configuration:

```json
{
  "api_server": "https://api.example.com",
  "api_username": "integration-user",
  "api_password": "secret-token",

  "db_provider": "MySQL",
  "db_host": "localhost",
  "db_port": 3306,
  "db_username": "root",
  "db_password": "mysql-password",
  "db_name": "meadow_clone",

  "schema_path": "./schema/extended-schema.json",
  "sync_mode": "Initial",

  "entities": ["Book", "Author", "BookAuthorJoin"]
}
```

### Ongoing Sync with Delay

For continuous synchronization, set the sync mode to `Ongoing` and configure a delay between runs:

```json
{
  "api_server": "https://api.example.com",
  "api_username": "integration-user",
  "api_password": "secret-token",

  "db_provider": "MySQL",
  "db_host": "localhost",
  "db_port": 3306,
  "db_username": "root",
  "db_password": "mysql-password",
  "db_name": "meadow_sync",

  "schema_path": "./schema/extended-schema.json",
  "sync_mode": "Ongoing",
  "post_run_delay": 15
}
```

This configuration waits 15 minutes between each sync cycle.

### Minimal Configuration

If you are using environment variables or default values for most settings, a minimal config might look like:

```json
{
  "api_server": "https://api.example.com",
  "api_username": "admin",
  "api_password": "password",

  "db_provider": "MySQL",
  "db_host": "localhost",
  "db_name": "local_clone",

  "schema_path": "./schema.json"
}
```

## Sync Modes

### Initial

Performs a full clone of all entity data from the API source. The target database tables are created (or recreated) based on the schema definition, and all records are fetched and inserted.

Use this mode when:
- Setting up a new local database for the first time
- You need a complete refresh of all data
- The schema has changed and tables need to be rebuilt

### Ongoing

Performs incremental synchronization, fetching only records that have been created or modified since the last sync. This mode is much faster than a full clone for large datasets.

Use this mode when:
- You have already performed an initial clone
- You want to keep the local database up to date with the API source
- You are running the clone as a scheduled or continuous process

## Examples

### Full clone with CLI flags

```shell
mdwint data-clone \
  -a https://api.example.com \
  -u admin \
  -p secret123 \
  -d MySQL \
  -dh localhost \
  -dp 3306 \
  -du root \
  -dw rootpass \
  -dn meadow_clone \
  -sp ./schema/extended-schema.json \
  -s Initial
```

### Clone using a config file

```shell
# With .meadow.config.json in the current directory:
mdwint data-clone
```

### Override config file values with CLI flags

```shell
# Use config file for most settings, override the sync mode
mdwint data-clone -s Ongoing -w 10
```

### Clone to MSSQL

```shell
mdwint data-clone \
  -a https://api.example.com \
  -u admin \
  -p secret123 \
  -d MSSQL \
  -dh sql-server.local \
  -dp 1433 \
  -du sa \
  -dw sapassword \
  -dn MeadowClone \
  -sp ./schema.json
```

### Ongoing sync with delay

```shell
mdwint data-clone \
  -a https://api.example.com \
  -u admin \
  -p secret123 \
  -d MySQL \
  -dh localhost \
  -dn meadow_sync \
  -sp ./schema.json \
  -s Ongoing \
  -w 15
```

This runs a sync, waits 15 minutes, then repeats.

### Using aliases

```shell
mdwint clone -a https://api.example.com -sp ./schema.json
mdwint sync -s Ongoing -w 5
```

## Schema File

The `--schema_path` option points to a Meadow extended schema JSON file. This file defines the entities and their fields that should be cloned. The schema determines:

- Which entities to fetch from the API
- What database tables and columns to create
- Field types and constraints for the local database

Refer to the Meadow [Schema](../vocabulary/Schema.md) documentation for the schema file format.

## Tips

- Always run an `Initial` sync before switching to `Ongoing` mode. The ongoing mode expects the database tables and baseline data to already exist.
- Use the `.meadow.config.json` file for settings you reuse across runs. Use CLI flags for one-off overrides (e.g., switching between Initial and Ongoing mode).
- For production deployments, avoid putting passwords directly in the config file. Use environment variables or a secrets manager.
- The `post_run_delay` option is useful for running the clone as a long-lived process that keeps data in sync. Set it to `0` for a single run that exits after completion.
- When scoping to specific entities via the `entities` array in the config file, ensure that any entity dependencies (e.g., join tables referencing parent entities) are also included.

## Notes

- The database must already exist before running the clone. The command creates tables but does not create the database itself.
- The command requires the `meadow-connection-mysql` or `meadow-connection-mssql` packages, which are included as dependencies of `meadow-integration`.
- The API server must be a Meadow server with REST endpoints for the entities defined in the schema.
- Configuration file values and CLI flags are merged, with CLI flags taking precedence.

## See Also

- [load_comprehension](load-comprehension.md) -- Push local Comprehension data to a Meadow API
- [serve](serve.md) -- Start a local Meadow Integration REST API server
- [Schema](../vocabulary/Schema.md) -- Meadow schema file format
- [Integration Adapter](../integration-adapter.md) -- Programmatic data integration
