# Recorded deployment runner handoff — 2026-10-27

This is a dated company handoff. Verify current task authority and local state before reusing its pins or paths. It is not a universal deployment approval.

# Deployment Engineer runner handoff

Read this handoff before asking the user again for ATA-1084 build inputs, runner approval, GitHub credentials, or Buildx recovery. It records supplied inputs and observations from 2026-10-27. Inspect the current task, latest comments/interactions, and local manifest for superseding decisions. Historical evidence is not a fresh health check or authority for a different task/environment.

## Approved work and ownership

The human answered ATA-1084's image-input question with explicit authorization to build seven genuine images and import them only into the existing Minikube profile `ata911-e2e`. That authorization is recorded in the answered interaction `798b2337-3564-443b-aa32-381d94f88e23` on ATA-1084. Do not request the same authorization again unless the scope or inputs change.

Build/import only: no application deployment, Argo reconciliation, PR merge, Infrastructure mutation, production rollout, profile recreation, teardown, or change to other profiles. Preserve workloads and data. ATA-1070 owns deployment; ATA-1085 owns runtime credentials. Existing approval/review requirements still apply. No secrets belong in logs, comments, manifests, archives, or this skill.

## Exact supplied inputs

| Application | Repository | Immutable commit | Docker context / target |
|---|---|---|---|
| auth-service | atarim-info/utms | `8453aa8bbc5751464abf566c87d863e9dd69aeb8` | Repository root; Dockerfile target `auth-service` |
| rbac-service | atarim-info/utms | `8453aa8bbc5751464abf566c87d863e9dd69aeb8` | Repository root; target `rbac-service` |
| tenant-service | atarim-info/utms | `8453aa8bbc5751464abf566c87d863e9dd69aeb8` | Repository root; target `tenant-service` |
| user-service | atarim-info/utms | `8453aa8bbc5751464abf566c87d863e9dd69aeb8` | Repository root; target `user-service` |
| statistics-service | atarim-info/utms | `c94b990b27cd885a1bd9b532fd0a52eba9cb58b5` | Repository root; target `statistics-service` |
| backoffice-bff | atarim-info/backoffice | `ce19b42c62958c56cd9106155d5a03b1487a5db8` | `services/backoffice-server`, existing Dockerfile |
| backoffice-ui | atarim-info/backoffice | `b9f8c19261e586898a3e5f5ba759de4d207a7336` | `apps/backoffice-ui`, Dockerfile from PR #47 |

References: ATA-1080 prepared inventory for the four original UTMS services/BFF; ATA-1082 review of Backoffice PR #47; ATA-1081 Guardian approval and UTMS PR #78 for corrected statistics. Do not use rejected statistics commit `216ea72ca...`. Do not replace these pins with branch tips without the relevant review/approval.

## Source access already supplied

Task-local root:
`/home/vladimir/projects/Projects/paperclip-projects/devops/.ata1084-inputs`

The root contains `source-manifest.json`, `RECOVERY.md`, and clean source directories named `<repo>-<full-commit>` for all four commits above. The host's authorized GitHub login independently verified the exact commit API responses and downloaded archives at those SHAs; the manifest records archive SHA-256 values. Verify the archives against the recorded checksums when resuming. These are source archives without `.git`: the enclosing DevOps checkout HEAD is not their source revision.

Managed GitHub access in the previous agent run was unavailable. Do not request a raw GH_TOKEN merely to repeat `git ls-remote` when these verified inputs are present. Do not copy host credentials into the run. If staged inputs are absent or checksums conflict, report that specific source-integrity blocker and use the normal authorized source-access route.

## Native Docker and Minikube route

The default `/home/vladimir/.local/bin/docker` launches Windows `docker.exe`, which failed inside the agent boundary with WSL `UtilGetPpid` / `UtilBindVsockAnyPort` errors. The engine itself was healthy. Use the supplied task-local entry point:

```sh
RUNNER=/home/vladimir/projects/Projects/paperclip-projects/devops/.ata1084-inputs/run-native
"$RUNNER" docker info --format '{{.ServerVersion}}'
"$RUNNER" minikube -p ata911-e2e status
"$RUNNER" docker buildx inspect default
```

`run-native` prepends the task-local `runner-bin/docker` wrapper, sets `DOCKER_HOST=unix:///var/run/docker.sock`, and unsets `DOCKER_CONTEXT`. The wrapper uses `/usr/bin/docker` against that existing Unix socket. Inspect both wrapper files before using them. They change only child command environment; do not replace global Docker configuration, disable sandbox controls, or expose another daemon.

The host and the resumed agent both passed Docker Server `29.9.1` and target-profile readiness checks on 2026-10-27. Repeat bounded readiness checks for the current run; do not restart all WSL workloads or retry a failing interop/socket path repeatedly.

