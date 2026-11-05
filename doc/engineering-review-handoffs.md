# Engineering review handoffs and skill assessments

Status: reusable operator and agent guidance; no server behavior changes. Updated 2026-11-05.

A review request is a verified reviewer task or an active execution-review stage. A comment, mention, in_review status, or board approval alone is not assignment proof. A completed model run is not a review verdict.

- [PR Review Handoff](../skills/pr-review-handoff/SKILL.md): establish and verify one review route, link its exact PR SHA, and retain independent review.
- [Agent Skills Assessment](../skills/agent-skills-assessment/SKILL.md): assess active instruction revisions, actual skill resolution and task routing, then repair through supported APIs with readback evidence.
- [Code Review Guardian](../skills/code-review-guardian/SKILL.md): distinguish structured review-stage decisions from separate blocker-task handoffs.

## Applying this in a company

Import/select the desired skill through the company's supported skill APIs or administration UI. Merely committing SKILL.md does not install it or assign it to agents. Replace stale instruction references, sync the relevant agent selection, inspect warnings, and verify the active instruction revision and resolved skill file. Preserve unrelated skills and role-specific permissions.

PR authors create or verify the review assignment. Coordinators verify the handoff without taking over code work. Reviewers record a verdict tied to the current head, submit the structured decision when a stage exists, and return changes to the implementer. Deployment executors retain their existing plan/board gates; technical review does not authorize cluster changes. Specialist non-PR agents need no implementation workflow merely because their role is engineer.

For every assessment record configuration changes separately from observed subsequent-run behavior. A running agent may still hold an earlier admitted snapshot; do not interrupt or restart it without authorization. Preserve paused state. Missing instruction bundles or unresolved skill sources remain explicit exceptions.
