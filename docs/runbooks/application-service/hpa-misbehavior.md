---
title: HPA Misbehavior
summary: Scale-up failures, thrashing, and pod churn in ECS service auto-scaling
severity: Medium
---

# HPA Misbehavior

## Overview

Paperclip runs as a single ECS Fargate service. Service auto-scaling can be
configured via Application Auto Scaling to adjust the desired task count
based on CPU/memory utilization or ALB request count per target. This runbook
covers diagnosis and recovery when auto-scaling behaves incorrectly.

## Symptoms

- ECS service desired count oscillating up and down rapidly (thrashing)
- Tasks failing to start (stuck in `PROVISIONING` or `ACTIVATING`)
- ALB `UnhealthyHostCount` > 0 after a scale-up event
- ECS `service` deployment circuit breaker triggered
- Unexpectedly high or low task count for the current load

## Initial Diagnosis

### 1. Check ECS service auto-scaling configuration

```bash
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/paperclip/paperclip-server \
  --scalable-dimension ecs:service:DesiredCount
```

Review the scaling policies, cooldown periods, and target metrics.

### 2. Check auto-scaling activity

```bash
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/paperclip/paperclip-server \
  --scalable-dimension ecs:service:DesiredCount
```

Look for rapid back-and-forth scaling or failed scale activities.

### 3. Check ECS service metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=paperclip-server Name=ClusterName,Value=paperclip \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Average
```

### 4. Check ALB request count per target

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCountPerTarget \
  --dimensions Name=LoadBalancer,Value=app/paperclip-alb/<suffix> Name=TargetGroup,Value=targetgroup/paperclip-tg/<suffix> \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Sum
```

## Recovery Procedures

### Scenario A: Thrashing (Rapid Scale-Up/Down)

Caused by aggressive target values or short cooldown periods.

1. **Increase cooldown periods:**

```bash
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/paperclip/paperclip-server \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name paperclip-cpu-target \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {"PredefinedMetricType": "ECSServiceAverageCPUUtilization"},
    "ScaleOutCooldown": 300,
    "ScaleInCooldown": 600
  }'
```

2. **Set minimum and maximum task count boundaries:**

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/paperclip/paperclip-server \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10
```

### Scenario B: Scale-Up Failures

New Fargate tasks fail to start due to resource constraints.

1. Check if the account has reached the **vCPU limit** for Fargate:

```bash
aws service-quotas get-service-quota \
  --service-code fargate \
  --quota-code L-21D7D4F4
```

2. If at the limit, request a quota increase:

```bash
aws service-quotas request-service-quota-increase \
  --service-code fargate \
  --quota-code L-21D7D4F4 \
  --desired-value 50
```

3. Check if the subnet has sufficient IP addresses available:

```bash
aws ec2 describe-subnets \
  --subnet-ids <subnet-id> \
  --query 'Subnets[0].AvailableIpAddressCount'
```

### Scenario C: Tasks Stuck Unhealthy After Scale-Up

New tasks start but fail health checks.

1. Check the new task's logs:

```bash
TASK_ARN=$(aws ecs list-tasks --cluster paperclip --service-name paperclip-server --desired-status RUNNING --query 'taskArns[0]' --output text)
aws logs tail /ecs/paperclip --log-stream-names <task-log-stream> --since 5m
```

2. Compare the new task's environment with a healthy task. Possible causes:
   - Secrets not resolved for the new task
   - Database migrations not run
   - Startup timeout

3. If the new task pattern is healthy but health checks fail, check the ALB
   health check configuration:

```bash
aws elbv2 describe-target-groups \
  --target-group-arns <tg-arn> \
  --query 'TargetGroups[0].{path:HealthCheckPath,interval:HealthCheckIntervalSeconds,threshold:HealthyThresholdCount,timeout:HealthCheckTimeoutSeconds}'
```

### Scenario D: Scale-In Not Occurring

Desired count stays high despite low load.

1. Check if there is a `scale-in protected` or `managed termination` policy
   blocking scale-in.
2. Manually reduce desired count if needed:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --desired-count 1
```

## Prevention

- Set scale-out cooldown to at least 180s, scale-in to 300s+
- Use step scaling instead of target tracking for spiky workloads
- Always test scaling policies in a staging environment
- Monitor `ECSServiceAverageCPUUtilization` and `ECSServiceAverageMemoryUtilization`
  together — memory-constrained tasks may appear CPU-idle but still need
  scaling

## Post-Recovery Verification

- ECS desired count stable for 30+ minutes
- ALB `HealthyHostCount` matches the desired count
- `UnhealthyHostCount` is 0
- No scaling activities in the last 15 minutes (steady state)
