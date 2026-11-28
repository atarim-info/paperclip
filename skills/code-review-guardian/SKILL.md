---
name: code-review-guardian
description: Use when a Paperclip agent receives an approved or rejected PR review, routes requested changes or releases a review blocker, requests board approval, or confirms a PR merge and its Graphify follow-up.
---

# Code Review Guardian

These procedures preserve the task's explicit merge/deployment authorization; an approval record does not override a no-merge or no-deploy instruction.

Two mandatory procedures wrap every code review. They are **company-wide**: they apply to any
project that tracks work with Paperclip issue keys and ships through PRs (UTMS, backoffice,
infrastructure, ...). The **Code Reviewer/Guardian** agent owns Procedure 1; whoever confirms
the merge owns Procedure 2.

Hard rules inherited from project contributor guides — they always apply:

- **Never merge a PR or mark its implementation issue `done` before its required board approval.** A standalone review task finishes after its APPROVED or CHANGES REQUESTED verdict is persisted; that does not authorize merge or deployment.
- Express "A is blocked by B" with first-class blockers (`blockedByIssueIds`), never free-text.
- Respect the blocked-task dedup rule: no re-checkout, no re-comment without new context.
- **Only the dedicated Graphify agent runs graph updates.** The merge owner creates a separate task for that agent and never runs Graphify as part of the contributor or review task.

---

## Choose the review mechanism first

Read the task executionPolicy/executionState before applying Procedure 1. If an embedded execution-review stage exists, use its supported structured APPROVED or CHANGES REQUESTED decision and verify persistence. Record the repository, PR URL, exact reviewed head SHA, findings and evidence on the implementation parent. The stage owns return-assignee routing; do not manually remove blockers or patch assignees to bypass it. A written summary or successful run alone does not complete this stage.

Procedure 1 below applies only to a separate review-task/blocker workflow. Confirm the real review child, preserve unrelated blockers and respect mutation authorization. For creating or verifying either review assignment, use [PR Review Handoff](../pr-review-handoff/SKILL.md). Return code repairs to the original implementer; the reviewer remains independent. Re-review any changed PR head before treating approval as current.

## Procedure 1 — Post code review (Code Reviewer/Guardian)

Use the current upstream `paperclip` skill for task writes, execution-review stages,
trust boundaries and verified closeout. Paperclip tasks are not GitHub issues;
use GitHub tools for the PR and Paperclip tools/API for task state.

### Step 1 — Read the assignment and review the exact head

Read the assigned review issue, its parent and any execution-review stage. Verify
the live PR head. Record APPROVED or CHANGES REQUESTED with that exact SHA,
findings, validation evidence and remaining limits. Source corrections belong to
the implementer. A changed head requires another review.

### Step 2 — Persist the verdict in the authorized review path

For an embedded review stage, submit its supported structured decision and verify
the saved decision and participant transition. For a standalone review child,
save the verdict on that child. Standard-trust reviewers may also report to their
direct parent where allowed. A low-trust or review-contained reviewer must use its
governed review path; the coordinator relays its result to the parent. A denied
parent write does not grant cross-task authority.

For API runtimes use the run's injected `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`
and genuine `PAPERCLIP_RUN_ID`. Native runtimes use their supplied completion and
review tools. Resolve the verified-write helper relative to the installed
`paperclip` skill, not the project workspace. A local todo or final model message
is not a Paperclip mutation.

### Step 3 — Finish the standalone review assignment

For a completed standalone review, use the supported task update with
`status: "done"` and the verdict report, then read back the child and verify Done.
Both verdicts complete the review assignment; neither completes the implementation
parent or grants board approval. Save reports before the final status mutation;
additional comments on a Done task may wake it again.

If a write fails, report its actual error and the unpersisted action. Follow the
current `paperclip` skill's failure path rather than claiming completion or
repeating unsupported success summaries. Preserve unrelated dependencies,
ownership and approval gates.

### Step 4 — Hand the result to the implementation owner

The coordinator reads the persisted review result and continues the implementation
through supported task/dependency controls. Changes requested return to the
implementer. Approval at an unchanged head enables the separate board approval
handoff. Reuse an existing matching review or approval rather than creating a
duplicate. Finish the review child so an implementation dependency does not wait
on its own correction. Do not change unrelated blockers or another run's checkout.

