---
title: Cache Outage
summary: Redis unavailability, eviction storms, and cache degradation
severity: High
---

# Cache Outage

## Overview

Paperclip uses the PostgreSQL database as its primary data store. An
in-memory cache layer (Redis or similar) is not currently a hard dependency,
but may be introduced for session caching, rate limiting token buckets, or
query result caching. This runbook covers patterns to follow if a cache
layer is deployed.

## Symptoms (if cache layer is configured)

- Increased P95 response latency (ALB `TargetResponseTime`)
- Higher database CPU and connection count
- Stale data appearing in the UI
- Cache eviction warnings in application logs
- Application errors: `ERR max memory` or `OOM command not allowed`

## Initial Diagnosis

### 1. Check cache service health

```bash
# If using ElastiCache Redis
aws elasticache describe-cache-clusters \
  --cache-cluster-id paperclip-cache \
  --show-cache-node-info \
  --query 'CacheClusters[0].{status:CacheClusterStatus,endpoint:ConfigurationEndpoint.Address}'
```

Expected: `"available"`.

### 2. Check cache metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name EngineCPUUtilization \
  --dimensions Name=CacheClusterId,Value=paperclip-cache \
  --start-time "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Average
```

Key metrics: `Evictions`, `CurrConnections`, `CacheMisses`, `CacheHits`.

### 3. Check application logs

```bash
aws logs tail /ecs/paperclip --since 15m | grep -i "cache\|redis\|evict\|timeout"
```

## Recovery Procedures

### Scenario A: Cache Service Unavailable

If the cache endpoint is unreachable:

1. Determine whether the cache is **required** or **optional** in the current
   deployment configuration (check the `PAPERCLIP_CACHE_ENABLED` env var or
   equivalent).
2. If optional, the application should degrade gracefully (fall through to
   database queries). Verify with a test endpoint.
3. If required, fail over to a replica or provision a replacement cluster.
4. Restart the ECS service to re-establish connections:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

### Scenario B: Memory Pressure / Eviction Storm

1. Check `Evictions` metric. Sustained evictions > 100/s indicate the cache
   is undersized.
2. Increase the cache instance size or modify `maxmemory-policy`:

   ```
   allkeys-lru      — evict least-recently-used keys (recommended)
   volatile-lru     — evict only keys with TTL
   noeviction       — return OOM errors instead (not recommended)
   ```

3. If using ElastiCache, modify the parameter group:

```bash
aws elasticache modify-replication-group \
  --replication-group-id paperclip-cache \
  --cache-parameter-group-name papercache-params
```

4. Consider adding more shards or moving to a larger node type.

### Scenario C: Connection Failures

1. Check `CurrConnections` against the maxclients limit.
2. If maxed out, the application connection pool may be misconfigured.
   Reduce the pool size in the application config.
3. Restart the ECS service to force connection rebalancing.

## Degraded Operation

Without a cache layer, the application falls back to direct database queries.
Expect:

- 2-5x increase in response latency
- Higher RDS CPU utilization
- No data staleness (reads are always fresh)

## Post-Recovery Verification

- Cache `PING` returns `PONG`
- Application latency returns to baseline
- Database CPU utilization drops to normal levels
- No eviction warnings in logs

## Root Cause Analysis Checklist

- [ ] Was the cache cluster accidentally terminated or modified?
- [ ] Was maxmemory exceeded due to a cache miss storm?
- [ ] Was there a connection leak from the application?
- [ ] Was a deployment config change that broke the cache connection?
