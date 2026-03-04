# Meadow Integration REST API Overview

The Meadow Integration REST API server provides HTTP endpoints for data transformation, comprehension operations, and entity generation. It is built on the Orator/Restify service stack.

## Starting the Server

### Via the CLI

```bash
# Start on the default port (8086)
mdwint serve

# Start on a custom port
mdwint serve --port 9000
```

### Via Environment Variable

```bash
MEADOW_INTEGRATION_PORT=9000 mdwint serve
```

### Programmatically

```javascript
const MeadowIntegrationServer = require('meadow-integration').IntegrationServer;

const server = new MeadowIntegrationServer({ APIServerPort: 8086 });

server.start((pError) =>
{
    if (pError)
    {
        console.error('Failed to start server:', pError);
    }
    else
    {
        console.log('Server is running.');
    }
});
```

## Base URL

All endpoints are versioned under `/1.0/`. When the server runs on the default port, the base URL is:

```
http://localhost:8086/1.0/
```

## Content-Type

- **Requests**: All POST endpoints expect `Content-Type: application/json`.
- **Responses**: All endpoints return `application/json` unless otherwise noted (the `ToCSV` endpoints return `text/csv`).

## Available Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/1.0/Status` | Server status and endpoint list |
| POST | `/1.0/CSV/Check` | Analyze a CSV file for statistics |
| POST | `/1.0/CSV/Transform` | Transform a CSV file into a comprehension |
| POST | `/1.0/TSV/Check` | Analyze a TSV file for statistics |
| POST | `/1.0/TSV/Transform` | Transform a TSV file into a comprehension |
| POST | `/1.0/JSONArray/Transform` | Transform a JSON array file into a comprehension |
| POST | `/1.0/JSONArray/TransformRecords` | Transform an in-memory JSON array into a comprehension |
| POST | `/1.0/Comprehension/Intersect` | Merge two comprehension objects (in-memory) |
| POST | `/1.0/Comprehension/IntersectFiles` | Merge two comprehension files |
| POST | `/1.0/Comprehension/ToArray` | Convert a comprehension to an array (in-memory) |
| POST | `/1.0/Comprehension/ToArrayFromFile` | Convert a comprehension file to an array |
| POST | `/1.0/Comprehension/ToCSV` | Convert a comprehension or array to CSV (in-memory) |
| POST | `/1.0/Comprehension/ToCSVFromFile` | Convert a comprehension or array file to CSV |
| POST | `/1.0/Comprehension/Push` | Push a comprehension to Meadow REST APIs (in-memory) |
| POST | `/1.0/Comprehension/PushFile` | Push a comprehension file to Meadow REST APIs |
| POST | `/1.0/Entity/FromTabularFolder` | Generate comprehensions from a folder of tabular files |

## Status Endpoint

A quick way to verify the server is running:

```bash
curl http://localhost:8086/1.0/Status
```

See `status.md` for full details.

## Error Handling

All endpoints return structured error responses with an `Error` property:

```json
{
    "Error": "No valid File path provided in request body."
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing or invalid parameters) |
| 404 | File or resource not found |
| 500 | Internal server error |

## File Paths

Endpoints that accept file paths (the `File` or `Folder` properties) expect absolute paths on the server filesystem. Relative paths are resolved from the server's working directory.

## Detailed Documentation

Each endpoint group has its own documentation file:

- [Status](status.md)
- [CSV Operations](csv.md)
- [TSV Operations](tsv.md)
- [JSON Array Operations](json-array.md)
- [Comprehension Operations](comprehension.md)
- [Comprehension Push](comprehension-push.md)
- [Entity Generation](entity-generation.md)