Only an explicitly authorized merge owner acts after board approval and confirms
the provider's merge before Procedure 2 applies.

---

## Procedure 2 — Upon PR merge

Runs immediately after a PR is confirmed merged into `main`.

### Step 1 — Sync local main

In the project repository:

```bash
git checkout main
git pull --ff-only origin main
git branch -d <feature-branch>
```

If the merged issue is not yet `done`, close it now with a comment linking the merge commit.

### Step 2 — Generate a graphify update task for the dedicated agent

Create a **new, separate** issue assigned to the dedicated Graphify agent so the knowledge graph never goes stale. Only that agent executes the update task; the merge owner and reviewer must not run Graphify commands.

```json
POST /api/companies/{companyId}/issues
{
  "title": "Graphify update: <repo> after <ISSUE-KEY> merge",
  "description": "<template below>",
  "assigneeAgentId": "{dedicated-graphify-agent-id}",
  "priority": "medium",
  "status": "todo"
}
```

Description template:

```markdown
## Graphify update after merge

Only the dedicated Graphify agent may execute this task.

Merged PR: <pr-url> (<ISSUE-KEY>)
Repo: <repo> (checkout: `/home/vladimir/projects/Projects/paperclip-projects/<repo>`)
Target branch: `main`
Merge commit: <sha>

Preconditions — verify before running; if any fails, comment on this task and stop:
1. The PR is merged with `<repo>`'s base branch `main` (not another branch, not still open).
2. The `<repo>` checkout at the shared root is on `main` and fast-forwarded
   (`git -C <root>/<repo> pull --ff-only origin main`). Do not switch branches; report a blocker instead.
3. Every worktree dir at the root (`<repo>-wt-*`, `<repo>-ATA-*`, `<repo>-ata*`, e.g.
   `backoffice-ata720p1`, `infrastructure-ATA-229`) is listed in `<root>/.graphifyignore`, so the
   graph never picks up a feature-branch checkout.

Then:
4. From the shared projects root (`/home/vladimir/projects/Projects/paperclip-projects`)
   run `graphify . --update` (incremental; cheap) — the root scan, never a run from
   inside a checkout or worktree.
5. Verify the refreshed shared graph at `graphify-out/` (`graph.json`,
   `GRAPH_REPORT.md`, `manifest.json`, `cache/`). This single shared `graphify-out/`,
   which lives outside every repository, is the source of truth. There is **no**
   per-repo `graphify-out/<repo>/`.
6. `graph.html` is only auto-written for graphs under the 5000-node viz cap. For
   larger graphs, emit the aggregated view explicitly:
   `graphify export html --graph graphify-out/graph.json --labels graphify-out/.graphify_labels.json`.
7. Do **not** commit `graphify-out/` into any repository (see hard rules in the
   `graphify` skill).
8. Documentation ingestion is handled by the Documentation repository GitHub Actions
   workflow. Do not initiate or delegate a LightRAG sync task after review or merge.
   Report workflow failures without automatically creating follow-up sync work.
```

**Finding the dedicated agent:** list agents with
`GET /api/companies/{companyId}/agents` and pick the one whose name contains `Graphify`.
If no such agent exists, stop and hire one first via the `paperclip-create-agent` skill —
never dump graphify updates onto a random engineering agent.

---

## API quick reference

| Action          | Call                                                              |
| --------------- | ----------------------------------------------------------------- |
| Read issue      | `GET /api/issues/{issueId}`                                       |
| Post comment    | `POST /api/issues/{issueId}/comments` (newline-preserving helper) |
| Update issue    | `PATCH /api/issues/{issueId}`                                     |
| Release block   | `PATCH /api/issues/{issueId}` `{ "blockedByIssueIds": [...] }`    |
| Reassign        | `PATCH /api/issues/{issueId}` `{ "assigneeAgentId": "..." }`      |
| Board approval  | `POST /api/companies/{companyId}/approvals`                       |
| Create issue    | `POST /api/companies/{companyId}/issues`                          |
| List agents     | `GET /api/companies/{companyId}/agents`                           |
| List projects   | `GET /api/companies/{companyId}/projects`                         |

All requests: `Authorization: Bearer $PAPERCLIP_API_KEY`, header
`X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID`. An issue checked out by another run is owned by
that run. Wait for release or use supported execution management; never mint, borrow
or substitute another run's credentials or attribution.
