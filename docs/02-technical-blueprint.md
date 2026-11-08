# Visual Workflow Automation Platform
## Technical Blueprint

This document is the technical source of truth for the MVP. Implementation decisions should follow it unless a genuine technical blocker requires a documented correction.

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript |
| Workflow canvas | `@xyflow/react` |
| Styling | Tailwind CSS + CSS variables |
| UI primitives | Radix UI |
| Animations | Motion |
| State management | Zustand |
| Backend | Node.js + Fastify + TypeScript |
| Database | SQLite |
| ORM | Drizzle ORM |
| Scheduling | Croner |
| Server execution | In-process sequential worker |
| Live updates | Server-Sent Events (SSE) |
| Package manager | npm workspaces |
| Server development | tsx |
| Engine tests | Vitest |
| IDs | nanoid |

Use Node.js 22 LTS.

No Redis, BullMQ, microservices, Kubernetes or unnecessary infrastructure in the MVP.

## 2. Monorepo Structure

```text
/
├── apps/
│   ├── web/                 # Vite + React frontend
│   └── server/              # Fastify backend
│
├── packages/
│   └── engine/              # Pure TypeScript workflow engine
│       └── src/
│           ├── contracts.ts
│           ├── core/
│           ├── nodes/
│           ├── registry/
│           ├── expressions/
│           ├── execution/
│           └── index.ts
│
├── docs/
│   ├── 01-project-brief.md
│   └── 02-technical-blueprint.md
│
├── package-lock.json
└── package.json
```

The engine must not import frontend, Fastify or database modules. It should be independently testable.

## 3. Architecture

### Frontend

Responsible for:
- Workflow canvas and node connections.
- Node palette and configuration panel.
- Workflow save/load and activation controls.
- Credential configuration.
- Execution history and run inspection.
- Live status updates through SSE.

The React Flow graph is serialized into the shared `WorkflowGraph` contract.

### Backend

Responsible for:
- REST API.
- Workflow persistence.
- Credential encryption and retrieval.
- Webhook endpoint management.
- Cron scheduling.
- Starting workflow executions.
- Persisting execution events.
- SSE subscriptions and initial snapshots.

### Engine

Responsible for:
- Graph validation.
- Expression resolution.
- Node registry and execution.
- Trigger reachability.
- Topological sequential execution.
- Branch routing and dead-path handling.
- Retry policies.
- Run events.

The engine is framework-independent and emits events. The server observes and persists those events.

## 4. Workflow Graph Contract

The workflow consists of nodes and directed edges.

Each node has:
- Immutable `key` used by expressions.
- Display-only `name`.
- Node `type`.
- Position on the canvas.
- Configuration `params`.
- Optional credential reference.
- Retry and error-handling settings.

Each edge has:
- Unique ID.
- Source node.
- Source output port.
- Target node.

Node output is a JSON object, and each node declares the output ports it can activate.

## 5. Execution Semantics

### Trigger selection

A run starts from exactly one trigger node.

Only nodes reachable from that trigger are considered for execution. Edges from nodes outside the selected trigger's reachable subgraph are ignored.

### Readiness and dead paths

Each edge has one of three states:

`pending | fired | dead`

A node becomes ready when all incoming edges have been resolved.

- If at least one incoming edge fired, execute the node.
- If zero incoming edges fired, skip the node.
- When a node is skipped, all its outgoing edges become dead.
- After execution, each outgoing edge fires only if its source port appears in the node result's `ports`; all other outgoing edges become dead.

This rule applies to Merge nodes too.

### Merge

Merge executes when at least one incoming edge fires.

Its output is:

```json
{
  "inputs": {
    "sourceNodeKey": {
      "example": "upstream output"
    }
  }
}
```

Only fired incoming sources are included.

### Execution order

Execution is sequential in topological order. Parallel branches are not part of the MVP.

### IF / ELSE

A condition has the form:

```json
{
  "left": "{{trigger.amount}}",
  "operator": "greater_than",
  "right": 100
}
```

