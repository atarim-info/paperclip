---
name: code-review-guardian
description: >
  Company-wide post-code-review and post-merge procedures for Paperclip agents.
  Use when a code review verdict lands on a pull request (approved or rejected),
  when review rejects must be routed back to a blocked task, when releasing a
  review block and handing work back to the responsible agent, when asking the
  board to approve a PR, or when a PR is merged (checkout main and open a
  graphify update task for the dedicated Graphify agent). Triggers: code review
  done, review rejected, fix rejects, release block, approve PR, PR merged,
  graphify update after merge.
---

# Code Review Guardian

Two mandatory procedures wrap every code review. They are **company-wide**: they apply to any
project that tracks work with Paperclip issue keys and ships through PRs (UTMS, backoffice,
infrastructure, ...). The **Code Reviewer/Guardian** agent owns Procedure 1; whoever confirms
the merge owns Procedure 2.

Hard rules inherited from project contributor guides — they always apply:

- **Never merge a PR or mark its issue `done` before the board approves the PR.**
- Express "A is blocked by B" with first-class blockers (`blockedByIssueIds`), never free-text.
- Respect the blocked-task dedup rule: no re-checkout, no re-comment without new context.

---

## Procedure 1 — Post code review (Code Reviewer/Guardian)

Runs as soon as a review verdict exists while the reviewed work issue sits `blocked` behind
the review issue.

### Step 1 — Return to the blocked task

Fetch the issue you were woken on (`GET /api/issues/{issueId}`) and read `blockedBy` to locate
the review edge. Confirm the PR URL and the verdict before changing any state.

### Step 2 — Comment the code-review status

Post **one** comment on the blocked task summarizing where the review stands:

```markdown
## Code review status — <VERDICT>

PR: <pr-url>
Reviewer: Code Reviewer/Guardian

Rejects (must fix):
1. <file:line> — <what is wrong and why>
2. ...

Non-blocking notes:
- ...
```

For this multiline markdown, use the newline-preserving comment helper from the `paperclip`
skill (heredoc / `scripts/paperclip-issue-update.sh` / `jq --arg`) — never hand-inline
markdown into a one-line JSON string.

### Step 3 — Release the block

Remove the review issue from the task's blockers (keep any unrelated blockers) and move the
task out of `blocked`:

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "blockedByIssueIds": ["…only remaining blockers…"], "status": "todo" }
```

Do not enter `in_progress` yourself — the owner enters it by checkout.

### Step 4 — Ask the responsible agent to fix rejects and continue regular work

Ensure `assigneeAgentId` points at the responsible agent (reassign if the review took over
ownership), then make the hand-back explicit in the thread:

> @\<responsible agent\>: please fix the listed rejects and continue with your regular work.

Removing the blocker wakes them (`PAPERCLIP_WAKE_REASON=issue_blockers_resolved`); the comment
tells them why and what to fix.

### Step 5 — Ask the board to approve the PR

Once the responsible agent confirms the rejects are fixed and pushed, request board approval
of the PR:

```json
POST /api/companies/{companyId}/approvals
{
  "type": "request_board_approval",
  "requestedByAgentId": "{your-agent-id}",
  "issueIds": ["{issue-id}"],
  "payload": {
    "title": "Approve PR for <ISSUE-KEY>",
    "summary": "<pr-url> — review round N passed; all rejects fixed.",
    "recommendedAction": "Approve the PR and proceed to merge."
  }
}
```

Leave the issue `in_review` while waiting. After approval: merge (squash preferred), delete
the branch, then run **Procedure 2**.

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

Create a **new** issue so the knowledge graph never goes stale:

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

Merged PR: <pr-url> (<ISSUE-KEY>)

1. In the `<repo>` checkout run `graphify . --update` (incremental; cheap).
2. Sync the refreshed output (`graph.json`, `graph.html`, `GRAPH_REPORT.md`,
   `manifest.json`, `cache/`) to the shared upper-level location
   `_default/graphify-out/<repo>/` — the shared location, not per-repo git
   history, is the source of truth.
3. Do **not** commit `graphify-out/` into the repository (see hard rules in the
   `graphify` skill).
4. If docs/specs/ADRs changed, ingest the distilled content into LightRAG
   (`POST $LIGHTRAG_URL/documents/text` with `file_source` set to the doc path).
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
that run — mint the token with the owning run id (see the `paperclip-issue` skill) instead of
forcing writes.
