# Workspace verification skill

The `skills/workspace-verification/SKILL.md` skill describes the fork's company operating rule for checking a task's workspace preference before repository access. It addresses the instruction failure described in [upstream issue #17829](https://github.com/paperclipai/paperclip/issues/17829). It does not change workspace provisioning, runtime authorization, or UI controls.

## Preference and binding

`reuse_existing` selects an existing execution workspace. Its underlying mode may still be `isolated_workspace`; compare the resolved CWD with the verified bound execution CWD. A directory under `isolated-workspace-attempts` can therefore pass without equaling the project source checkout.

`shared_workspace` requires the configured shared project path and a consistent current run binding. An explicit `isolated_workspace` preference does not receive the reuse/shared exception under this company rule. Resolve absent/inherited selections from authoritative task/run metadata. Pending selections apply on a later admission, not to an already-running process.

This rule is a fork operating policy. It does not mean isolated workspaces are invalid in upstream Paperclip. A directory name or non-null workspace ID alone does not establish valid reuse. Missing/conflicting metadata and genuine path mismatches still stop repository work.

## Installation and assignment

The new skill is a separate runtime skill. Adding it to the repository is not proof that an existing agent has it assigned. Inspect the company's skill library and agent assignments through the supported CLI/API. If the repository skill is not already available in the company library, import it from an authorized source:

```sh
npx paperclipai skills import --help
```

Use the local source directory `skills/workspace-verification` when importing from a checkout. Resolve the installed skill key from the library, then add it without replacing the agent's other skills:

```sh
npx paperclipai skills agent sync <agent-id> --company-id <company-id> --mode add --skill <installed-skill-key>
npx paperclipai skills agent list <agent-id> --company-id <company-id> --json
```

Run these with an authorized operator identity. A read-capable agent credential may create a company skill yet lack permission to assign it to another agent. Do not borrow run attribution, alter permissions, or edit database rows to bypass an assignment rejection.

Confirm the skill is desired and managed in the snapshot and inspect its configured/installed state. Ephemeral adapters may link it into the effective skills directory on the next run. Existing loaded contexts do not change in place. Align any agent instructions that still require project-source path equality with this skill before relying on the next run.

## Acceptance cases

| Case | Expected instruction outcome |
|---|---|
| `reuse_existing`, verified bound attempt, matching resolved CWD, underlying isolated mode | Continue in the reused attempt. |
| `shared_workspace`, matching resolved source path, consistent run binding | Continue in the shared workspace. |
| `shared_workspace`, unrelated isolated attempt CWD | Stop and report the mismatch. |
| Explicit `isolated_workspace` preference | Do not grant this reuse/shared exception. |
| Missing or conflicting binding metadata | Stop and report the missing/conflicting evidence. |
| Pending shared selection while the current admitted run still uses another binding | Keep the current root; do not treat a future selection as current relocation. |

Successful assignment proves configuration, not successful execution of a previously blocked task. Verify the next task run separately. The upstream UI recovery issue remains open.