Supported operators:

- `equals`
- `not_equals`
- `contains`
- `greater_than`
- `less_than`
- `is_empty`
- `is_not_empty`

If both operands parse as finite numbers, compare numerically; otherwise compare as strings. Chain IF nodes for AND conditions.

## 6. Expression System

Expression syntax:

```text
{{ nodeKey.path.to.value }}
{{ nodeKey.items[0].name }}
```

Built-in values:
- `trigger`: selected trigger node's output.
- `$now`: current ISO timestamp.

Rules:
- No `eval` or arbitrary code execution.
- A string consisting entirely of one expression preserves the raw resolved type.
- Embedded expressions are interpolated into strings.
- Objects inserted into interpolated strings are JSON-stringified.
- Missing paths resolve to `null` and produce a warning.
- Node keys are immutable; display names can change safely.

There is no implicit node input. Nodes access upstream data through expressions. A node run's stored input is its resolved parameters.

## 7. Node System and OOM Design

Implement these concepts in real code:

| OOM concept | Implementation |
|---|---|
| Abstraction | Abstract `BaseNode` |
| Inheritance | `TriggerNode`, `ActionNode`, `LogicNode` |
| Template Method | `BaseNode.run()` |
| Polymorphism | Engine executes through `INodeType` |
| Composition | Integration + operation inside `IntegrationActionNode` |
| Factory / Registry | `NodeRegistry` |
| Strategy | Fixed and Exponential retry policies |
| Observer | `RunEventBus` and `IRunObserver` |
| Facade | `WorkflowEngine` |
| Repository | Workflow, Run and Credential repositories |
| Encapsulation | `CredentialVault` |

### BaseNode execution lifecycle

`BaseNode.run()` must:
1. Resolve expressions.
2. Validate parameters.
3. Load required credentials.
4. Call the subclass's `doExecute()`.
5. Redact secrets.
6. Truncate oversized output.
7. Return the result.

Subclasses must never receive unresolved expression templates.

`TriggerNode` has no inputs and derives its output from the trigger payload.

`ActionNode` uses the default output port and delegates work to `perform()`.

`LogicNode` determines activated ports through `decide()`.

Integrations should use composition, with one registry entry per operation.

## 8. Error Handling and Retry

Default `onError` is `stop`.

- `stop`: fail the run and record remaining nodes as skipped.
- `continue`: mark the node failed, then continue with output `{ "error": { "message": "..." } }` on the `default` port only.

Retry applies only to thrown errors.

- `maxAttempts` defaults to 1.
- Fixed and exponential retry strategies.
- Sleeps must be abortable.
- Config errors are non-retryable.
- HTTP 4xx errors are non-retryable except 429.
- Network errors, HTTP 5xx and 429 are retryable.

Timeouts:
- HTTP request: 30 seconds.
- Entire run: 5 minutes.

Run statuses:

`queued | running | succeeded | failed`

Node statuses:

`running | succeeded | failed | skipped`

A run with a continued node failure can still be `succeeded`; the individual node remains `failed`.

## 9. Persistence

Five SQLite tables:

### workflows
`id, name, graph, active, created_at, updated_at`

### credentials
`id, name, type, data_enc, created_at`

### webhooks
`token, workflow_id, node_key`

### runs
`id, workflow_id, workflow_name, trigger_type, trigger_payload, graph_snapshot, status, error, queued_at, started_at, finished_at`

### node_runs
`id, run_id, seq, node_key, node_name, node_type, status, attempts, params_resolved, output, error, logs, started_at, finished_at`

Additional rules:
- Save a graph snapshot for every run.
- Store timestamps as epoch milliseconds.
- Use nanoid IDs.
- Foreign keys cascade on workflow deletion.
- Use `drizzle-kit push`; migration files are not required for the MVP.
- Mark orphaned running executions as failed on server startup.
- Stored outputs over 256 KB are truncated to `{ "_truncated": true, "preview": "..." }`.

