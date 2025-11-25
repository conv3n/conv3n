# CONV3N Roadmap

> **Vision**: Self-hosted, no-code platform for hardcore developers. Blazing fast (Go + Bun), fully open-source, zero paid features.

---

## Phase 1: Foundation (DONE ✅)

### Core Engine
- [x] Go orchestrator with workflow execution
- [x] Bun worker for block execution
- [x] Variable resolver (`{{ $node.ID.data.field }}`)
- [x] HTTP API server (`POST /api/run`, `GET /health`)
- [x] CLI mode (`conv3n run workflow.json`)
- [x] Basic block: `std/http_request`

**Status**: MVP core is functional. Can execute workflows via API or CLI.

---

## Phase 2: Block Library (Next Priority)

### Standard Blocks
Implement essential blocks for real-world workflows:

- [ ] `std/transform` - Data mapping and transformation
  - JSONPath queries
  - Field renaming/restructuring
  - Type conversion
- [ ] `std/condition` - Conditional branching (if/else)
  - Expression evaluation
  - Multiple output paths
- [ ] `std/loop` - Array iteration
  - Map over items
  - Batch processing
- [ ] `std/delay` - Time-based delays
- [ ] `std/webhook` - Incoming HTTP webhooks
  - Dynamic endpoint generation
  - Payload validation
- [ ] `std/database` - Database operations
  - SQLite (primary)
  - PostgreSQL/MySQL connectors
- [ ] `std/file` - File system operations
  - Read/Write files
  - Directory operations

### Custom Code Block (KILLER FEATURE)
- [ ] `custom/code` - User-defined TypeScript/JavaScript
  - Bun runtime execution
  - Type-safe input/output
  - NPM package imports support
  - Syntax validation
  - Error handling with stack traces

**Goal**: Enable 80% of use-cases without custom code, 100% with it.

---

## Phase 3: Testing & Stability

### Unit Tests
- [ ] Engine core tests (`internal/engine`)
  - Workflow execution
  - Variable resolution
  - State management
- [ ] Block tests (`pkg/blocks/std/*`)
  - Each block type
  - Error scenarios
- [ ] API tests (`cmd/conv3n`)
  - HTTP endpoints
  - Request validation

### Integration Tests
- [ ] End-to-end workflow scenarios
- [ ] Performance benchmarks (compare with n8n)
- [ ] Memory leak detection

**Goal**: 80%+ code coverage, zero critical bugs.

---

## Phase 4: Storage Layer

### Workflow Persistence
- [ ] SQLite database schema
  - Workflows table
  - Executions table (history)
  - Execution logs
- [ ] CRUD API for workflows
  - `POST /api/workflows` - Create
  - `GET /api/workflows/:id` - Read
  - `PUT /api/workflows/:id` - Update
  - `DELETE /api/workflows/:id` - Delete
- [ ] Execution history
  - Store results per execution
  - Query past runs
  - Retry failed executions

### Configuration
- [ ] Environment-based config
- [ ] Multi-environment support (dev/staging/prod)

**Goal**: Persistent workflows, execution history, production-ready storage.

---

## Phase 5: UI (Web Interface)

### Minimal UI (v0.1)
- [ ] Simple web form for JSON workflow submission
- [ ] Execution results display
- [ ] Workflow list view

### Visual Editor (v1.0)
- [ ] Drag-and-drop workflow builder
  - React Flow or similar library
  - Block palette
  - Connection drawing
- [ ] Block configuration panel
  - Dynamic forms based on block type
  - Variable picker (`{{ $node.* }}`)
- [ ] Live execution preview
  - Step-by-step execution view
  - Data inspection per block
- [ ] Code editor for custom blocks
  - Monaco Editor (VSCode engine)
  - TypeScript syntax highlighting
  - Auto-completion

### UX Features
- [ ] Dark mode (default)
- [ ] Keyboard shortcuts
- [ ] Undo/Redo
- [ ] Workflow templates gallery

**Goal**: Intuitive UI that doesn't compromise power.

---

## Phase 6: Advanced Features

### Execution Engine
- [ ] Parallel execution (DAG-based)
  - Topological sort
  - Concurrent block execution
- [ ] Error handling strategies
  - Retry with backoff
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
- [ ] One-click deploy scripts (Railway, Fly.io)

### Security
- [ ] API authentication (JWT)
- [ ] Role-based access control (RBAC)
- [ ] Secrets management (encrypted env vars)
- [ ] Rate limiting

### Monitoring
- [ ] Prometheus metrics
- [ ] Health checks
- [ ] Logging (structured JSON logs)
- [ ] Alerting

### Documentation
- [ ] Getting Started guide
- [ ] Block reference docs
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Video tutorials

**Goal**: Production-grade, self-hostable platform.

---

## Phase 8: Community & Growth

### Open Source
- [ ] GitHub repository setup
  - README with killer demo
  - Contributing guidelines
  - Code of conduct
- [ ] License: MIT or Apache 2.0
- [ ] Changelog automation

### Marketing
- [ ] Telegram channel posts
- [ ] Reach out to tech micro-influencers (1k+ subs)
- [ ] Hacker News launch
- [ ] Dev.to / Hashnode articles
- [ ] Comparison benchmarks (CONV3N vs n8n)

### Community
- [ ] Discord server
- [ ] GitHub Discussions
- [ ] Example workflows repository
- [ ] Community block contributions

**Goal**: Build a community of power users and contributors.

---

## Future Ideas (Backlog)

- [ ] Mobile app (React Native) for monitoring
- [ ] AI block (GPT-4, Claude integration)
- [ ] Visual data debugger
- [ ] Workflow marketplace (community templates)
- [ ] Multi-tenant mode (optional, for companies)
- [ ] Real-time collaboration (multiplayer editing)
- [ ] Workflow versioning (Git-like)

---

## Success Metrics

### Technical
- Execution speed: 5x faster than n8n
- Memory usage: <100MB for typical workflows
- Startup time: <1s

### Adoption
- 1,000 GitHub stars in first 6 months
- 100 active self-hosted instances
- 10 community contributors

### Recognition
- Featured on Hacker News front page
- Mentioned in developer newsletters
- Case studies from real users

---

## Current Status

**We are here**: End of Phase 1  
**Next milestone**: Phase 2 - Custom Code Block  
**Estimated time to v1.0**: 3-6 months (solo dev)

---

## Notes

- **No paid features, ever.** This is a community project.
- **No donation wallet.** Recognition > money.
- **Modular architecture.** Proprietary zxink modules can be loaded separately.
- **Developer-first.** If it's not fast and powerful, it's not worth building.

---

*Last updated: 2025-11-25*
