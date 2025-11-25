# CONV3N Roadmap

> **Vision**: A self-hosted, no-code platform for developers. Blazingly fast (Go + Bun), fully open-source, no paid features.

---

## Phase 1: Foundation (COMPLETED ✅)

### Core Engine
- [x] Go Orchestrator with workflow execution
- [x] Bun Worker for block execution
- [x] Variable Resolver (`{{ $node.ID.data.field }}`)
- [x] HTTP API Server (`POST /api/run`, `GET /health`)
- [x] CLI Mode (`conv3n run workflow.json`)
- [x] Basic Block: `std/http_request`

**Status**: Core MVP is functional. Can execute workflows via API or CLI.

---

## Phase 2: Block Library (PROCEESING)

### Standard Blocks
Essential blocks for workflow control flow and data transformation:

- [x] `std/condition` - Conditional branching (if/else)
  - Expression evaluation via Function() constructor
  - Boolean result output
  - Support for complex JavaScript expressions
  - **Tests**: 30 unit tests ✅
- [x] `std/loop` - Iterate over arrays
  - Map and filter operations
  - Arrow function support
  - DoS protection (10k item limit)
  - **Tests**: 31 unit tests ✅
- [x] `std/transform` - Data mapping and transformation
  - JSONPath queries (via `jsonpath-rfc9535`)
  - Field picking and renaming
  - Custom transformations
  - **Tests**: 24 unit tests ✅
- [x] `std/delay` - Time delays
  - Milliseconds and seconds support
  - DoS protection (max 60 seconds)
  - Accurate timing measurement
  - **Tests**: 26 unit tests ✅
- [x] `std/file` - File system operations
  - Read/write/delete/exists operations
  - DoS protection (max 10 MB file size)
  - Support for text, JSON, and binary formats
  - **Tests**: 30 unit tests ✅
- [x] `std/database` - SQLite database operations
  - Query/execute/transaction operations via `bun:sqlite`
  - Parameterized queries (SQL injection protection)
  - DoS protection (max 10,000 rows)
  - **Tests**: 30 unit tests ✅
- [x] `std/webhook` - Outgoing HTTP requests
  - POST/PUT/PATCH methods
  - Custom headers and JSON/string body
  - Timeout protection (max 30 seconds)
  - **Tests**: 30 unit tests ✅

### Custom Code Block (KILLER FEATURE) ✅
- [x] `custom/code` - Custom TypeScript/JavaScript
  - Execution in Bun environment
  - Type-safe input/output
  - NPM package import support (via dynamic import)
  - Syntax validation (Bun.Transpiler)
  - Error handling with stack traces (SyntaxError, RuntimeError, ImportError)

**Goal**: Cover 80% of use cases without custom code, 100% with it.
**Status**: Core control flow blocks completed. 90 new unit tests added. 263 total tests passing (file: 30, database: 30, webhook: 30).

---

## Phase 3: Testing & Stability (COMPLETED ✅)

### Unit Tests
- [x] Core engine tests (`internal/engine`)
  - Workflow execution
  - Variable resolution
  - State management
- [x] Block tests (`pkg/blocks/std/*`)
  - Each block type
  - Error scenarios
- [x] API tests (`cmd/conv3n`)
  - HTTP endpoints
  - Request validation
- [x] Storage tests (`internal/storage`)
  - Execution history tracking
  - Parallel test isolation (t.TempDir)
  - Race condition prevention

### Integration Tests
- [ ] End-to-end workflow scenarios
- [ ] Performance benchmarks (vs. n8n)
- [ ] Memory leak detection

**Goal**: 80%+ code coverage, zero critical bugs.
**Status**: Unit tests complete with parallel execution support and race-free implementation.

---

## Phase 4: Persistence Layer

### Persistence Tech Stack
> **Decision**: Using `modernc.org/sqlite` (Pure Go, no CGO) for MVP.
> **Future**: Migrate to BadgerDB as load increases and project stabilizes.

**Rationale for modernc.org/sqlite:**
- ✅ Pure Go - cross-compilation without dependencies (Windows/Linux/macOS)
- ✅ No CGO - simple builds, fast CI/CD
- ✅ Familiar SQL - easy debugging and data migration
- ✅ Stability - proven technology for MVP

**Migration path to BadgerDB:**
- Abstract Storage Layer (`Storage` interface)
- Swap implementation without business logic refactoring
- Transition when performance bottlenecks appear

### Workflow Persistence
- [x] SQLite database schema (`modernc.org/sqlite`)
  - ~~Workflows table~~ → Execution History table (workflow_executions)
  - Executions table with full history tracking
  - Execution logs and error tracking
- [x] Storage Layer abstraction for future BadgerDB migration
  - `Storage` interface with execution-based methods
  - SQLite implementation (`storage.NewSQLite()`)
  - Readiness for replacement with `storage.NewBadger()`
- [x] Execution History (IMPLEMENTED ✅)
  - Store results of each execution with unique execution_id
  - Query past runs via `ListExecutions()`
  - Track execution status (running/completed/failed)
  - Error tracking for failed executions
- [x] CRUD API for workflows
  - [x] `POST /api/workflows` - Create
  - [x] `GET /api/workflows/:id` - Read
  - [x] `PUT /api/workflows/:id` - Update
  - [x] `DELETE /api/workflows/:id` - Delete
- [ ] Re-run failed executions