## 10. Backend and Runtime Rules

- Manual trigger always works.
- Webhook and Schedule triggers run only when the workflow is active.
- Editor Run button means save the current graph and execute the saved graph.
- Webhook route: `/hook/:token`.
- Webhook response: `202 { "runId": "..." }`.
- Webhook body limit: 1 MB.
- Schedule uses Croner.
- Default timezone is the browser's timezone.
- Missed schedule ticks are not replayed.
- Delay is capped at 300 seconds.
- Delayed runs are in-memory; a server restart may lose them.
- Orphaned runs are marked failed on boot.

### SSE catch-up

On SSE connection:
1. Send a database snapshot of the requested run.
2. Subscribe/send subsequent live events.

This prevents missing events when a run completes before the browser subscribes.

## 11. Security

- Encrypt credentials using AES-256-GCM.
- Use `WF_MASTER_KEY`, auto-generated into `data/master.key` on first boot.
- Never return credential secret values from APIs.
- Redact exact secret values from stored logs and I/O.
- Limit HTTP request timeouts and response sizes.
- Implement URL/IP validation for HTTP requests.
- Block private and link-local addresses in production.
- Do not expose secrets in frontend state, errors or logs.

## 12. Node Inventory

| Category | Node | MVP |
|---|---|---|
| Trigger | Manual Trigger | Yes |
| Trigger | Webhook Trigger | Yes |
| Trigger | Schedule Trigger | Yes |
| Action | HTTP Request | Yes |
| Action | Slack Post Message | Yes |
| Action | Telegram Send Message | Yes |
| Action | GitHub Create Issue | Yes |
| Logic | IF / ELSE | Yes |
| Logic | Merge | Yes |
| Logic | Delay | Yes |

Node metadata and parameter forms should be driven by the backend's `GET /api/node-types` endpoint.

## 13. UI Direction

Visual direction: premium, polished and approachable, drawing from Apple macOS, Material 3 Expressive and Linear.

- Rounded cards, panels, dialogs and pill-shaped controls.
- Generous spacing and clear hierarchy.
- Light and dark CSS-variable token sets, with system preference detection.
- Trigger nodes: warm amber.
- Action nodes: blue.
- Logic nodes: violet.
- Use locally stored real brand SVG logos for integrations.
- Avoid excessive glassmorphism; reserve it for floating canvas controls.
- Smooth spring-based interactions.
- Animated edges and node status indicators during execution.

### Canvas layout

- Left: node palette.
- Center: workflow canvas with dot grid and smooth edges.
- Right: node configuration panel.
- Bottom: execution drawer with logs and JSON input/output.
- Floating toolbar: Run, Save and Zoom.

## 14. Development Milestones

| Milestone | Deliverable |
|---|---|
| M0 | Monorepo, tooling, database schema, design tokens |
| M1 | Engine, graph validation, expressions, nodes and unit tests |
| M2 | Backend APIs, webhooks, scheduler, persistence and SSE |
| M3 | Visual editor, node palette, config panel, save/load |
| M4 | Execution history, live runs and credentials UI |
| M5 | Slack, Telegram, GitHub and demo templates |
| M6 | Polish, integration testing and demonstration |

### M1 mandatory tests

- Linear chain with expression-based data passing.
- IF true/false branches.
- Untaken branch skipped.
- IF → Merge diamond with one fired source.
- Retry succeeds on third attempt.
- Non-retryable HTTP 4xx fails immediately.
- `onError: continue` versus `stop`.
- Cycle rejection.
- Trigger reachability with two triggers.
- Secret never appears in stored output.

## 15. Development Boundaries

- Do not introduce features outside the MVP.
- Do not replace the selected stack without a concrete blocker.
- Do not add infrastructure that is unnecessary for local demonstration.
- Keep the engine independent and testable.
- Prioritize correctness of execution semantics before editor polish.
- Keep implementation simple enough to complete rapidly.
- Update this blueprint only when a real technical decision changes.