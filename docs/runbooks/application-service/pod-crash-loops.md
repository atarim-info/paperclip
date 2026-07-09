---
title: Pod Crash Loops
summary: ECS task restarts, OOM kills, startup probe failures, and recovery
severity: Critical
---

# Pod Crash Loops

## Overview

The Paperclip application service runs as a single ECS Fargate task. When the
task repeatedly crashes and restarts, the service becomes unavailable. This
runbook covers diagnosis and recovery for crash loops.

## Symptoms

- ECS task status cycling through `RUNNING` → `STOPPED` → `RUNNING`
- ALB `HealthyHostCount` drops to 0
- ALB `UnhealthyHostCount` spikes
- ECS task `StopCode`: `TaskFailedToStart`, `EssentialContainerExited`
- Circuit breaker triggered: deployment rolled back automatically
- Service health check (`/api/health`) returns 5xx or timeout

## Initial Diagnosis

### 1. Check ECS task stopped reason

```bash
aws ecs describe-tasks \
  --cluster paperclip \
  --tasks $(aws ecs list-tasks --cluster paperclip --service-name paperclip-server --desired-status STOPPED --query 'taskArns[0]' --output text) \
  --query 'tasks[0].{stopCode:stopCode,stoppedReason:stoppedReason,containers:containers[0].{exitCode:exitCode,reason:reason}}'
```

### 2. Check the stopped task's logs

```bash
# List log streams for the stopped task
aws logs describe-log-streams \
  --log-group-name /ecs/paperclip \
  --order-by LastEventTime \
  --descending \
  --limit 5

# Tail the most recent log stream
aws logs tail /ecs/paperclip --log-stream-name <stream-name>
```

### 3. Check CloudWatch Logs for crash patterns

```bash
aws logs tail /ecs/paperclip --since 30m | grep -E "Error|FATAL|CRASH|OOM|Killed|Segmentation|uncaughtException|unhandledRejection"
```

## Recovery Procedures

### Scenario A: Out of Memory (OOM)

**Symptoms:** Task stops with exit code 137, or `reason: OutOfMemory`.
Logs show no error — the kernel kills the process.

1. **Immediate: Increase Fargate memory**

Update the service to use a larger task definition:

```bash
# Register a new task definition revision with more memory
# Edit docker/ecs-task-definition.json: change "memory" from 4096 to 8192
aws ecs register-task-definition --cli-input-json file:///tmp/paperclip-task-def.json

# Update the service
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --task-definition paperclip-server:<new-revision>
```

2. **Investigate root cause:**
   - Look for memory leaks in adapter executions (agent subprocesses not cleaned up)
   - Check if `max-old-space-size` Node.js flag is set in the container entrypoint
   - Review memory usage patterns in CloudWatch `AWS/ECS/MemoryUtilization`

3. **Set Node.js memory limit** (add to container command):

```
node --max-old-space-size=3072 dist/server/src/index.js
```

### Scenario B: Startup Probe Failure

**Symptoms:** Task starts but ALB health checks fail. Logs show partial startup.

1. **Check startup sequence in logs:**
   - Is the database reachable?
   - Do migrations run successfully?
   - Are secrets resolved?
   - Are plugins loaded?

2. **Common causes:**
   - **Database unreachable**: The app can't start without a database. Verify
     RDS is available (see [database outage runbook](database-outage.md)).
   - **Missing secrets**: The server fails to resolve required secrets via
     AWS Secrets Manager. Check `PAPERCLIP_SECRETS_STRICT_MODE` and secret
     bindings.
   - **Corrupt embedded DB**: If using embedded PostgreSQL (PGlite), the
     database files may be corrupted. See Scenario D.
   - **Plugin crash**: A misbehaving plugin blocks server startup. See
     Scenario E.

3. **Force a redeployment** after fixing the root cause:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

### Scenario C: Uncaught Exception / Unhandled Rejection

**Symptoms:** Task stops with exit code 1. Logs show a JavaScript error.

1. **Extract the error:**

```bash
aws logs tail /ecs/paperclip --since 30m | grep -A10 "uncaughtException\|unhandledRejection\|TypeError\|ReferenceError"
```

2. **Common causes:**
   - Missing environment variable (accessing `process.env.X` that is undefined)
   - API request handler throwing without a catch
   - Plugin runtime error

3. **Immediate fix:**
   - Roll back to the previous working task definition revision
   - Apply the code fix and re-deploy

### Scenario D: Embedded PostgreSQL (PGlite) Corruption

**Symptoms:** Used in `local_trusted` or Docker mode without external RDS.
Logs show `database disk image is malformed` or `SQL logic error`.

1. **Back up the corrupted data** (if possible):

```bash
cp -r ~/.paperclip/instances/default/db ~/.paperclip/instances/default/db.corrupted
```

2. **Reset the embedded database:**

```bash
rm -rf ~/.paperclip/instances/default/db
```

3. **Restore from a backup** (if available, see
   [database runbook](database-outage.md)).

### Scenario E: Plugin Crash at Startup

**Symptoms:** Logs show plugin load failures before the server becomes ready.

1. Identify the failing plugin:

```bash
aws logs tail /ecs/paperclip --since 30m | grep "plugin.*error\|plugin.*fail"
```

2. Disable the plugin by removing it from the company's plugin configuration,
   then restart.

## Healthy Startup Log Sequence

A healthy startup looks like:

```
[INFO] Starting Paperclip server...
[INFO] Database connected
[INFO] Migrations complete
[INFO] Plugin loader: loadAll complete
[INFO] Plugin job coordinator started
[INFO] Listening on port 3100
```

If this sequence is incomplete, the task is stuck in startup.

## Post-Recovery Verification

- ECS task status: `RUNNING`, health: `HEALTHY`
- ALB `HealthyHostCount`: 1+
- `/api/health` returns 200
- Full startup log sequence observed
- UI loads and is interactive

## Root Cause Analysis Checklist

- [ ] Was the crash caused by OOM?
- [ ] Was it a startup probe failure (DB, secrets, plugins)?
- [ ] Was it an uncaught application exception?
- [ ] Was there a recent deployment that introduced the regression?
- [ ] Was embedded DB storage corrupted (PGlite)?
- [ ] Was a plugin crashing on load?
