---
name: pr-review-handoff
description: Establish and verify a Guardian review assignment for an implementation PR before requesting board approval or reporting review readiness.
---

# PR review handoff

Use when an implementation PR is ready for independent review, including infrastructure, Helm, manifests, CI/CD and runbooks. A comment, @mention, in_review status, or board approval does not create a reviewer assignment.

1. Read the implementation task, its executionPolicy/executionState, related review tasks and current PR head SHA. Search for an existing matching review task before creating one.
2. If a supported execution review stage exists, request/enter that stage through the Paperclip review workflow. Verify a pending stage with Code Reviewer/Guardian as current participant and the original implementer as returnAssignee. Do not also create a duplicate review task.
3. Otherwise create a separate child review task assigned to Code Reviewer/Guardian. Include repository and PR URL, exact head SHA, scope, acceptance criteria, validation evidence, known gaps and a link to the implementation parent. Verify the created task's ID, parent, assignee and actionable status with a fresh GET. A text line saying Assigned to Guardian is insufficient.
4. Post the review task/stage reference, PR URL and exact SHA on the implementation task. Record the task disposition using supported Paperclip tools. If assignment/admission is rejected, report the actual error and the responsible owner/action; do not claim review was requested successfully.
5. Guardian independently records APPROVED or CHANGES REQUESTED with reviewed SHA, findings and evidence on the implementation parent. For an embedded stage Guardian must also submit its structured review decision. A model run succeeding or posting a summary is not a verdict.
6. Changes requested return code work to the original implementer via the existing stage, or explicit findings from the separate review child. Guardian does not implement its own review fixes. Re-review any changed PR head before approval is treated as current.
7. Request board approval after the required technical approval, checking for an existing matching approval first. Code review and board approval are distinct records. Do not merge, apply infrastructure or deploy without the authorization required by the task; this skill grants none.

Report review readiness only with a verified review assignment. Report review completion only with a verdict tied to the current PR head. Never substitute board approval for technical review.
