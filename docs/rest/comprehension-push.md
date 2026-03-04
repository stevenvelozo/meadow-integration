# Comprehension Push Endpoints

These endpoints push comprehension data to Meadow REST API servers using the Integration Adapter. Each entity in the comprehension is pushed via create/upsert operations against the target API.

---

## POST /1.0/Comprehension/Push

Push an in-memory comprehension object to Meadow REST APIs.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `Comprehension` | object | Yes | - | The comprehension object to push |
| `ServerURL` | string | No | Configured default | Target Meadow API server base URL (e.g. `http://localhost:8080/1.0/`) |
| `GUIDPrefix` | string | No | - | GUID prefix applied across the entire adapter set |
| `EntityGUIDPrefix` | string | No | - | GUID prefix applied per entity |

### Response

```json
{
    "Success": true,
    "EntitiesPushed": ["Book", "Author"],
    "Message": "Pushed comprehension for 2 entity(ies)."
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `Comprehension` object provided |
| 500 | Error during the push operation |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/Push \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "B001": { "GUIDBook": "B001", "Title": "Dune", "Author": "Frank Herbert" },
        "B002": { "GUIDBook": "B002", "Title": "Neuromancer", "Author": "William Gibson" }
      }
    },
    "ServerURL": "http://localhost:8080/1.0/"
  }'
```

With GUID prefix:

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/Push \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "B001": { "GUIDBook": "B001", "Title": "Dune" }
      }
    },
    "ServerURL": "http://localhost:8080/1.0/",
    "GUIDPrefix": "INTG-",
    "EntityGUIDPrefix": "BK-"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Comprehension: {
        Book: {
            'B001': { GUIDBook: 'B001', Title: 'Dune', Author: 'Frank Herbert' },
            'B002': { GUIDBook: 'B002', Title: 'Neuromancer', Author: 'William Gibson' }
        }
    },
    ServerURL: 'http://localhost:8080/1.0/'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/Push',
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
        const result = JSON.parse(data);
        if (result.Success) {
            console.log('Push successful!');
            console.log('Entities pushed:', result.EntitiesPushed.join(', '));
        } else {
            console.error('Push failed:', result.Error);
        }
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/PushFile

Push a comprehension stored in a JSON file to Meadow REST APIs.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Path to a comprehension JSON file |
| `ServerURL` | string | No | Configured default | Target Meadow API server base URL |
| `GUIDPrefix` | string | No | - | GUID prefix applied across the entire adapter set |
| `EntityGUIDPrefix` | string | No | - | GUID prefix applied per entity |

### Response

```json
{
    "Success": true,
    "EntitiesPushed": ["Book"],
    "Message": "Pushed comprehension for 1 entity(ies)."
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `File` or file is not valid JSON |
| 404 | File does not exist |
| 500 | Error during the push operation |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/PushFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books_comprehension.json",
    "ServerURL": "http://localhost:8080/1.0/"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books_comprehension.json',
    ServerURL: 'http://localhost:8080/1.0/'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/PushFile',
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
        const result = JSON.parse(data);
        if (result.Success) {
            console.log('Push successful!');
            console.log('Entities pushed:', result.EntitiesPushed.join(', '));
            console.log(result.Message);
        } else {
            console.error('Push failed:', result.Error);
        }
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## How the Push Works

The push operation uses the Meadow Integration Adapter to send records to a target Meadow REST API server:

1. Each top-level key in the comprehension is treated as an entity name.
2. An Integration Adapter is created for each entity.
3. All records under that entity are added as source records.
4. The adapter calls `integrateRecords`, which issues create or upsert calls to the target server.

The GUID prefix is derived automatically from the capital letters of the entity name (e.g. `BookAuthor` becomes `BA`), but you can override it with `GUIDPrefix` and `EntityGUIDPrefix`.
