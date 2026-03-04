# Docker Deployment

The meadow-integration module includes Docker support for running data clone operations in containerized environments.

## Dockerfiles

### Production Dockerfile

The primary `Dockerfile` builds a production-ready image based on `node:20-bookworm`.

#### Build Stages

The Dockerfile uses a multi-stage build:

**Base stage**:
1. Starts from `node:20-bookworm`.
2. Installs system utilities: `curl`, `vim`, `nano`, `less`, `tmux`, `uuid-runtime`.
3. Installs `nodemon` globally.
4. Copies `package.json` and runs `npm install --omit=dev` (production dependencies only).
5. Copies `source/` and `scripts/` directories.
6. Cleans up development artifacts (`package-lock.json`, `.git`, `test`).
7. If a `Meadow-Config-Docker.json` file exists, it is moved to `source/cli/Default-Meadow-Integration-Configuration.json` to serve as the default configuration inside the container.

**Production stage**:
1. Extends the base stage.
2. Records the build timestamp in `build.date`.
3. Runs `scripts/run.sh` as the default command.

#### Building the Image

```bash
docker build -t retold/meadow-integration:latest .
```

Or use the provided helper script:

```bash
./Docker-Build.sh
```

#### Custom Configuration at Build Time

To bake a default configuration into the image, create a `Meadow-Config-Docker.json` file in the project root before building:

```json
{
    "Source": {
        "ServerURL": "https://api.production.example.com/1.0/",
        "UserID": "sync_service",
        "Password": "service_password"
    },
    "Destination": {
        "Provider": "MySQL",
        "MySQL": {
            "server": "mysql-host",
            "port": 3306,
            "user": "clone_user",
            "password": "clone_password",
            "database": "production_clone",
            "connectionLimit": 20
        }
    },
    "SchemaPath": "/service_root/schema/Model-Extended.json",
    "Sync": {
        "DefaultSyncMode": "Initial",
        "PageSize": 100,
        "SyncEntityList": []
    }
}
```

This file is automatically picked up during the build and used as the default configuration.

### Development Dockerfile (Dockerfile_LUXURYCode)

The `Dockerfile_LUXURYCode` builds a development image based on `codercom/code-server:latest`. It provides a browser-based VS Code environment for developing and debugging the meadow-integration module.

#### What It Includes

- **Base**: code-server (VS Code in the browser)
- **Runtime**: Node.js 20 via NVM
- **System tools**: vim, curl, tmux
- **VS Code extensions**:
  - Mocha Test Adapter
  - Test Explorer
  - Indent Rainbow
  - ESLint
  - GitLens

#### Volumes

| Volume | Purpose |
|--------|---------|
| `/home/coder/.config` | code-server configuration |
| `/home/coder/.vscode` | VS Code settings |
| `/home/coder/meadow-integration` | Project source (mount your local checkout here) |

#### Building the Development Image

```bash
docker build -f Dockerfile_LUXURYCode -t retold/meadow-integration-dev:latest .
```

#### Running the Development Image

```bash
docker run -d \
  -p 8443:8080 \
  -v "$(pwd):/home/coder/meadow-integration" \
  retold/meadow-integration-dev:latest
```

Access the development environment at `http://localhost:8443`.

## Docker Compose

The `docker-compose.yml` file defines a service for running the data clone:

```yaml
version: '2'

services:
  meadow-integration-clone:
    image: retold/meadow-integration:latest
    volumes:
      - "${RETOLD_DIR:-./}:/service_root"
    environment:
      - RUN_LOCAL_DEV=true
    networks:
      - back

networks:
  back:
    external:
      name: meadow_backend
```

### Running with Docker Compose

```bash
docker-compose up -d meadow-integration-clone
```

Or use the provided helper script:

```bash
./Docker-Compose.sh
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RETOLD_DIR` | `./` | Host directory to mount as `/service_root` |
| `RUN_LOCAL_DEV` | - | Set to `true` for local development mode |
| `MEADOW_INTEGRATION_PORT` | `8086` | Port override for the REST server (when running the `serve` command) |

### Network

The compose file expects an external Docker network named `meadow_backend`. Create it before running:

```bash
docker network create meadow_backend
```

## Volume Mounts for Configuration

### Mounting a Config File

To provide a `.meadow.config.json` at runtime without baking it into the image:

```bash
docker run \
  -v "/path/to/.meadow.config.json:/service_root/.meadow.config.json" \
  -v "/path/to/schema:/service_root/schema" \
  retold/meadow-integration:latest
```

### Mounting a Schema Directory

The schema file referenced by `SchemaPath` must be accessible inside the container. Mount it as a volume:

```bash
docker run \
  -v "/host/path/schema:/service_root/schema" \
  retold/meadow-integration:latest
```

## Production Deployment Tips

### Running an Initial Clone

```bash
docker run --rm \
  --network meadow_backend \
  -v "/config/.meadow.config.json:/service_root/.meadow.config.json" \
  -v "/data/schema:/service_root/schema" \
  retold/meadow-integration:latest \
  node source/cli/Meadow-Integration-CLI-Run.js data-clone --sync_mode Initial
```

### Running an Ongoing Sync on a Schedule

Use cron or a container orchestrator to run ongoing syncs periodically:

```bash
docker run --rm \
  --network meadow_backend \
  -v "/config/.meadow.config.json:/service_root/.meadow.config.json" \
  -v "/data/schema:/service_root/schema" \
  retold/meadow-integration:latest \
  node source/cli/Meadow-Integration-CLI-Run.js data-clone --sync_mode Ongoing
```

### Using the Post-Run Delay

The `--post_run_delay` flag keeps the container alive for a specified number of minutes after the sync completes. This is useful in orchestrated environments where you want to inspect logs before the container exits:

```bash
docker run --rm \
  --network meadow_backend \
  -v "/config/.meadow.config.json:/service_root/.meadow.config.json" \
  -v "/data/schema:/service_root/schema" \
  retold/meadow-integration:latest \
  node source/cli/Meadow-Integration-CLI-Run.js data-clone --post_run_delay 5
```

### Running the REST Server in Docker

To run the integration REST API server inside Docker:

```bash
docker run -d \
  -p 8086:8086 \
  --name meadow-integration-api \
  retold/meadow-integration:latest \
  node source/cli/Meadow-Integration-CLI-Run.js serve --port 8086
```

### Tagging and Pushing

Helper scripts are provided for image management:

```bash
# Tag the image
./Docker-Tag.sh

# Push to a registry
./Docker-Push.sh
```

### Health Checks

When running the REST server, use the Status endpoint as a health check:

```yaml
services:
  meadow-integration-api:
    image: retold/meadow-integration:latest
    command: node source/cli/Meadow-Integration-CLI-Run.js serve
    ports:
      - "8086:8086"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8086/1.0/Status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Database Connectivity

When running inside Docker, make sure the container can reach the database server. Common patterns:

- **Same Docker network**: Use the container name as the hostname (e.g., `mysql-server`).
- **Host machine**: Use `host.docker.internal` (Docker Desktop) or `172.17.0.1` (Linux).
- **External database**: Use the external hostname or IP.

Update the `Destination` configuration accordingly:

```json
{
    "Destination": {
        "Provider": "MySQL",
        "MySQL": {
            "server": "mysql-server",
            "database": "production_clone"
        }
    }
}
```
