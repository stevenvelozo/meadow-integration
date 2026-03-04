# JSON Array Endpoints

## POST /1.0/JSONArray/Transform

Transform a JSON array file into a comprehension object. The file must contain a valid JSON array of objects.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `File` | string | Yes | - | Absolute path to a JSON file containing an array of objects |
| `Entity` | string | No | Derived from filename | Entity name for the comprehension |
| `GUIDName` | string | No | `GUID{Entity}` | Name of the GUID column in the output |
| `GUIDTemplate` | string | No | Auto-generated | Pict template expression for generating GUIDs |
| `Mappings` | object | No | - | Column-level mapping overrides |
| `MappingConfiguration` | object | No | - | Full explicit mapping configuration object |
| `IncomingComprehension` | object | No | `{}` | Existing comprehension to merge new records into |
| `Extended` | boolean | No | `false` | Return full mapping outcome state |

### Response

Returns a comprehension object:

```json
{
    "Customer": {
        "CUST-100": {
            "GUIDCustomer": "CUST-100",
            "id": 100,
            "name": "Acme Corp",
            "email": "contact@acme.com"
        }
    }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `File` path provided, file is not valid JSON, or file does not contain an array |
| 404 | File does not exist |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/JSONArray/Transform \
  -H "Content-Type: application/json" \
  -d '{
    "File": "/data/customers.json",
    "Entity": "Customer",
    "GUIDTemplate": "{~D:Record.id~}"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    File: '/data/customers.json',
    Entity: 'Customer',
    GUIDTemplate: '{~D:Record.id~}'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/JSONArray/Transform',
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

---

## POST /1.0/JSONArray/TransformRecords

Transform an in-memory JSON array of records into a comprehension object. Unlike `/JSONArray/Transform`, this endpoint does not require a file on disk -- the records are passed directly in the request body.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `Records` | array | Yes | - | Array of record objects to transform |
| `Entity` | string | No | `"Records"` | Entity name for the comprehension |
| `GUIDName` | string | No | `GUID{Entity}` | Name of the GUID column in the output |
| `GUIDTemplate` | string | No | Auto-generated | Pict template expression for generating GUIDs |
| `Mappings` | object | No | - | Column-level mapping overrides |
| `MappingConfiguration` | object | No | - | Full explicit mapping configuration object |
| `IncomingComprehension` | object | No | `{}` | Existing comprehension to merge new records into |
| `Extended` | boolean | No | `false` | Return full mapping outcome state |

### Response

Returns a comprehension object:

```json
{
    "Order": {
        "ORD-001": {
            "GUIDOrder": "ORD-001",
            "order_id": "ORD-001",
            "customer": "Acme Corp",
            "total": 250.00
        }
    }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `Records` array provided or array is empty |

### curl Example

```bash
curl -s -X POST http://localhost:8086/1.0/JSONArray/TransformRecords \
  -H "Content-Type: application/json" \
  -d '{
    "Records": [
      { "order_id": "ORD-001", "customer": "Acme Corp", "total": 250.00 },
      { "order_id": "ORD-002", "customer": "Globex Inc", "total": 175.50 }
    ],
    "Entity": "Order",
    "GUIDTemplate": "{~D:Record.order_id~}"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Records: [
        { order_id: 'ORD-001', customer: 'Acme Corp', total: 250.00 },
        { order_id: 'ORD-002', customer: 'Globex Inc', total: 175.50 },
        { order_id: 'ORD-003', customer: 'Initech', total: 320.00 }
    ],
    Entity: 'Order',
    GUIDTemplate: '{~D:Record.order_id~}'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/JSONArray/TransformRecords',
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
        console.log('Order comprehension:');
        const orders = comprehension.Order;
        Object.keys(orders).forEach((guid) => {
            console.log(`  ${guid}: ${orders[guid].customer} - $${orders[guid].total}`);
        });
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

### In-Memory Pipeline Example

This example shows how to use `TransformRecords` to convert data already in memory (e.g. from an API response) into a comprehension without writing to disk:

```javascript
const http = require('http');

// Simulate records from an external API
const externalData = [
    { id: 1, name: 'Alice', department: 'Engineering' },
    { id: 2, name: 'Bob', department: 'Marketing' },
    { id: 3, name: 'Carol', department: 'Engineering' }
];

const requestBody = JSON.stringify({
    Records: externalData,
    Entity: 'Employee',
    GUIDTemplate: '{~D:Record.id~}',
    Mappings: {
        FullName: '{~D:Record.name~}',
        Dept: '{~D:Record.department~}'
    }
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/JSONArray/TransformRecords',
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
        console.log('Employee comprehension created with',
            Object.keys(comprehension.Employee).length, 'records');
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```
