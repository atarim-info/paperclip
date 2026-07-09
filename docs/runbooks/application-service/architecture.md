---
title: Service Architecture
summary: Components, dependencies, and data flow for the Paperclip application service
---

# Service Architecture

## Components

```
┌─────────────────────────────────────────────────┐
│                  Internet / Tailscale            │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│  ALB (Application Load Balancer)                │
│  TLS termination, health checks, routing        │
│  Port 443 → Target group port 3100              │
└──────────────────┬──────────────────────────────┘
                   │ HTTP :3100
┌──────────────────▼──────────────────────────────┐
│  ECS Fargate Task (paperclip-server)            │
│  ┌─────────────────────────────────────────┐   │
│  │  Express.js 5 API Server (Node.js 20+)  │   │
│  │  Port 3100                              │   │
│  │  - REST routes (/api/*)                 │   │
│  │  - Middleware (auth, logging, CORS)     │   │
│  │  - Services layer                       │   │
│  │  - Plugin host services                 │   │
│  │  - Adapter execution drivers            │   │
│  └──────────┬──────────────────┬───────────┘   │
└─────────────┼──────────────────┼────────────────┘
              │                  │
     ┌────────▼──────┐   ┌──────▼─────────┐
     │  RDS PostgreSQL│   │  EFS (Storage) │
     │  (Drizzle ORM) │   │  - File assets │
     │  - Schema      │   │  - Agent works │
     │  - Migrations  │   │  - Plugins     │
     │  - Auth/users  │   │  - Backups     │
     │  - Tasks/issues│   └────────────────┘
     │  - Companies   │
     └───────────────┘
```

## Deployment Model

- Single ECS Fargate task (1 container) behind ALB
- Deployment: rolling update with circuit breaker (auto-rollback on health check failure)
- Fargate 2 vCPU / 4 GB RAM (default)
- RDS db.t4g.micro PostgreSQL 17
- EFS bursting throughput mode for persistent storage
- Secrets via AWS Secrets Manager

## Data Flow

```
Request → ALB (TLS) → ECS task → Express.js
  → Auth (Better Auth session or API key)
  → Route handler
    → Service call
      → Database query (Drizzle ORM → PostgreSQL)
      → Storage read/write (EFS for files, S3 optional)
      → Adapter execution (agent runtimes via subprocess/HTTP)
  → JSON response
```

## Key Dependencies

| Dependency | Type | Impact if down |
|------------|------|----------------|
| PostgreSQL | Primary data store | Complete service outage |
| EFS | Persistent file storage | Asset uploads/reads fail; agent workspaces unavailable |
| AWS Secrets Manager | Secrets | Startup failure if secrets cannot be resolved |
| AWS ECR | Container registry | Deployments blocked |
| CloudWatch Logs | Logging | Logs unavailable but app still serves |

## Non-Functional Characteristics

- **Stateless compute**: all session state in DB, not local memory
- **Single-process**: horizontal scale is via ECS task count, not intra-process
- **Embedded DB mode**: local deployments use PGlite instead of RDS
