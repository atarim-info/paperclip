---
title: Application Service On-Call Runbooks
summary: Failure scenarios, diagnosis steps, and recovery procedures for the Paperclip application-service
---

# Application Service On-Call Runbooks

This directory contains runbooks for the Paperclip application service — the
Express.js API server that powers the Paperclip control plane.

## Service Overview

The application service is a single-process Node.js 20+ Express.js 5 server
running on port 3100. It is deployed as an ECS Fargate task behind an ALB
with TLS termination. For a full architecture reference, see
[architecture overview](architecture.md).

## Quick Reference

| Runbook | Symptoms | Severity |
|---------|----------|----------|
| [Database Outage](database-outage.md) | 5xx errors, slow queries, connection errors | **Critical** |
| [Cache Outage](cache-outage.md) | Increased latency, stale data, backend pressure | **High** |
| [Broker Outage](broker-outage.md) | Missed events, consumer lag, event backlog | **High** |
| [HPA Misbehavior](hpa-misbehavior.md) | Scale-up failures, thrashing, pod churn | **Medium** |
| [Pod Crash Loops](pod-crash-loops.md) | Repeated task restarts, probe failures | **Critical** |
| [Configuration Drift](configuration-drift.md) | Missing secrets, wrong env vars, auth errors | **High** |

## Dashboards

- **CloudWatch**: `/aws/ecs/paperclip` log group in `AWS/ECS` namespace
- **ALB metrics**: `AWS/ApplicationELB` — `TargetResponseTime`, `HTTPCode_Target_5XX`,
  `HealthyHostCount`, `UnhealthyHostCount`
- **RDS metrics**: `AWS/RDS` — `DatabaseConnections`, `CPUUtilization`,
  `ReadLatency`, `WriteLatency`, `Deadlocks`

## Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| `paperclip-prod-5xx-rate` | ALB 5XX > 1% over 5m | Check database and pod health |
| `paperclip-prod-pod-crash` | ECS task stopped unexpectedly | Investigate task logs |
| `paperclip-prod-db-connections` | DB connections > 80% of max | Check connection pool exhaustion |
| `paperclip-prod-high-latency` | P95 latency > 2s over 5m | Trace slow requests |

## Escalation Path

| Role | Contact |
|------|---------|
| Primary on-call | DevOps Engineer |
| Secondary | CTO |
| Escalation | [Secretary](agent://4a4d8734-b12a-403f-b377-17cfadfd40a1) |

## Related Documentation

- [Deployment Guide](/docs/deploy/aws-ecs.md)
- [Database Guide](/docs/deploy/database.md)
- [Secrets Management](/docs/deploy/secrets.md)
- [Environment Variables](/docs/deploy/environment-variables.md)
