# Comprehension Endpoints

These endpoints operate on comprehension objects -- GUID-keyed hashes of entity records. They provide intersection (merging), conversion to arrays, and conversion to CSV.

---

## POST /1.0/Comprehension/Intersect

Merge two in-memory comprehension objects together. Records from the secondary comprehension are merged into the primary. When both comprehensions contain the same GUID, the secondary record's properties are merged onto the primary record using `Object.assign`.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PrimaryComprehension` | object | Yes | - | The primary comprehension object |
| `SecondaryComprehension` | object | Yes | - | The secondary comprehension to merge in |
| `Entity` | string | No | Auto-inferred from first key | Entity name to intersect on |

### Response

Returns the merged comprehension object.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `PrimaryComprehension` or `SecondaryComprehension`, or no entity could be inferred |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/Intersect \
  -H "Content-Type: application/json" \
  -d '{
    "PrimaryComprehension": {
      "Book": {
        "B001": { "GUIDBook": "B001", "title": "Dune" },
        "B002": { "GUIDBook": "B002", "title": "Neuromancer" }
      }
    },
    "SecondaryComprehension": {
      "Book": {
        "B001": { "GUIDBook": "B001", "author": "Frank Herbert" },
        "B003": { "GUIDBook": "B003", "title": "Snow Crash", "author": "Neal Stephenson" }
      }
    },
    "Entity": "Book"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    PrimaryComprehension: {
        Book: {
            'B001': { GUIDBook: 'B001', title: 'Dune' },
            'B002': { GUIDBook: 'B002', title: 'Neuromancer' }
        }
    },
    SecondaryComprehension: {
        Book: {
            'B001': { GUIDBook: 'B001', author: 'Frank Herbert' },
            'B003': { GUIDBook: 'B003', title: 'Snow Crash', author: 'Neal Stephenson' }
        }
    },
    Entity: 'Book'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/Intersect',
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
        const merged = JSON.parse(data);
        console.log('Merged Books:', Object.keys(merged.Book).length);
        // B001 now has both title and author
        console.log('B001:', merged.Book['B001']);
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/IntersectFiles

Merge two comprehension files together. Identical behavior to `/Intersect` but reads comprehensions from JSON files on disk.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Path to the primary comprehension JSON file |
| `IntersectFile` | string | Yes | - | Path to the secondary comprehension JSON file |
| `Entity` | string | No | Auto-inferred | Entity name to intersect on |

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `File` or `IntersectFile`, or files are not valid JSON |
| 404 | Primary or secondary file does not exist |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/IntersectFiles \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books_primary.json",
    "IntersectFile": "/data/books_secondary.json",
    "Entity": "Book"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books_primary.json',
    IntersectFile: '/data/books_secondary.json',
    Entity: 'Book'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/IntersectFiles',
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
        const merged = JSON.parse(data);
        console.log('Merged comprehension:', JSON.stringify(merged, null, 2));
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/ToArray

Convert a GUID-keyed comprehension object into a flat array of records. This is useful when you need to iterate over records without dealing with GUID keys.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `Comprehension` | object | Yes | - | The comprehension object to convert |
| `Entity` | string | No | Auto-inferred from first key | Entity name to extract records from |

### Response

Returns a JSON array of record objects:

```json
[
    { "GUIDBook": "B001", "title": "Dune", "author": "Frank Herbert" },
    { "GUIDBook": "B002", "title": "Neuromancer", "author": "William Gibson" }
]
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `Comprehension`, or no entity could be inferred |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToArray \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Book": {
        "B001": { "GUIDBook": "B001", "title": "Dune" },
        "B002": { "GUIDBook": "B002", "title": "Neuromancer" }
      }
    },
    "Entity": "Book"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Comprehension: {
        Book: {
            'B001': { GUIDBook: 'B001', title: 'Dune', author: 'Frank Herbert' },
            'B002': { GUIDBook: 'B002', title: 'Neuromancer', author: 'William Gibson' }
        }
    },
    Entity: 'Book'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/ToArray',
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
        const records = JSON.parse(data);
        console.log(`Converted ${records.length} records to array`);
        records.forEach((rec) => {
            console.log(`  ${rec.GUIDBook}: ${rec.title}`);
        });
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/ToArrayFromFile

Convert a comprehension JSON file to an array of records.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Path to a comprehension JSON file |
| `Entity` | string | No | Auto-inferred | Entity name to extract records from |

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `File`, or file is not valid JSON |
| 404 | File does not exist |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToArrayFromFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/books_comprehension.json",
    "Entity": "Book"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/books_comprehension.json',
    Entity: 'Book'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/ToArrayFromFile',
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
        const records = JSON.parse(data);
        console.log(`${records.length} records loaded from file`);
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/ToCSV

Convert a comprehension or an array of records to CSV format. Nested objects are flattened using dot-notation keys. The response Content-Type is `text/csv`.

### Request Body

You can provide data in one of two forms:

**Option A -- Records array:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Records` | array | Yes | Array of record objects |

**Option B -- Comprehension object:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Comprehension` | object | Yes | Comprehension object |
| `Entity` | string | No | Entity name (auto-detected if single entity) |

### Response

Returns raw CSV text with `Content-Type: text/csv`:

```
GUIDBook,author,title
B001,Frank Herbert,Dune
B002,William Gibson,Neuromancer
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `Records` or `Comprehension` provided, empty records, or multiple entities without `Entity` specified |

### curl Example

From a records array:

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToCSV \
  -H "Content-Type: application/json" \
  -d '{
    "Records": [
      { "id": 1, "name": "Alice", "role": "Engineer" },
      { "id": 2, "name": "Bob", "role": "Designer" }
    ]
  }'
```

From a comprehension:

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToCSV \
  -H "Content-Type: application/json" \
  -d '{
    "Comprehension": {
      "Employee": {
        "E1": { "id": 1, "name": "Alice" },
        "E2": { "id": 2, "name": "Bob" }
      }
    },
    "Entity": "Employee"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Records: [
        { id: 1, name: 'Alice', role: 'Engineer' },
        { id: 2, name: 'Bob', role: 'Designer' },
        { id: 3, name: 'Carol', role: 'Manager' }
    ]
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/ToCSV',
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
        // Response is raw CSV text
        console.log('CSV output:');
        console.log(data);
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

---

## POST /1.0/Comprehension/ToCSVFromFile

Convert a JSON file (containing either a comprehension or an array) to CSV format.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Path to a JSON file (array or comprehension) |
| `Entity` | string | No | Auto-detected | Entity name (required if comprehension has multiple entities) |

### Response

Returns raw CSV text with `Content-Type: text/csv`.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `File`, file is not valid JSON, or no records found |
| 404 | File does not exist |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToCSVFromFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/employees.json",
    "Entity": "Employee"
  }'
```

Save the CSV output to a file:

```bash
curl -s -X POST http://localhost:8086/1.0/Comprehension/ToCSVFromFile \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/employees.json"
  }' > /data/employees.csv
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');
const fs = require('fs');

const requestBody = JSON.stringify({
    File: '/data/employees.json',
    Entity: 'Employee'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Comprehension/ToCSVFromFile',
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
        // Write CSV to file
        fs.writeFileSync('/data/employees.csv', data);
        console.log('CSV written to /data/employees.csv');
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```