### Configuration
- [ ] Environment-based configuration
- [ ] Multiple environment support (dev/staging/prod)

**Goal**: Persistent workflows, execution history, production-ready storage.
**Strategy**: Start with SQLite (simplicity), migrate to BadgerDB (performance) as it grows.
**Status**: Execution history implemented with full audit trail support.

---

## Phase 5: UI (Web Interface)

### Minimal UI (v0.1)
- [ ] Simple web form to submit a JSON workflow
- [ ] Display execution results
- [ ] View list of workflows

### Visual Editor (v1.0)
- [ ] Drag-and-drop workflow builder
  - React Flow or similar library
  - Block palette
  - Connection drawing
- [ ] Block configuration panel
  - Dynamic forms based on block type
  - Variable selection (`{{ $node.* }}`)
- [ ] Real-time execution preview
  - Step-by-step execution walkthrough
  - Data inspection for each block
- [ ] Code editor for custom blocks
  - Monaco Editor (VSCode engine)
  - TypeScript syntax highlighting
  - Autocompletion

### UX Features
- [ ] Dark mode (default)
- [ ] Keyboard shortcuts
- [ ] Undo/Redo
- [ ] Workflow template gallery

**Goal**: An intuitive UI that doesn't compromise power.

---

## Phase 6: Advanced Features

### Execution Engine
- [ ] Parallel execution (DAG-based)
  - Topological sort
  - Concurrent block execution
- [ ] Error handling strategies
  - Exponential backoff retries
  - Fallback blocks
  - Error boundaries
- [ ] Triggers
  - Cron schedules
  - Webhook triggers
  - File watchers

### Developer Experience
- [ ] CLI workflow validation (`conv3n validate workflow.json`)
- [ ] Workflow testing framework
- [ ] Debug mode with breakpoints
- [ ] Performance profiling

### Integrations
- [ ] Pre-built connectors
  - GitHub API
  - Telegram Bot API
  - Discord webhooks
  - Stripe API
  - OpenAI API
- [ ] Plugin system for custom integrations

**Goal**: Feature parity with n8n, but faster and free.

---

## Phase 7: Production Readiness

### Deployment
- [ ] Docker image
- [ ] Docker Compose setup
- [ ] Kubernetes manifests
- [ ] One-click deployment scripts (Railway, Fly.io)

### Security
- [ ] API authentication (JWT)
- [ ] Role-Based Access Control (RBAC)
- [ ] Secrets management (encrypted environment variables)
- [ ] Request rate limiting

### Monitoring
- [ ] Prometheus metrics
- [ ] Health checks
- [ ] Logging (structured JSON logs)
- [ ] Alerting

### Documentation
- [ ] Getting Started Guide
- [ ] Block documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Video tutorials

**Goal**: A production-ready, self-hostable platform.

---

## Phase 8: Community & Growth

### Open Source
- [ ] GitHub repository setup
  - README with a killer demo
  - Contribution guide
  - Code of Conduct
- [ ] License: MIT or Apache 2.0
- [ ] Changelog automation

### Marketing
- [ ] Telegram channel posts
- [ ] Outreach to tech micro-influencers (1k+ followers)
- [ ] Hacker News launch
- [ ] Dev.to / Hashnode articles
- [ ] Comparative benchmarks (CONV3N vs. n8n)

### Community
- [ ] Discord server
- [ ] GitHub Discussions
- [ ] Example workflows repository
- [ ] Community contributions to blocks

**Goal**: Build a community of power users and contributors.

---

## Future Ideas (Backlog)

- [ ] Mobile app (React Native) for monitoring
- [ ] AI block (GPT-4, Claude integration)
- [ ] Visual data debugger
- [ ] Workflow marketplace (community templates)
- [ ] Multi-tenancy (optional, for businesses)
- [ ] Real-time collaboration (multi-user editing)
- [ ] Workflow versioning (like Git)

---

## Success Metrics

### Technical
- Execution speed: 5x faster than n8n
- Memory usage: <100MB for typical workflows
- Startup time: <1s

### Adoption
- 1,000 GitHub stars within the first 6 months
- 100 active self-hosted instances
- 10 community contributors

### Recognition
- Featured on Hacker News front page
- Mentioned in developer newsletters
- Case studies from real users

---

## Current Status

**We are here**: Phase 2 - Block Library (COMPLETED ✅)
**Next milestone**: Phase 4 - CRUD API for workflows, then Phase 5 - UI
**Estimated time to v1.0**: 2-4 months (solo development)

### Recent Updates (2025-11-25)
- ✅ **Phase 2 Block Library - std/delay completed**
- ✅ Implemented `std/delay` - time delays with ms/s support (26 tests)
- ✅ DoS protection (max 60 seconds delay)
- ✅ All 156 Bun tests passing (127 total), all Go tests passing
- ✅ Created example workflows for delay block
- ✅ Previous blocks: `std/condition` (30 tests), `std/loop` (31 tests), `std/transform` (24 tests)

---

## Notes

- **No paid features, ever.** This is a community project.
- **No donation wallet.** Recognition > money.
- **Modular architecture.** Proprietary zxink modules can be loaded separately.
- **Developer-first.** If it's not fast and powerful, it's not worth building.

---

*Last updated: 2025-11-25*

### Technical Decisions
- **SQLite driver**: `modernc.org/sqlite` (Pure Go, no CGO)
- **Future DB**: BadgerDB (after stabilization and user growth)
