# sv2-translator-proxy

Standalone API to deploy and manage the [SRI Sv2 Translator Proxy](https://hub.docker.com/r/stratumv2/translator_sv2) (`stratumv2/translator_sv2`) Docker container.

This is a self-contained PoC that demonstrates how the Sv2 Translator Proxy can be integrated into [MiningOS](https://mos.tether.io/) as a controllable service. It runs independently — no MiningOS framework dependencies required.

## Prerequisites

- **Node.js >= 18**
- **Docker** (daemon must be running)

## Quick Start

```bash
cd sv2-translator-proxy
npm install
npm start
```

That's it. The API is now running on `http://localhost:3000`.

## API

All endpoints are under `/api/tproxy`.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tproxy/config` | — | Get current configuration (defaults + saved overrides) |
| `PUT` | `/api/tproxy/config` | `{ "config": { ... } }` | Update configuration (partial deep merge) |
| `POST` | `/api/tproxy/start` | optional `{ "config": { ... } }` | Pull image, generate TOML, create and start container |
| `POST` | `/api/tproxy/stop` | — | Stop the running container |
| `GET` | `/api/tproxy/status` | — | Container state, ports, image, timestamps, config |
| `GET` | `/api/tproxy/logs` | — | Container logs (`?tail=N&since=UNIX_TS`) |

### Get current configuration

```bash
curl http://localhost:3000/api/tproxy/config
```

Returns the full configuration (saved overrides merged with defaults). Every parameter exposed by the `translator_sv2` TOML config is available here.

### Update configuration

```bash
curl -X PUT http://localhost:3000/api/tproxy/config \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "translator": {
        "userIdentity": "my_farm",
        "upstreams": [{
          "address": "75.119.150.111",
          "port": 43333,
          "authorityPubkey": "9auqWEzQDVyd2oe1JVGFLMLHZtCo2FFqZwtKA5gd9xbuEu7PH72"
        }]
      }
    }
  }'
```

Only include the fields you want to change — everything else keeps its default value.

### Start the container

```bash
curl -X POST http://localhost:3000/api/tproxy/start
```

This will:
1. Pull `stratumv2/translator_sv2:main` (if not already present)
2. Generate the TOML config from your parameters
3. Create and start the container

You can also pass a one-shot config override in the body:

```bash
curl -X POST http://localhost:3000/api/tproxy/start \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "deployment": { "pullPolicy": "always" },
      "translator": { "userIdentity": "demo" }
    }
  }'
```

### Stop the container

```bash
curl -X POST http://localhost:3000/api/tproxy/stop
```

### Check container status

```bash
curl http://localhost:3000/api/tproxy/status
```

### View container logs

```bash
curl "http://localhost:3000/api/tproxy/logs?tail=50"
```

## Configuration Reference

The configuration has two sections:

### `deployment` — Docker settings

| Parameter | Default | Description |
|---|---|---|
| `image` | `stratumv2/translator_sv2` | Docker image name |
| `imageTag` | `main` | Image tag |
| `containerName` | `tproxy_sv2` | Container name |
| `restartPolicy` | `unless-stopped` | Docker restart policy |
| `hostDownstreamPort` | `34255` | Host port for SV1 miners |
| `hostMonitoringPort` | `9092` | Host port for monitoring/metrics |
| `pullPolicy` | `ifNotPresent` | `ifNotPresent`, `always`, or `never` |

### `translator` — Translator Proxy settings

These map directly to the `translator_sv2` [TOML configuration](../translator_sv2/README.md).

| Parameter | Default | Description |
|---|---|---|
| `downstreamAddress` | `0.0.0.0` | Listen address for SV1 miners |
| `downstreamPort` | `34255` | Listen port for SV1 miners |
| `maxSupportedVersion` | `2` | Max SV2 protocol version |
| `minSupportedVersion` | `2` | Min SV2 protocol version |
| `downstreamExtranonce2Size` | `4` | Extranonce2 size (min 2, CGminer max 8) |
| `userIdentity` | `plebhash` | Pool username (auto-suffixed per miner) |
| `aggregateChannels` | `true` | `true`: shared channel, `false`: individual |
| `supportedExtensions` | `[]` | Protocol extensions to request |
| `requiredExtensions` | `[]` | Protocol extensions required |
| `monitoringAddress` | `0.0.0.0:9092` | Monitoring HTTP server bind address |

#### `translator.downstreamDifficultyConfig`

| Parameter | Default | Description |
|---|---|---|
| `minIndividualMinerHashrate` | `100000` | Weakest miner hashrate in H/s (100 kH/s) |
| `sharesPerMinute` | `6.0` | Target shares per minute |
| `enableVardiff` | `true` | Variable difficulty (`false` when using JDC) |
| `jobKeepaliveIntervalSecs` | `60` | Keepalive job interval (0 to disable) |

#### `translator.upstreams[]`

| Parameter | Default | Description |
|---|---|---|
| `address` | `75.119.150.111` | Upstream SV2 server address (SRI Pool primary, Braiins Pool fallback) |
| `port` | `3333` | Upstream SV2 server port |
| `authorityPubkey` | *(per pool)* | Upstream authority public key |

## Architecture

```
┌─────────────┐      ┌────────────────────────┐      ┌──────────────────────┐
│  MiningOS    │ HTTP │  sv2-translator-proxy  │Docker│  translator_sv2      │
│  WebGUI      │─────▶│  (this API)            │─────▶│  container           │
│  (future)    │      │  :3000                 │      │  :34255 (SV1)        │
└─────────────┘      └────────────────────────┘      │  :9092  (monitoring)  │
                                                     └──────────────────────┘
```

The API generates a TOML config from the user-provided parameters, mounts it into the `stratumv2/translator_sv2` Docker container, and manages its lifecycle. The container image is pulled directly from [Docker Hub](https://hub.docker.com/r/stratumv2/translator_sv2).

## MiningOS Integration

This PoC is designed to be embedded into MiningOS as-is. The Fastify routes can be mounted under `miningos-app-node`'s existing server, and the `TranslatorSv2Service` class has no framework dependencies.
