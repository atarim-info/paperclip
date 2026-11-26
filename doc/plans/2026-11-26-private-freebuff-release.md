# Private Freebuff Release Packaging Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Verify every release artifact before any publication.

**Goal:** Ship the fork's Freebuff adapter inside the server, CLI, and UI artifacts without publishing the adapter separately.

**Architecture:** Build Freebuff in the workspace. Stage its built package as a bundled server dependency and retain CLI's existing esbuild bundling. Keep the release graph guard for all other unpublished dependencies and permit Freebuff only where the artifact generation demonstrably includes it.

**Tech Stack:** Node.js, pnpm, npm pack, TypeScript, Node test runner.

**Spec:** User requested Freebuff npm publishing remain disabled; the upstream release is v2026.1117.0.

## Global Constraints

- Do not publish Freebuff or modify the trusted lockfile proof manually.
- Keep fork behavior and approval ownership checks intact.
- Do not deploy until release artifacts, tests, migrations, and rollback are verified.

## Review Focus

- Package install must succeed with Freebuff unavailable on npm and import the server adapter.
- CLI build must contain its adapter formatter and declare no unavailable Freebuff dependency.
- Missing adapter build or dependencies must cause packaging to fail, not silently produce a broken artifact.
- Guard must continue rejecting all other unpublished workspace dependencies and reject unsupported consumers.
- Bundled files and manifest must match the candidate version and never contain workspace symlinks.

## Tasks

- [x] Add failing release graph tests for server, CLI, and UI coverage, disabled adapter, and rejected unsafe edges.
- [x] Add real npm pack and offline install tests for staged Freebuff, missing build, and manifest identity.
- [x] Implement server bundle staging and version rewriting; retain complete server dependency resolution.
- [x] Verify CLI bundling and generated npm manifest using built artifacts.
- [ ] Run the release registry, packaging, adapter, UI, and service upgrade checks; inspect CI before deployment.
