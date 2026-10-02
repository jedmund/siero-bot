# Dependencies and reproducible checks

Status: Implemented and locally validated; CI execution pending

Repository: siero-bot

Dependencies: None

Parent: [Overall plan](../plan.md)

Implementation and validation: [First-wave results](../implementation-progress.md).

## Problem and outcome

Development and CI use moving Node and pnpm targets, and installed local packages can differ from the lockfile. Static checks pass despite serious behavioral defects. The investigated production dependency graph also contains security advisories. Establish a reproducible, maintained toolchain and a CI baseline that subsequent tasks extend.

## Requirements

- Choose a supported Node LTS release and an exact pnpm version after checking dependency engine requirements. Align mise, CI, package metadata, and documented setup; align Node types to the chosen runtime.
- Refresh runtime dependencies and affected transitive dependencies. Review Kysely changes before upgrading from 0.27; handle major TypeScript, ESLint, or dotenv upgrades separately when they would enlarge the change.
- Rerun the production dependency audit. Record remaining affected packages and actual exposure without equating every advisory with a reachable vulnerability.
- Provide explicit build, typecheck, lint, format-check, and test scripts. Make production start and development watch commands unambiguous.
- Add a test runner suitable for pure TypeScript code and disposable PostgreSQL integration tests. Behavior-specific test cases are owned by the corresponding PRDs.
- Configure linting for Node and TypeScript, with type-aware checks for unhandled promises where practical. Move build-only packages to development dependencies only after verifying the deployment build process.
- CI must use a frozen lockfile and run the same commands documented for local development. Review action versions and permissions as part of reproducibility.

## Acceptance and validation

- A clean checkout installs, builds, lints, and runs tests with the pinned tools without relying on existing `node_modules`.
- CI detects a deliberately broken behavioral test and an unhandled promise fixture or equivalent lint-rule check.
- The production entry point starts from compiled output in the documented deployment layout.
- An updated audit records resolved advisories and justified remaining exposure, if any.
- Dependency changes do not alter saved data or command semantics.

## Rollout and exclusions

Land this independently of schema work. Do not automatically upgrade every package across major versions or commit regenerated dependencies without reviewing them. No database migration or new user-facing feature belongs in this task.
