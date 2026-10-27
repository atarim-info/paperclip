---
name: deployment-engineer-runner
description: Recall supplied image inputs and recover the authorized native Docker/Buildx runner when Deployment Engineer resumes image-build/import work in WSL, including writable client state and Docker Hub credential-helper failures.
---

# Deployment Engineer runner

Use the task's recorded inputs and authorization before asking the human for them again. For the existing seven-image handoff, read [references/ata1084-handoff.md](references/ata1084-handoff.md). It contains the exact supplied commits, contexts, native runner path, recovery evidence, and scope limits. Treat it as dated evidence: the current task and any later explicit decision take precedence.

## Resume from recorded evidence

1. Read the current task, answered interactions, latest comments, effective workspace binding and source manifest. Resolve what was supplied, what was verified, and what remains blocked.
2. Verify staged source archive checksums and declared immutable source revisions. Source archives without `.git` do not inherit the enclosing repository's HEAD. Use authorized source access if inputs are missing; do not request raw host tokens merely to repeat an unavailable GitHub operation.
3. Inspect the task-local runner before using it. Check Docker, the explicit approved Minikube profile and the selected Buildx builder once. A previous host success does not prove access inside the current agent boundary.
4. Resume only the already approved scope. Keep source revisions, image tags, image IDs/digests, commands, timestamps and import evidence. Passing readiness or Dockerfile checks does not prove an image was built or imported.

## Classify runner failures

| Failure | Normal recovery |
|---|---|
| Windows Docker wrapper or credential helper emits WSL `/proc` / vsock errors | Use the authorized native Linux CLI and the existing daemon endpoint. Do not fall back to Windows interop in the same failing boundary. |
| Buildx client files have the wrong owner | Report exact path, owner and mode. An authorized host operator can repair the specific files. Do not use root builds or recursive permission changes. |
| Buildx activity/config is mounted read-only | Keep sandbox controls unchanged. Put Buildx client state under the already writable task directory with supported `BUILDX_CONFIG`. Ownership repair cannot fix a read-only mount. |
| `desktop-linux` uses an incompatible named-pipe endpoint | Select the existing Linux-compatible `default` builder explicitly. Do not delete builders to hide an unrelated warning. |
| Docker Hub public-base resolution invokes a failing Windows helper | Use an authorized task-local `DOCKER_CONFIG` containing no credentials for anonymous public pulls. Keep global Docker credentials unchanged. This profile does not authorize private registry access or publishing. |
| Registry authentication or rate limiting persists | Report the distinct registry error and obtain normal scoped registry access or an authorized host executor. Do not expose credentials or alter sandbox controls. |

## Keep recovery within the task

Use a child-command environment for the native CLI, daemon endpoint, `BUILDX_CONFIG` and public-only `DOCKER_CONFIG`. Store client state outside Docker source contexts. Inspect existing settings before replacing any file. Never copy host credential stores into the workspace, grant broader runtime permissions, remount home, restart all WSL workloads or recreate a profile to avoid an unresolved boundary error.

For build/import-only work, leave deployment, GitOps reconciliation, merge, credentials and Infrastructure changes with their respective owners. A saved handoff is not approval for a different task or environment. On a new failure, preserve successful work and report the exact failing step instead of reopening answered prerequisite questions.
