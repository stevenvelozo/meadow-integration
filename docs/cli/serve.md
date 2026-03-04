# serve

Start the Meadow Integration REST API server. This provides HTTP endpoints for performing CSV checks, CSV transforms, comprehension operations, and other integration tasks programmatically over a network.

**Aliases:** `server`, `rest`

## Usage

```shell
mdwint serve [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port number for the server to listen on | `8086` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MEADOW_INTEGRATION_PORT` | Override the default port. Takes precedence over the default but is overridden by the `-p` CLI flag. |

## Port Resolution Priority

The port is resolved in the following order (highest priority first):

1. `-p` CLI flag
2. `MEADOW_INTEGRATION_PORT` environment variable
3. Default value: `8086`

## Examples

### Start on the default port

```shell
mdwint serve
```

Starts the server on port 8086.

### Start on a custom port

```shell
mdwint serve -p 3000
```

### Using an environment variable

```shell
MEADOW_INTEGRATION_PORT=9090 mdwint serve
```

### Using the alias

```shell
mdwint server -p 3000
mdwint rest -p 3000
```

### Run in the background

```shell
mdwint serve -p 8086 &
```

## Console Output

```
Starting Meadow Integration REST server on port 8086...
```

The server process stays alive after starting. It does not exit on its own -- use `Ctrl+C` or send a termination signal to stop it.

## API Endpoints

Once the server is running, the REST API endpoints are available for HTTP requests. See the [REST API Reference](../rest-api-reference.md) for full endpoint documentation.

The server exposes endpoints for the same operations available via the CLI:

- CSV check
- CSV transform
- Comprehension array conversion
- Comprehension intersection
- Object array to CSV conversion

## Tips

- The server is built on Orator (Restify). It supports standard HTTP methods and JSON request/response bodies.
- For production deployments, consider running the server behind a reverse proxy (e.g., nginx) and using process management (e.g., PM2, systemd, or Ultravisor).
- The server does not implement authentication by default. If exposing it beyond localhost, add appropriate network-level access controls.

## Notes

- The server process intentionally does not call back after starting, keeping the Node.js process alive indefinitely.
- If the server fails to start (e.g., port already in use), an error is logged and the process exits.

## See Also

- [REST API Reference](../rest-api-reference.md) -- Full endpoint documentation
- [Programmatic API](../programmatic-api.md) -- Using meadow-integration as a library
