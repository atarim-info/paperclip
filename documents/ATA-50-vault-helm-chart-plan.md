# Plan: Vault Helm Chart (ATA-50)

## Status

- **Status**: Draft
- **Owner**: DevOps Engineer
- **Date**: 2026-06-29
- **Primary Issue**: ATA-50

## Problem Statement

Paperclip's secrets management system supports a HashiCorp Vault provider backend, currently in `coming_soon` status. When the Vault runtime module ships, operators will need a running Vault instance to use as a provider vault backend. Currently Paperclip has:

- No Kubernetes infrastructure (ECS Fargate is the documented cloud deployment)
- No Helm charts or K8s manifests
- Manual deployment docs only

A Vault Helm chart provides the standardized, repeatable deployment path for operators who run Paperclip on Kubernetes and want to use Vault for secrets management.

## Goals

1. Create a Helm chart for deploying HashiCorp Vault in dev and production modes
2. Support Paperclip's Vault provider configuration (address, mount path, auth method)
3. Include sensible defaults for Paperclip use cases (JWT/OIDC auth, KV v2 engine)
4. Document Vault initialization and Paperclip integration

## Non-Goals

- The Vault runtime provider module (separate issue)
- Migration of existing Paperclip ECS deployment to K8s
- Multi-cluster or DR Vault setup
- Vault auto-unseal with cloud KMS (add in follow-up)

## Options Analysis

### Option A: Wrapper around official HashiCorp chart (recommended)

Use `hashicorp/vault` as a dependency chart, adding Paperclip-specific defaults and documentation as a wrapper.

**Pros:**
- Leverages HashiCorp's maintained chart (security updates, best practices)
- Thin layer — minimal maintenance
- Operators can still use the upstream chart directly
- `helm dependency update` pulls the official chart

**Cons:**
- Adds a chart dependency
- Some configuration is controlled upstream, limiting Paperclip-specific customization

### Option B: Standalone chart from scratch

Write templates from zero.

**Pros:**
- Full control over every template
- No dependency management
- Can match Paperclip conventions exactly

**Cons:**
- Duplicates HashiCorp's effort
- Must track upstream security updates manually
- Significantly more code to maintain

### Option C: Raw K8s manifests (no chart)

Provide YAML manifests in a `k8s/` directory.

**Pros:**
- Simplest to author
- No Helm knowledge needed
- Matches the TASK-BREAKDOWN.md structure

**Cons:**
- No templating (different envs = duplicated files)
- No release management
- Harder to share/distribute

**Recommendation: Option A** — wrapper chart with the official `hashicorp/vault` dependency. Best balance of maintainability, flexibility, and security.

## Chart Structure

```
charts/vault/
├── Chart.yaml                  # Chart metadata + dependency on hashicorp/vault
├── values.yaml                 # Paperclip defaults + overrides
├── templates/
│   ├── NOTES.txt               # Post-install notes (init instructions)
│   └── _helpers.tpl            # Shared template helpers
├── ci/                         # CI test values (for helm lint --values)
│   └── default-values.yaml
└── README.md                   # Paperclip-specific usage docs
```

Paperclip-specific values in `values.yaml` will configure:

| Setting | Default | Purpose |
|---------|---------|---------|
| `server.ha.enabled` | `false` | Dev mode (single pod); production can opt in |
| `server.dev.enabled` | `true` | Dev mode for local/testing — auto-unsealed |
| `injector.enabled` | `false` | Agent injector not needed for Paperclip |
| `ui.enabled` | `true` | Vault UI for operator visibility |
| `server.extraVolumes` | — | Mount Paperclip config |
| `server.extraEnvironmentVars` | — | Pass Paperclip-specific env |

## Integration with Paperclip Vault Provider

When the Helm chart deploys Vault, the operator:

1. Initializes Vault (`vault operator init`)
2. Unseals (`vault operator unseal`)
3. Enables KV v2 secrets engine at Paperclip's mount path (default `paperclip/`)
4. Enables auth method (JWT/OIDC for Paperclip workload identity, or token for simpler setups)
5. Configures a Paperclip provider vault pointing at the Vault address

The Helm chart's `NOTES.txt` will print these post-install steps.

## Implementation Plan

1. **Phase 1: Chart scaffold** — `Chart.yaml`, `values.yaml`, basic templates
2. **Phase 2: CI / lint** — Add `helm lint` to CI for chart validation
3. **Phase 3: Documentation** — `README.md`, post-install `NOTES.txt`
4. **Phase 4: Integration guide** — Document how to connect Paperclip to the deployed Vault

## Open Questions

1. Should the chart live in `charts/vault/` in this repo, or in a separate `paperclip-charts` repo?
   - Recommendation: start in this repo at `charts/vault/` for proximity to Paperclip releases
2. Should we include a Paperclip-specific `values.paperclip.yaml` with preconfigured defaults?
   - Recommendation: yes, as `charts/vault/values.paperclip.yaml`
3. Dev mode vs production mode — should the default values.yaml target dev for quickstart?
   - Recommendation: `dev.enabled: true` by default; documented HA path for production

## Dependencies

- Helm 3.x
- Kubernetes cluster (for actual deployment)
- Official HashiCorp Vault Helm chart (dependency)

## Approval

Requires CTO approval before implementation.
