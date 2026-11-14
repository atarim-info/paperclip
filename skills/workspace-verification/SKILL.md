---
name: workspace-verification
description: Verify the task workspace preference and resolved run CWD before repository access in Paperclip; use for CWD mismatch reports, reused execution workspaces, and shared project workspaces.
---

# Verify task workspace preference and CWD

Before repository work, inspect the effective task Execution workspace / Workspace preference, `executionWorkspacePreference`, `executionWorkspaceSettings.mode`, `executionWorkspaceId`, `currentExecutionWorkspace`, and the admitted current run context. Use `get_workspace` or the issue/workspace API when available. A pending selection takes effect on a future admission; it does not relocate the current run.

| Effective task preference | Required check |
|---|---|
| `reuse_existing` | Require an existing execution workspace ID and CWD bound to the assigned issue/company/project and consistent with the current run. Compare `realpath .` against the bound execution CWD. A verified reused `isolated-workspace-attempts/<company>/<issue>/<attempt>/workspace` is valid even when its underlying workspace mode is `isolated_workspace`. |
| `shared_workspace` | Compare `realpath .` against the configured project workspace CWD. Any current execution binding must agree with that shared location. |
| `isolated_workspace` | Do not apply the reuse/shared exception. Stop and report that verified `reuse_existing` or `shared_workspace` must be selected before using this exception. |
| Absent/inherited | Resolve the effective preference from authoritative task/run metadata before proceeding. |

Task preference and the bound workspace's underlying mode are different properties: explicit `reuse_existing` may legitimately reuse a previously isolated workspace. Do not reject that case just because `executionWorkspaceSettings.mode` describes an isolated workspace. Conversely, a directory name or non-null workspace ID alone does not prove reuse.

Resolve symlinks on both paths. A verified reused execution CWD need not equal the project source checkout. For missing/conflicting metadata or a genuine CWD mismatch, stop repository work and report the preference, binding ID, actual and expected resolved paths, and the needed correction. Do not switch checkouts or change workspace selection just to make a path comparison pass. Once verified, continue the authorized task in its bound workspace.

This is a company operating rule for workspace verification, not authorization to access another task/company workspace or bypass sandbox, approval, or API permissions. Existing no-task heartbeat and server-repository restrictions still apply.
