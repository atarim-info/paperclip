---
title: Broker Outage
summary: Event/messaging broker failures, partition loss, consumer lag
severity: High
---

# Broker Outage

## Overview

Paperclip does not currently depend on an external message broker for its
core request-serving path. Internal event distribution (heartbeat triggers,
workspace operations, plugin events) uses the application's own plugin event
bus, which is in-process. If an external broker such as Kafka, RabbitMQ, or
Amazon SQS/SNS is introduced for asynchronous workloads (agent execution
queues, cross-service event streaming, audit log pipelines), this runbook
applies.

## Symptoms (if broker is configured)

- Missed or delayed heartbeat executions
- Agent runs not triggered on task assignment
- Plugin events not delivered
- Event backlog growing in the broker
- Consumer group lag increasing
- Broker connection errors in logs

## Initial Diagnosis

### 1. Check broker health

```bash
# If using Amazon MSK (Kafka)
aws kafka describe-cluster \
  --cluster-arn arn:aws:kafka:us-east-1:ACCOUNT:cluster/paperclip-events/xxxx

# If using Amazon MQ (RabbitMQ/ActiveMQ)
aws mq describe-broker \
  --broker-id paperclip-events-broker \
  --query 'BrokerInstances[*].{status:ConsoleURL,state:State}'
```

Expected: state `RUNNING` or `ACTIVE`.

### 2. Check consumer lag

```bash
# MSK consumer group lag
aws kafka describe-consumer-group \
  --cluster-arn <cluster-arn> \
  --consumer-group-name paperclip-events \
  --query 'ConsumerGroupInfo.ConsumerGroup'
```

### 3. Check application logs

```bash
aws logs tail /ecs/paperclip --since 15m | grep -i "broker\|kafka\|rabbit\|queue\|event"
```

## Recovery Procedures

### Scenario A: Broker Unreachable

1. Verify network connectivity (security groups, NACLs) between the ECS task
   and the broker.
2. If DNS resolution fails, check the broker endpoint in the app config.
3. Restart the ECS service to re-establish connections:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

### Scenario B: Consumer Lag

If consumers are falling behind:

1. Check if the consumer is processing events slower than the production rate.
2. Look for processing errors in logs: unhandled exceptions, DB timeouts, etc.
3. If the consumer is stuck on a poison message, skip the failing message:

```bash
# Kafka: skip to latest offset for the stuck partition
kafka-consumer-groups \
  --bootstrap-server $BROKER_ENDPOINT \
  --group paperclip-events \
  --reset-offsets --to-latest \
  --execute --topic paperclip-events
```

4. If the consumer needs more throughput, increase the `max.poll.records` or
   add partitions/consumers.

### Scenario C: Partition Loss (Kafka)

If a broker node fails and a partition leader is lost:

1. MSK automatically elects a new leader from in-sync replicas.
2. If a partition stays offline (under-replicated), check the MSK cluster
   health:

```bash
aws kafka list-nodes --cluster-arn <cluster-arn>
```

3. If a node is unhealthy, MSK replaces it automatically. Contact AWS support
   if auto-recovery does not trigger within 30 minutes.

### Scenario D: Message Backlog

If a large backlog has accumulated after an outage:

1. Prioritize processing recent events before historical ones if the event
   processor supports it (time-based filtering).
2. If the backlog is too large to catch up, consider:
   - Reprovisioning a larger consumer group
   - Skipping non-critical events
   - Rebuilding state from the database instead of replaying events

## Degraded Operation

Without a broker, the application continues to serve HTTP requests but:

- Scheduled/async operations may not trigger
- Cross-service event notifications are lost
- Audit trail may have gaps until the broker recovers

## Post-Recovery Verification

- Consumer lag returns to near-zero
- No connection errors in logs
- Agents triggered correctly on task assignments
- Plugin events delivered

## Root Cause Analysis Checklist

- [ ] Was the broker cluster modified or terminated?
- [ ] Was there a network partition (security group, NACL)?
- [ ] Was there a poison message causing consumer to stall?
- [ ] Was the broker at capacity (disk, memory, connections)?
- [ ] Was an AZ outage responsible?
