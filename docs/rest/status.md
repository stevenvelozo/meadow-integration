# GET /1.0/Status

Returns the server status, product version, and a list of all available endpoints.

## Request

- **Method**: GET
- **Path**: `/1.0/Status`
- **Body**: None

## Response

```json
{
    "Product": "Meadow-Integration-Server",
    "Version": "1.0.5",
    "Status": "Running",
    "Endpoints": [
        "POST /1.0/CSV/Check",
        "POST /1.0/CSV/Transform",
        "POST /1.0/TSV/Check",
        "POST /1.0/TSV/Transform",
        "POST /1.0/JSONArray/Transform",
        "POST /1.0/JSONArray/TransformRecords",
        "POST /1.0/Comprehension/Intersect",
        "POST /1.0/Comprehension/IntersectFiles",
        "POST /1.0/Comprehension/ToArray",
        "POST /1.0/Comprehension/ToArrayFromFile",
        "POST /1.0/Comprehension/ToCSV",
        "POST /1.0/Comprehension/ToCSVFromFile",
        "POST /1.0/Comprehension/Push",
        "POST /1.0/Comprehension/PushFile",
        "POST /1.0/Entity/FromTabularFolder"
    ]
}
```

## curl Example

```bash
curl -s http://localhost:8086/1.0/Status
```

## JavaScript Example (dependency-free)

```javascript
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/1.0/Status',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => { console.log(JSON.parse(data)); });
});
req.on('error', (err) => { console.error('Request error:', err.message); });
req.end();
```
