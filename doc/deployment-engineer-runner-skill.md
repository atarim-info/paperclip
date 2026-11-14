# Deployment Engineer runner skill

`skills/deployment-engineer-runner` records supplied build inputs and teaches the agent to distinguish native Docker transport, Buildx ownership, read-only client state, and registry credential-helper errors. The skill entry point contains the reusable procedure. Its dated reference contains the company handoff and four exact source revisions.

## Install and assign

Import this directory into the intended company skill library using the supported Skills UI/API or CLI. Inspect the resulting skill key and version. Add it to the Deployment Engineer with `skills agent sync --mode add --skill <installed-key>`; preserve the other assignments. Confirm the skill is desired, managed and configured/installed through `skills agent list`.

Merging the source is not proof of runtime installation or assignment. The local company already has a separately managed companion skill. Updating this repository does not update that installed version or an already loaded agent context. An operator must publish the intended version and confirm the next run loads it.

## Evidence and scope

The recorded recovery verified native Docker and target-profile readiness. A later host Dockerfile check reached BuildKit and resolved public Maven/Temurin metadata using task-local writable Buildx state and a credential-free Docker profile. It completed with exit 0 and no warnings.

No complete seven-image build/import or workload deployment is established by this source change. The live task must record those results separately. The handoff's build/import-only approval does not permit deployments, merges, Infrastructure mutation, profile recreation, production rollout or teardown.

The public-only Docker profile is not suitable for private image pulls/pushes. If public Docker Hub access is rate-limited, use normal scoped registry access or an authorized host executor. Do not print credential values or copy host credential storage into task inputs.

## Validation cases

| Input/evidence | Expected result |
|---|---|
| Existing answered input question and matching staged manifest | Reuse the recorded pins and authority; do not request them again. |
| Root-owned Buildx file | Identify owner/mode and obtain a specific authorized repair. |
| Read-only home Buildx activity directory | Use task-local `BUILDX_CONFIG`; preserve the sandbox boundary. |
| Public image plus inherited `desktop.exe` credential store | Use the authorized public-only task profile, without copying credentials. |
| Private image or anonymous rate limit | Report the registry blocker; do not claim anonymous access is sufficient. |
| Host Dockerfile check passes | Report check success only; do not claim full image-build/import success. |
