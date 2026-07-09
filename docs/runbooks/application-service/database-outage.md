---
title: Database Outage
summary: PostgreSQL connection failures, migration issues, and recovery
severity: Critical
---

# Database Outage

## Symptoms

- ALB 5XX rate spikes (`HTTPCode_Target_5XX`)
- Service health check fails (`/api/health` returns 503)
- Application logs show `ECONNREFUSED` or `connect ETIMEDOUT` to PostgreSQL
- Drizzle ORM errors: `ConnectionError`, `ConnectionAcquireTimeoutError`
- Slow page loads or timeouts in the UI

## Initial Diagnosis

### 1. Check RDS instance state

```bash
aws rds describe-db-instances \
  --db-instance-identifier paperclip-db \
  --query 'DBInstances[0].{status:DBInstanceStatus, endpoint:Endpoint.Address}'
```

Expected: `"available"`. If `"stopped"`, the instance was manually stopped or
auto-stopped after 7 days. If `"failed"`, proceed to recovery.

### 2. Check RDS CloudWatch metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=paperclip-db \
  --start-time "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Maximum
```

Look for connection count near the instance max connections
(`LEAST({DBInstanceClassMemory/9531392}, 5000)` for db.t4g.micro).

### 3. Check ECS task logs for DB errors

```bash
aws logs tail /ecs/paperclip --since 15m | grep -i "database\|postgres\|drizzle\|connect"
```

### 4. Test connectivity from the task

If possible, exec into the task and test:

```bash
aws ecs execute-command \
  --cluster paperclip \
  --task $(aws ecs list-tasks --cluster paperclip --service-name paperclip-server --query 'taskArns[0]' --output text) \
  --interactive \
  --command "/bin/sh"
```

Then inside the container:

```sh
nc -zv $DATABASE_HOST 5432
```

## Recovery Procedures

### Scenario A: RDS Instance Stopped

```bash
aws rds start-db-instance --db-instance-identifier paperclip-db
```

Wait 2-5 minutes for the instance to become available, then force a new ECS
deployment so the task rotates to a fresh connection:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

### Scenario B: Connection Pool Exhaustion

The ECS task connects to RDS with a connection pool via `postgres` library.
If connections are maxed out:

1. Identify the hog: check RDS `DatabaseConnections` metric and
   `performance_schema` queries in RDS Performance Insights.
2. Force a task restart to drain idle connections:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

3. If recurring, increase the pool size in `packages/db/src/client.ts` or
   scale up the RDS instance class.

### Scenario C: RDS Storage Full

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=paperclip-db \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Average
```

Recovery:

```bash
# Modify the instance to increase storage
aws rds modify-db-instance \
  --db-instance-identifier paperclip-db \
  --allocated-storage 40 \
  --apply-immediately
```

### Scenario D: Migration Failure

If a Drizzle migration fails and leaves the DB in an inconsistent state:

1. Check the migration log in the application logs.
2. Identify the failed migration file in `packages/db/src/migrations/`.
3. Manually apply the migration or roll back:

```bash
# Roll back the last migration (if reversible)
npx drizzle-kit drop
# Or connect directly and revert
psql "$DATABASE_URL" -c "DELETE FROM __drizzle_migrations WHERE hash = '<failed-hash>';"
```

4. Re-deploy with the fixed migration.

### Scenario E: RDS Failover (Multi-AZ)

If Multi-AZ is configured and a failover occurs:

1. RDS promotes the standby automatically (60-120 seconds).
2. The DNS endpoint updates to point to the new primary.
3. Force a new ECS deployment to reconnect:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

4. Verify:

```bash
curl -sf https://$PAPERCLIP_DOMAIN/api/health
```

## Post-Recovery Verification

- `/api/health` returns 200
- ECS task status: `RUNNING`, health: `HEALTHY`
- Logs show `migrations complete` and `plugin job coordinator started`
- UI loads and displays data correctly
- No 5XX errors in ALB metrics

## Root Cause Analysis Checklist

- [ ] Was the RDS instance stopped manually?
- [ ] Was it an Aurora/PostgreSQL auto-stop (7-day idle)?
- [ ] Was storage full?
- [ ] Was there a connection leak?
- [ ] Was a migration the cause?
- [ ] Did an AZ outage trigger failover?

## Related

- [Deployment: Database](/docs/deploy/database.md)
- [Deployment: AWS ECS](/docs/deploy/aws-ecs.md#rollback)
