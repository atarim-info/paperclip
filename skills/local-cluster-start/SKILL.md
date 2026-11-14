---
name: local-cluster-start
description: Bind local Kubernetes work to the assigned task's existing Minikube profile and context, and start that profile once if it is stopped and startup is authorized.
---

# Task-bound local cluster access

Resolve `TASK_CLUSTER_PROFILE` and `TASK_KUBE_CONTEXT` from the assigned issue or
approved plan before targeted access. Record the issue and both parameters.
These are per-task bindings, never global defaults. Missing or conflicting
bindings require the responsible owner to resolve them before execution.
A reachable cluster or inherited current context is not evidence of assignment.

Prepare command prefixes after resolving the binding:

```bash
: "${TASK_CLUSTER_PROFILE:?Resolve the assigned profile first}"
: "${TASK_KUBE_CONTEXT:?Resolve the assigned context first}"
MINIKUBE=(minikube -p "$TASK_CLUSTER_PROFILE")
KUBE=(kubectl --context "$TASK_KUBE_CONTEXT")
HELM=(helm --kube-context "$TASK_KUBE_CONTEXT")
```

Verify that the exact profile is registered and that the selected context maps
to that cluster identity. Reject a mismatch before cluster operations. A different
context alias requires a verified mapping, not a naming guess.

- Pass the explicit profile on every targeted Minikube command, including status,
  start, addons, images, SSH, and service operations. Bare start/status and default
  or selected-profile fallback are prohibited. Global read-only discovery such as
  `minikube profile list -o json`, version, and help is allowed.
- Pass `--context` on every targeted kubectl command and `--kube-context` on
  every Helm command, including nested commands, pipelines and verification.
  Namespace and release names do not select a cluster. Never switch the global
  current context with `kubectl config use-context`.
- Inspect wrapper implementation before invocation. Supply task-local
  `MINIKUBE_PROFILE="$TASK_CLUSTER_PROFILE" KUBE_CONTEXT="$TASK_KUBE_CONTEXT"`
  only when the wrapper accepts and propagates them to every operation without
  fallback, global switching, or implicit profile creation. Comments alone do
  not prove enforcement. Route a reviewed source correction for unsafe wrappers.
- Preserve namespace, release, broker DNS, and resource names that happen to
  match another profile. Do not globally replace identifiers.

## Startup of an existing stopped profile

Respect explicit keep-stopped instructions and the task's approval boundaries.
When startup is authorized, start the exact registered profile once with:

```bash
"${MINIKUBE[@]}" start --keep-context --wait-timeout=3m0s
"${MINIKUBE[@]}" status
"${KUBE[@]}" get nodes
```

Use the approved native runner and preserve the saved configuration. Do not
require an already-reachable API as a prerequisite to starting a stopped profile.
Verify readiness after startup and before any separately authorized cluster write.
Container Running alone does not establish Kubernetes Ready.

A missing profile, identity mismatch, empty driver, runner denial, or failed
bounded start requires the exact target, error, actual state, owner, and next
action. Do not switch to another cluster, create/reset a profile, or retry in a
loop. Another running cluster is not acceptance evidence.

Startup does not authorize provisioning, Infrastructure apply, credential writes,
workload sync, production changes, deletion, reset, or teardown. Those operations
retain their own review and approval requirements.

## Verification cases

- Missing binding or conflicting identity: refuse before targeted calls.
- Unrelated current context: explicit calls target the assigned cluster and leave
  the current context unchanged.
- Registered stopped target: one bounded target-specific start, then readiness.
- Absent profile: no creation or fallback.
- Legacy wrapper with a default target: refuse until reviewed source correction.
- Namespace matching another profile: preserve the namespace and scope the cluster.

Verify the assigned managed skill's installed version after updates. A successful
save or current-version ID alone does not prove the runtime link was refreshed.