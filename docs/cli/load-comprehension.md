# load_comprehension

Push a Comprehension JSON file to Meadow REST APIs via the Integration Adapter. This command automatically creates an Integration Adapter for each entity found in the Comprehension and performs upsert operations against the configured Meadow server endpoints.

**Aliases:** `load`, `push`

## Usage

```shell
mdwint load_comprehension <comprehension_file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<comprehension_file>` | Yes | Path to the Comprehension JSON file to push |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --prefix <guid_prefix>` | GUID prefix applied to the entire Comprehension push. Used to namespace records within the Integration Adapter's set management. | -- |
| `-e, --entityguidprefix <prefix>` | GUID prefix applied per entity. Useful for distinguishing records from different import batches. | -- |

## How It Works

1. The Comprehension file is loaded from disk.
2. For each entity key in the Comprehension (e.g., `Book`, `Author`, `BookAuthorJoin`), an Integration Adapter is instantiated.
3. Each Integration Adapter is configured with the entity name and optional GUID prefixes.
4. All records for each entity are added to the adapter's source record set.
5. The adapter's `integrateRecords` method is called, which marshals each record and pushes it to the Meadow REST API via upsert (create or update).

The push operation uses the `SimpleMarshal` and `ForceMarshal` modes, meaning records are pushed as-is without complex field transformation.

## Prerequisites

The Meadow server must be running and accessible. The server URL and credentials are configured through the Fable settings (typically via a `meadow-integration-config.json` or environment variables).

## Examples

### Basic push

```shell
mdwint load_comprehension ./bookstore-comprehension.json
```

Pushes all entities (Book, Author, BookAuthorJoin, etc.) found in the Comprehension to the configured Meadow API.

### Push with a GUID prefix

```shell
mdwint load_comprehension ./bookstore-comprehension.json -p "Import-2024-Q1"
```

The prefix is applied to the Integration Adapter's set GUID marshal prefix, helping to namespace this import batch.

### Push with entity GUID prefix

```shell
mdwint load_comprehension ./bookstore-comprehension.json \
  -e "BookstoreDemo"
```

### Push with both prefixes

```shell
mdwint push ./bookstore-comprehension.json \
  -p "Import-2024" \
  -e "Demo"
```

### Using the alias

```shell
mdwint push ./data/comprehension.json
mdwint load ./data/comprehension.json
```

### Full workflow: CSV to API

```shell
# 1. Transform CSV to Comprehension
mdwint csvtransform ./data/books.csv \
  -m mapping_Book.json \
  -o bookstore.json

# 2. Add Author entities
mdwint csvtransform ./data/books.csv \
  -m mapping_Author.json \
  -i bookstore.json \
  -o bookstore.json

# 3. Push to Meadow API
mdwint load_comprehension ./bookstore.json -p "BookImport-001"
```

## Console Output

The command logs progress throughout the push operation:

```
Pushing comprehension file [./bookstore.json] to the Meadow Endpoints APIs.
Initializing and configuring data integration adapters...
Loading Comprehension File...
Wiring up Integration Adapters...
Finished importing comprehension file.
```

Errors during the push (e.g., network failures, API errors) are logged with details.

## Tips

- Ensure the Meadow server is running and reachable before running this command.
- The command processes entities sequentially using an anticipation chain. Large Comprehensions with many entities will take proportionally longer.
- The GUID prefix options are useful when running multiple import batches against the same Meadow server, helping to identify and manage records from different sources.
- The entity abbreviation for the Integration Adapter is automatically derived from the capital letters of the entity name (e.g., `BookAuthorJoin` becomes `BAJ`).

## Notes

- This command requires a configured Meadow server. Without proper server configuration, the adapters will fail to connect.
- The `SimpleMarshal` mode means records are pushed with their field values as-is. No additional field transformation or validation is performed beyond what the Meadow API enforces.
- The command does not call back on completion of the server process -- it waits for all integration operations to finish before exiting.

## See Also

- [Integration Adapter](../integration-adapter.md) -- Detailed adapter configuration and behavior
- [data-clone](data-clone.md) -- Clone data from a Meadow API to a local database
- [Comprehensions](../comprehensions.md) -- Core data structure documentation
