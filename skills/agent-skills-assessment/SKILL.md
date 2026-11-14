---
name: agent-skills-assessment
description: Audit and repair Paperclip agent instruction revisions, skill resolution and engineering review routing; distinguish configuration evidence from runtime compliance.
---

# Assess Paperclip agent skills and instructions

Use when auditing or repairing Paperclip agent instructions, skill assignments or engineering review handoffs. Assess configuration and observed behavior separately.

## Evidence collection

1. Resolve the requested company and agent roster through authenticated Paperclip APIs. Use the existing board credential when available. Never print tokens, whole credential files, environment values or unrelated agent configuration.
2. Identify roles and scope: PR author, coordinator, reviewer, deployment executor or specialized maintenance agent. Record paused/running status; configuration changes do not authorize resuming or interrupting runs.
3. Read the active versioned instruction entry through GET /api/agents/:id/instructions-bundle/file?path=AGENTS.md. Record revision ID/content hash. A filesystem copy or YAML frontmatter alone does not prove the instructions admitted to a run.
4. Compare instruction references, adapterConfig.paperclipSkillSync.desiredSkills, GET /api/agents/:id/skills, company skill metadata and actual SKILL.md content. Check currentVersionId, file inventory, source availability, compatibility and sync warnings. Missing metadata is a finding to investigate, not proof that a model failed to load a skill.
5. Inspect a representative issue, its executionPolicy/executionState, assignee, related review children, exact PR head, CI checks, comments, recovery action and run outcome. A successful run is not proof of a completed review decision.
6. Classify findings: missing requirement, contradictory/stale instruction, unavailable/unassigned skill, failed routing/runtime, or behavioral noncompliance despite a present rule. Cite the evidence and uncertainty.

## Required engineering review contract

- A PR Created comment, @mention, Assigned to text, in_review status or board approval does not establish reviewer assignment.
- Prefer the task's existing execution-review stage. Verify Guardian is its current participant and the original implementer is returnAssignee. Use supported transitions; do not also create a duplicate review task.
- Without a review stage, search for an existing matching review child. Create one only if missing, assigned to Guardian with parent, repository/PR URL, exact head SHA, scope, checks and known gaps. Freshly verify ID, parent, assignee and actionable state.
- Report review requested only with a verified task/stage link. Require APPROVED or CHANGES REQUESTED with exact reviewed SHA and evidence on the implementation parent. Embedded stages also require a persisted structured decision.
- Return fixes to the implementer; preserve reviewer independence. Changed heads require re-review. Keep technical review separate from board approval, merge and deployment authorization.

## Safe repair and verification

1. Preserve unrelated role rules, skills, secret references, lifecycle state, task ownership and workspace constraints. Do not modify specialist non-PR roles merely to make every agent identical.
2. Use supported APIs, not database edits. For managed instructions, PUT /api/agents/:id/instructions-bundle/file with the freshly read baseRevisionId (or supported baseHash); on conflict re-read and merge deliberately.
3. For a read-only/orphaned skill, create a managed versioned replacement rather than claiming its source was edited. Replace stale references in the relevant agent instructions and desired selections. Use POST /api/agents/:id/skills/sync with the supported assignment mode; preserve unrelated selections and inspect warnings.
4. Read back instructions, revision, assigned skills and skill file content after each write. Record partial success accurately. Do not assume an in-flight run has refreshed; validate a subsequent admitted run before claiming behavioral compliance.
5. Publish an audit table: agent/role, pre-change evidence, action, instruction revision, skill version/sync outcome, remaining exceptions and behavior not yet observed. Exclude credential values.
6. Commit reusable engineering skill sources in the Paperclip fork; document instance rollout evidence in Documentation. Use isolated worktrees, preserve unrelated edits, open reviewable PRs and leave merge to its required authorization. Save this procedure in the local paperclip-wsl skill for future assessments.

## Acceptance scenarios

- No review stage and no existing child: one verified Guardian review task, with parent and exact SHA.
- Existing stage or matching child: reuse it without duplication.
- Comment-only handoff: identify it as unverified, even if status is in_review.
- Missing skill version/source: inspect resolution and use a managed replacement when needed.
- Guardian finishes without a structured stage decision: review remains incomplete.
- Paused agent: configuration can be updated without resuming it; no claim about unobserved runtime behavior.
