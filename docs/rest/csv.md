# CSV Endpoints

## POST /1.0/CSV/Check

Analyze a CSV file and return statistics about its structure and content.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Absolute path to the CSV file to analyze |
| `Records` | boolean | No | `false` | When `true`, include all parsed records in the response |
| `QuoteDelimiter` | string | No | `"` | Character used for quoting fields |

### Response

A statistics object containing row count, column count, column names, and optionally the full parsed records.

```json
{
    "File": "/data/books.csv",
    "RowCount": 42,
    "ColumnCount": 5,
    "Columns": ["id", "title", "author", "year", "genre"],
    "Records": []
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `File` path provided |
| 404 | File does not exist |
| 500 | Error reading the CSV file |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/CSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books.csv"
  }'
```

With records included:

```bash
curl -s -X POST http://localhost:8086/1.0/CSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books.csv",
    "Records": true
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books.csv',
    Records: false
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/CSV/Check',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const stats = JSON.parse(data);
        console.log(`Rows: ${stats.RowCount}, Columns: ${stats.ColumnCount}`);
        console.log('Column names:', stats.Columns);
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/CSV/Transform

Transform a CSV file into a comprehension object. A comprehension is a GUID-keyed hash of entity records used throughout the Meadow ecosystem for data integration.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Absolute path to the CSV file to transform |
| `Entity` | string | No | Derived from filename | Entity name for the comprehension |
| `GUIDName` | string | No | `GUID{Entity}` | Name of the GUID column in the output |
| `GUIDTemplate` | string | No | Auto-generated | Pict template expression for generating GUIDs (e.g. `{~D:Record.id~}`) |
| `Mappings` | object | No | - | Column-level mapping overrides (`{ "OutputCol": "{~D:Record.input_col~}" }`) |
| `MappingConfiguration` | object | No | - | Full explicit mapping configuration object |
| `IncomingComprehension` | object | No | `{}` | Existing comprehension to merge new records into |
| `Extended` | boolean | No | `false` | When `true`, return the full mapping outcome state instead of just the comprehension |
| `QuoteDelimiter` | string | No | `"` | Character used for quoting fields |

### Response

By default, returns the comprehension object:

```json
{
    "Book": {
        "0x42": {
            "GUIDBook": "0x42",
            "id": "1",
            "title": "The Great Gatsby",
            "author": "F. Scott Fitzgerald"
        }
    }
}
```

When `Extended` is `true`, the response includes the full mapping outcome with `Comprehension`, `Configuration`, `ImplicitConfiguration`, `UserConfiguration`, `ParsedRowCount`, and more.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `File` path provided |
| 404 | File does not exist |
| 500 | Error reading the CSV file |

### curl Example

Basic transform:

```bash
curl -s -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books.csv"
  }'
```

With custom entity name and GUID template:

```bash
curl -s -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books.csv",
    "Entity": "Book",
    "GUIDTemplate": "{~D:Record.id~}",
    "Extended": true
  }'
```

With column mappings:

```bash
curl -s -X POST http://localhost:8086/1.0/CSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books.csv",
    "Entity": "Book",
    "Mappings": {
      "BookTitle": "{~D:Record.title~}",
      "AuthorName": "{~D:Record.author~}"
    }
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books.csv',
    Entity: 'Book',
    GUIDTemplate: '{~D:Record.id~}'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/CSV/Transform',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const comprehension = JSON.parse(data);
        const entityKeys = Object.keys(comprehension);
        console.log('Entities:', entityKeys);
        entityKeys.forEach((entity) => {
            const recordCount = Object.keys(comprehension[entity]).length;
            console.log(`  ${entity}: ${recordCount} records`);
        });
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

### Extended Response Example

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books.csv',
    Entity: 'Book',
    Extended: true
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/CSV/Transform',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const outcome = JSON.parse(data);
        console.log('Parsed rows:', outcome.ParsedRowCount);
        console.log('Configuration:', JSON.stringify(outcome.Configuration, null, 2));
        console.log('Comprehension keys:', Object.keys(outcome.Comprehension));
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```
