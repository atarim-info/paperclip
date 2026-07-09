---
title: Configuration Drift
summary: Missing secrets, wrong environment variables, and config inconsistency
severity: High
---

# Configuration Drift

## Overview

Configuration drift occurs when the running service has different
configuration than what is defined in the source of truth (task definition,
secrets manager, deployment config). This can cause hard-to-diagnose issues
ranging from silent feature degradation to complete service failure.

## Symptoms

- Authentication failures (Better Auth errors)
- Adapter execution failures (missing API keys)
- Feature-specific errors (e.g., S3 uploads fail, but app loads)
- Health check passes but specific routes return errors
- Deployment succeeds but new behavior doesn't take effect
- Logs show `missing env`, `undefined variable`, or `secret not found`
- Agent runs fail with credential errors

## Initial Diagnosis

### 1. Compare running task env vs task definition

```bash
# Get the running task ARN
TASK_ARN=$(aws ecs list-tasks --cluster paperclip --service-name paperclip-server --desired-status RUNNING --query 'taskArns[0]' --output text)

# Describe the task (network, container details)
aws ecs describe-tasks \
  --cluster paperclip \
  --tasks $TASK_ARN \
  --query 'tasks[0].containers[0].{name:name,image:image,lastStatus:lastStatus}'
```

### 2. Check secrets resolution

```bash
aws secretsmanager list-secrets \
  --filter Key="name",Values="paperclip" \
  --query 'SecretList[*].{name:Name,lastChangedDate:LastChangedDate,rotationEnabled:RotationEnabled}'
```

### 3. Check application config logs

```bash
aws logs tail /ecs/paperclip --since 30m | grep -i "config\|env\|secret\|variable"
```

### 4. Compare deployed image tag with expected

```bash
# Expected tag from the latest CI/CD run vs what's running
aws ecs describe-services \
  --cluster paperclip \
  --services paperclip-server \
  --query 'services[0].deployments[*].{status:status,revision:taskDefinition,rolloutState:rolloutState}'
```

## Recovery Procedures

### Scenario A: Missing or Expired Secrets in AWS Secrets Manager

**Symptoms:** Agent runs fail with `401` or `403` from LLM providers. Secrets
show `LastChangedDate` from before a known rotation.

1. **Verify the secret exists and is readable:**

```bash
aws secretsmanager get-secret-value \
  --secret-id paperclip/anthropic-api-key \
  --query '{created:CreatedDate,lastChanged:LastChangedDate,versionStages:VersionIdsToStages}'
```

2. **Update the secret with the correct value:**

```bash
aws secretsmanager put-secret-value \
  --secret-id paperclip/anthropic-api-key \
  --secret-string "new-api-key-value"
```

3. **Force a task restart** to pick up the new secret:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --force-new-deployment
```

### Scenario B: Environment Variable Mismatch

The task definition has different environment variable values than expected.

1. **Fetch the current task definition:**

```bash
aws ecs describe-task-definition \
  --task-definition paperclip-server \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

2. **Register a corrected task definition:**

```bash
# Edit the task definition JSON locally, then register
aws ecs register-task-definition --cli-input-json file:///tmp/paperclip-task-def.json
```

3. **Update the service to use the new revision:**

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --task-definition paperclip-server:<new-revision>
```

### Scenario C: Strict Mode Blocking Secrets

If `PAPERCLIP_SECRETS_STRICT_MODE=true` prevents the server from resolving
environment variables:

1. Check if the required secrets exist as `secret_ref` entries in the
   environment binding.
2. If a secret was set as a plaintext env var instead of a reference, convert
   it:

```bash
pnpm paperclipai secrets migrate-inline-env --company-id <company-id> --apply
```

3. Or temporarily disable strict mode (not recommended for production):

```bash
PAPERCLIP_SECRETS_STRICT_MODE=false
```

### Scenario D: Deployment Config Not Applied

The deployment was updated but the running service still has the old config.

1. Check if the service's **deployment controller** is `ECS` (not `CODE_DEPLOY` or `EXTERNAL`).
2. Verify the new task definition revision is active:

```bash
aws ecs describe-services \
  --cluster paperclip \
  --services paperclip-server \
  --query 'services[0].taskDefinition'
```

3. If the primary deployment is not the latest revision, force an update:

```bash
aws ecs update-service \
  --cluster paperclip \
  --service paperclip-server \
  --task-definition paperclip-server:latest \
  --force-new-deployment
```

### Scenario E: Migration Between Deployment Modes

If the deployment mode changed (e.g., `local_trusted` → `authenticated`) but
the server didn't pick it up:

1. **Verify the mode env var:**

```bash
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private
PAPERCLIP_BIND=lan
```

2. **Check the deployment config file:**

```bash
cat ~/.paperclip/instances/default/config.json | grep deployment
```

3. **Run `paperclipai doctor`** to validate:

```bash
pnpm paperclipai doctor
```

4. **Restart the server** after fixing any misconfigurations.

## Prevention

- Use IaC (Terraform, CloudFormation) for all ECS task definitions
- Pin task definition revisions in deployment pipelines
- Run `paperclipai doctor` as a post-deployment validation step
- Audit `AWS SecretsManager` for secrets that have never been rotated
- Use `PAPERCLIP_SECRETS_STRICT_MODE=true` in non-local deployments to catch
  inline plaintext secrets
- Store all non-sensitive configuration in environment config files, not in
  individual agent configs

## Post-Recovery Verification

- `/api/health` returns 200
- Agent runs successfully (adapter auth works)
- All features that were failing now work
- Running task definition matches the expected revision
- Secret resolution succeeds
- No config-related errors in logs

## Root Cause Analysis Checklist

- [ ] Was a secret rotated without updating the Secrets Manager entry?
- [ ] Was a new env var added to the code but not to the task definition?
- [ ] Was strict mode enabled without migrating inline secrets?
- [ ] Was the incorrect task definition revision deployed?
- [ ] Was a deployment mode change applied without a server restart?
- [ ] Was there a config file change that didn't propagate?
