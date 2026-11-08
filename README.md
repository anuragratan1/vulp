# VULP — Visual Workflow Automation Platform

> High-performance, self-hostable, visual workflow automation platform designed for modern teams, SaaS platforms, and developers.

![VULP Platform Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Tests](https://img.shields.io/badge/tests-213%20passed-success)
![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-blue)
![License](https://img.shields.io/badge/license-Commercial%20%2F%20Proprietary-blue)

---

## Overview

**VULP** is a modern visual workflow automation platform combining an intuitive drag-and-drop canvas with an isomorphic, high-throughput execution engine. Connect webhooks, schedules, Google Forms, spreadsheets, email, Telegram, Slack, and REST APIs without writing brittle glue code.

### Key Capabilities

- **Infinite Visual Workflow Canvas:** Build DAG-based automations with multi-directional handles, real-time edge flow indicators, and undo/redo history.
- **Intelligent Field Auto-Mapping:** Automatically match upstream trigger outputs and spreadsheet columns using semantic matching, aliases, and type compatibility.
- **Native Google Forms Trigger:** Zero-code Google Form integration that automatically polls for responses, discovers question schemas dynamically, and maps form answers to downstream nodes.
- **Everyday Integrations:**
  - **Google Workspace:** Gmail (HTML & attachments), Google Sheets (Read/Append/Update rows), Google Drive (Upload/Search files), Google Calendar (Event creation).
  - **Messaging:** Telegram Bot API (Markdown/HTML, chat delivery verification), Slack Incoming Webhooks.
  - **Developer Tools:** GitHub Issues, Custom HTTP Request node (cURL preview, headers, query params, auth).
  - **Logic & Flow Control:** If/Else conditional branching, Logic Delay with cancellation support, Multi-port Merge.
- **Enterprise Credential Vault:** AES-256-GCM hardware-grade secret encryption with master key management and zero-leak guarantees (secrets are automatically redacted from logs and frontend API responses).
- **VS Code-Style Integrated Execution Panel:** Docked, resizable terminal-like logs panel with live Server-Sent Events (SSE) streaming, per-node outputs, and one-click execution cancellation.
- **Complete Workspace & Multi-User Isolation:** Switch between workspaces, manage user identities, and isolate sensitive credentials.

---

## Monorepo Architecture

VULP is organized as a clean npm workspace monorepo:

```text
├── apps/
│   ├── web/               # React 18 + Vite + Tailwind CSS + ReactFlow Studio
│   └── server/            # Fastify + SQLite (WAL mode) + Drizzle ORM backend
├── packages/
│   └── engine/            # Isomorphic graph execution engine, retry policies, expressions
├── data/                  # SQLite database and master encryption keys (persistent)
├── Dockerfile             # Multi-stage production container build
└── docker-compose.yml     # Turnkey production deployment configuration
```

### Execution Engine Highlights

- **DAG Subgraph Computation:** Determines reachable execution paths from any trigger and executes topologically sorted nodes.
- **Expression Evaluation:** Supports unified variable syntax (`{{ trigger.leadId }}`, `{{ $node.trigger.output.email }}`) with deep object traversal.
- **Fault-Tolerant Execution:** Configurable retry policies (exponential backoff with jitter), abortable sleeps, node error handling (`stop` vs `continue`), and live event streaming.

---

## Quickstart (Local Development)

### Prerequisites

- **Node.js:** `>= 22.0.0`
- **npm:** `>= 10.0.0`

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/vulp.git
cd vulp
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` to configure your server port, CORS origins, and optional Google OAuth credentials.

### 3. Start Development Servers

```bash
# Starts backend server (port 4000) and frontend Vite dev server (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Production Deployment

### Option A: Docker Deployment (Recommended)

VULP includes a multi-stage `Dockerfile` and `docker-compose.yml` for single-command production deployment:

```bash
# 1. Prepare environment variables
cp .env.example .env

# 2. Build and launch container in detached mode
docker compose up -d --build

# 3. Verify container health
docker compose ps
```

The application will be live at `http://localhost:4000`, serving both the API and the pre-built React frontend with automatic health check monitoring.

### Option B: Bare-Metal / Node.js Process

```bash
# 1. Build all packages
npm run build

# 2. Start the production server
npm start
```

Use a process manager like `pm2` or `systemd` to keep the server running in production:

```bash
pm2 start apps/server/dist/index.js --name "vulp-studio"
```

---

## Reverse Proxy Configuration (Nginx / Caddy)

### Nginx Example

```nginx
server {
    listen 80;
    server_name automation.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name automation.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/automation.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/automation.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        # WebSocket & Server-Sent Events (SSE) support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for live execution logs
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

---

## Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | string | `development` | Runtime environment (`production`, `development`, `test`) |
| `PORT` | number | `4000` | Port for the HTTP/API server |
| `HOST` | string | `0.0.0.0` | Host interface to bind to |
| `DB_DIR` | path | `./data` | Directory where SQLite database and master key are stored |
| `WF_MASTER_KEY` | hex string | `auto-generated` | 32-byte AES-256 master encryption key for the credentials vault |
| `CORS_ORIGIN` | string | `*` | Comma-separated list of allowed origins |
| `GOOGLE_CLIENT_ID` | string | `optional` | Google OAuth 2.0 Web Application Client ID |
| `GOOGLE_CLIENT_SECRET`| string | `optional` | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | URL | `optional` | OAuth callback URL (e.g. `https://yourdomain.com/api/auth/callback/google`) |
| `WEBHOOK_BASE_URL` | URL | `http://localhost:4000` | Public base URL used for incoming external webhook triggers |

---

## Security & Reliability Architecture

- **Hardware-Grade Encryption:** Sensitive data (OAuth tokens, API keys, passwords) is encrypted with AES-256-GCM. Decryption occurs only in ephemeral execution contexts.
- **Zero Secret Leakage:** Sanitization layers strip secrets from execution event streams, error logs, and REST API payloads.
- **Hardened HTTP:** Armed with `@fastify/helmet` for production security headers and `@fastify/rate-limit` for DDoS and brute-force mitigation.
- **Graceful Shutdown:** Intercepts `SIGINT` and `SIGTERM` to safely stop recurring crons, finish in-flight polling loops, close database handles, and drain connections cleanly.
- **Database Durability:** Powered by SQLite with Write-Ahead Logging (`journal_mode = WAL`) and strict foreign keys (`foreign_keys = ON`).

---

## Testing & Quality Assurance

VULP includes a comprehensive automated test suite covering unit, integration, expression resolution, credential security, and end-to-end execution scenarios:

```bash
# Run all 213 tests across all workspaces
npm test

# Run execution engine tests only
npm run test:engine

# Typecheck all packages
npm run typecheck
```

---

## License

Copyright (c) VULP Platform. All rights reserved. Commercial SaaS and enterprise licensing terms apply.
