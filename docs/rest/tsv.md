# TSV Endpoints

The TSV endpoints are functionally identical to the CSV endpoints but operate on tab-separated value files. The parser delimiter is automatically set to `\t`.

## POST /1.0/TSV/Check

Analyze a TSV file and return statistics about its structure and content.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Absolute path to the TSV file to analyze |
| `Records` | boolean | No | `false` | When `true`, include all parsed records in the response |
| `QuoteDelimiter` | string | No | `"` | Character used for quoting fields |

### Response

```json
{
    "File": "/data/products.tsv",
    "RowCount": 150,
    "ColumnCount": 4,
    "Columns": ["sku", "name", "price", "category"]
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `File` path provided |
| 404 | File does not exist |
| 500 | Error reading the TSV file |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/TSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/products.tsv"
  }'
```

With records:

```bash
curl -s -X POST http://localhost:8086/1.0/TSV/Check \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/products.tsv",
    "Records": true
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/products.tsv'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/TSV/Check',
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

## POST /1.0/TSV/Transform

Transform a TSV file into a comprehension object.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Absolute path to the TSV file to transform |
| `Entity` | string | No | Derived from filename | Entity name for the comprehension |
| `GUIDName` | string | No | `GUID{Entity}` | Name of the GUID column in the output |
| `GUIDTemplate` | string | No | Auto-generated | Pict template expression for generating GUIDs |
| `Mappings` | object | No | - | Column-level mapping overrides |
| `MappingConfiguration` | object | No | - | Full explicit mapping configuration object |
| `IncomingComprehension` | object | No | `{}` | Existing comprehension to merge new records into |
| `Extended` | boolean | No | `false` | Return full mapping outcome state |
| `QuoteDelimiter` | string | No | `"` | Character used for quoting fields |

### Response

Returns a comprehension object (same structure as CSV/Transform):

```json
{
    "Product": {
        "SKU-001": {
            "GUIDProduct": "SKU-001",
            "sku": "SKU-001",
            "name": "Widget",
            "price": "9.99",
            "category": "Hardware"
        }
    }
}
```

When `Extended` is `true`, returns the full mapping outcome.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `File` path provided |
| 404 | File does not exist |
| 500 | Error reading the TSV file |

### curl Example

Basic transform:

```bash
curl -s -X POST http://localhost:8086/1.0/TSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/products.tsv"
  }'
```

With entity name and GUID template:

```bash
curl -s -X POST http://localhost:8086/1.0/TSV/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/products.tsv",
    "Entity": "Product",
    "GUIDTemplate": "{~D:Record.sku~}"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/products.tsv',
    Entity: 'Product',
    GUIDTemplate: '{~D:Record.sku~}'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/TSV/Transform',
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

### Merging into an Existing Comprehension

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/products_update.tsv',
    Entity: 'Product',
    GUIDTemplate: '{~D:Record.sku~}',
    IncomingComprehension: {
        Product: {
            'SKU-001': { GUIDProduct: 'SKU-001', sku: 'SKU-001', name: 'Widget', price: '9.99' }
        }
    }
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/TSV/Transform',
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
        console.log('Merged record count:', Object.keys(merged.Product).length);
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```