## Buildx recovery already performed

The first build failed before BuildKit: `open /home/vladimir/.docker/buildx/activity/default: permission denied`. Inspection found exactly two root-owned files under the user's Buildx directory:

- `/home/vladimir/.docker/buildx/activity/default`
- `/home/vladimir/.docker/buildx/current`

The authorized host repair changed those two files to `vladimir:vladimir` and preserved their `0600` mode. They were then writable by the runner user. `docker buildx inspect default` reported the existing builder running with BuildKit `v0.34.0`.

Use the existing Linux-compatible builder explicitly:

```sh
"$RUNNER" docker build --builder default --pull --progress plain --target <service> -t <image>:<source-sha> <verified-source-context>
"$RUNNER" minikube -p ata911-e2e image load <image>:<source-sha>
"$RUNNER" minikube -p ata911-e2e image ls
```

Omit `--target` for the Backoffice Dockerfiles. The stored `desktop-linux` builder uses an incompatible Windows named-pipe endpoint and can show an error in `buildx ls`; that is not evidence that `default` is unavailable. Do not delete or recreate builders merely to hide this warning. If ownership or access fails again, record the exact path/owner/mode and stop for authorized repair rather than using sudo builds, chmod 777, recursive ownership changes, or sandbox escalation loops.

Host verification of the Buildx repair is complete; successful execution of a full image build after that repair has not yet been established by this handoff. Do not turn prior success into a current build claim.

## Buildx read-only-home correction (latest runner setup)

A later agent build passed ownership checks but failed creating `~/.docker/buildx/activity/.tmp-default...` with `read-only file system`. This is distinct from the root-owned-file error: the agent boundary mounts that home state read-only. Do not repeat ownership repair for a read-only mount or ask for previously supplied approvals again.

The existing task-local `run-native` wrapper now sets:

```sh
export BUILDX_CONFIG=/home/vladimir/projects/Projects/paperclip-projects/devops/.ata1084-inputs/buildx-state
mkdir -p "$BUILDX_CONFIG"
```

This is Buildx's supported configuration/state/log location override. It uses the already writable task workspace with the same native Docker CLI, Unix socket, and `default` builder. It does not change sandbox controls, remount home, copy credentials, or create a privileged runner. Keep Docker authentication configuration unchanged; `BUILDX_CONFIG` is separate from `DOCKER_CONFIG`.

Host verification after the change: `docker buildx inspect default` reports running BuildKit v0.34.0. An actual auth-service Dockerfile check through `run-native docker build --builder default --check --progress plain --target auth-service ...` reached BuildKit, loaded base-image metadata and completed with exit 0 and no warnings. That proves host admission and Dockerfile checking, not a full image build or success inside a future agent boundary. The next agent run must verify its own command result once using the updated wrapper, then continue the already approved image-build/import scope. Use `--builder default` explicitly.

## Docker Hub credential-helper correction (latest)

The native agent build later reached BuildKit but failed on `error getting credentials` because the inherited Docker config selected `credsStore: desktop.exe`; that Windows helper hit the same WSL interop errors. No stored auth values existed in the inspected host config, and no credentials were copied or exposed.

The task-local `run-native` now also sets `DOCKER_CONFIG` to `/home/vladimir/projects/Projects/paperclip-projects/devops/.ata1084-inputs/docker-public-config`. Its config.json contains only `{"auths": {}}`, so public Docker Hub base-image resolution uses anonymous access without calling the Windows credential helper. Global Docker config/credentials remain unchanged. Existing `DOCKER_HOST`, task-local `BUILDX_CONFIG`, native CLI and explicit `default` builder remain in use. This profile is for public-base builds and local image import only, not private registry pulls or pushes.

After this change, the actual auth-service Dockerfile check through `run-native docker build --builder default --check` completed with exit 0 and no warnings; metadata for both maven and eclipse-temurin resolved successfully on the host. This does not prove full compilation, image creation or future agent execution. Resume using the same updated wrapper. If Docker Hub returns an authentication/rate-limit error, report it and use normal scoped registry access or the authorized host executor; never paste credentials, copy host credential storage into the workspace, or reinstate the failing Windows helper in the agent boundary.

## Durable progress and reporting

Preserve successful images and evidence across runs. Record each repository/commit, context, Dockerfile target, exact build command, base-image digests, resulting image ID and digest where available, UTC timestamp, import command and target runtime inventory. A source-SHA tag is not an image digest. A source archive or passing Docker/Buildx check is not a built image. Distinguish a source/build failure from runner transport, filesystem ownership, registry access and Kubernetes readiness failures.

Consult current run/task evidence before answering repeated prerequisite questions. If a genuinely new blocker remains, state the exact missing input or failing command; do not ask the human to rediscover information already recorded here.
