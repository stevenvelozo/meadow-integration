# Entity Generation Endpoint

## POST /1.0/Entity/FromTabularFolder

Generate a combined comprehension from all tabular data files (CSV, TSV, and JSON) found in a folder. Each file becomes an entity in the output comprehension, with the entity name derived from the filename (without extension) unless overridden.

### Request Body

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `Folder` | string | Yes | - | Absolute path to a folder containing tabular files |
| `Entity` | string | No | Derived from each filename | Force all files to use the same entity name |
| `MappingConfiguration` | object | No | - | Mapping hints configuration applied to all files |

### Supported File Types

| Extension | Format |
|-----------|--------|
| `.csv` | Comma-separated values |
| `.tsv` | Tab-separated values |
| `.json` | JSON array of objects |

Files with other extensions are silently ignored.

### Response

Returns a comprehension object containing all entities generated from files in the folder:

```json
{
    "housing_costs_Neighborhoods": {
        "0x1": { "GUIDhousing_costs_Neighborhoods": "0x1", "Neighborhood": "Ballard", "MedianRent": "1450" }
    },
    "race_ethnicity_Neighborhoods": {
        "0x1": { "GUIDrace_ethnicity_Neighborhoods": "0x1", "Neighborhood": "Ballard", "White": "78.2" }
    }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No valid `Folder` path provided, path is not a directory, or no tabular files found |
| 404 | Folder does not exist |
| 500 | Error processing files |

### curl Example

Basic folder processing:

```bash
curl -s -X POST http://localhost:8086/1.0/Entity/FromTabularFolder \
  -H "Content-Type: application/json" \
  -d '{
    "Folder": "/data/seattle_neighborhoods/"
  }'
```

With a forced entity name:

```bash
curl -s -X POST http://localhost:8086/1.0/Entity/FromTabularFolder \
  -H "Content-Type: application/json" \
  -d '{
    "Folder": "/data/imports/",
    "Entity": "ImportedRecord"
  }'
```

### JavaScript Example (dependency-free)

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Folder: '/data/seattle_neighborhoods/'
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Entity/FromTabularFolder',
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
        const entities = Object.keys(comprehension);
        console.log(`Generated ${entities.length} entity(ies):`);
        entities.forEach((entity) => {
            const recordCount = Object.keys(comprehension[entity]).length;
            console.log(`  ${entity}: ${recordCount} records`);
        });
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

### With Mapping Configuration

```javascript
const http = require('http');

const requestBody = JSON.stringify({
    Folder: '/data/imports/',
    Entity: 'Product',
    MappingConfiguration: {
        GUIDTemplate: '{~D:Record.sku~}',
        Mappings: {
            ProductName: '{~D:Record.name~}',
            UnitPrice: '{~D:Record.price~}'
        }
    }
});

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Entity/FromTabularFolder',
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
        console.log('Products generated:', JSON.stringify(comprehension, null, 2));
    });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(requestBody);
req.end();
```

### How It Works

1. The endpoint reads all files in the specified folder.
2. Files are filtered to supported extensions (`.csv`, `.tsv`, `.json`).
3. Each file is processed asynchronously using the `anticipate` pattern.
4. For CSV and TSV files, a fresh parser is created per file with the appropriate delimiter.
5. For JSON files, the contents are parsed and validated as an array.
6. Entity names are derived from the filename (without extension) unless `Entity` is provided.
7. Results from all files are merged into a single comprehension object.
