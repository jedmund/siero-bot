# First-wave implementation results

Updated: 2026-10-02

GPT-6.1 Sol subagents implemented PRDs 01, 02, and 07 in separate worktrees. The bot changes were reviewed and integrated into `feature/update`. Hensei changes remain on their own branch. Nothing has been pushed or deployed, and no production or existing application database was migrated.

## Dependencies and checks: PRD 01

Bot commit `cbc3f45` pins Node 24.21.0 and pnpm 10.34.6, refreshes the lockfile, separates build dependencies from runtime dependencies, and adds explicit build, typecheck, lint, formatting, and test commands. CI supplies PostgreSQL 17.11 for integration tests. Type-aware promise checks have documented exceptions for existing defects assigned to later PRDs.

A clean frozen installation passed in the isolated task worktree. The integrated bot also passed frozen installation and `pnpm check` with an explicit disposable PostgreSQL test connection: eight tests passed, none skipped. These include negative lint and behavioral-test fixtures, a compiled startup smoke test with Discord login mocked, spark response handling, and synchronized PostgreSQL concurrency cases. The test registrations were adjusted during integration to satisfy the new promise lint rule.

A separate production-only installation loaded real runtime dependencies and reached mocked login from compiled output. This does not validate live Discord command registration or connectivity. The production dependency audit changed from 14 advisories to zero. Hosted CI has not run yet.

See [dependency decisions](dependencies.md) and [setup instructions](../README.md).

## Rate-up identity: PRD 02

Hensei commit `cbd04827` is on `feature/siero-rateup-identity` in `/private/tmp/hensei-siero-rateup-identity`. The existing Hensei checkout was left untouched.

The change adds nullable `drawable_type` and UUID `drawable_id`, a complete-pair constraint, and an index. It retains legacy references and rates. A rerunnable backfill validates actual item existence and preserves conflicts, duplicates, and unmappable settings for explicit repair. Aggregate preflight works before and after the additive schema. Destructive rollback is refused.

Validation used disposable PostgreSQL databases:

- All seven migration examples passed. The focused command exits 2 because its 53.45% coverage is below the repository-wide SimpleCov threshold.
- The full changed suite with `--order defined` ran 3,098 examples: one failure, two pending, and 81.11% line coverage.
- An untouched baseline archive, on a separate clean database with the same fixed ordering, ran 3,091 examples: two failures, two pending, and 81.07% coverage. The changed suite's remaining failure is also present in the baseline: cross-party grid-character resolution. The baseline additionally failed grid-weapon resolution.
- Earlier randomized runs had different failures after added examples changed ordering. Those failures are not all established as pre-existing; the fixed-order comparison found no new failures. The full suite is not green.
- Repository-wide RuboCop passed for 754 files. Actual schema migration and `data:migrate:up VERSION=20261002010001` succeeded, and generated schema versions are committed.

The Hensei worktree contains the deployment runbook at `docs/migrations/siero-rateup-identity.md`. Production still requires its own preflight, explicit repair of any reported blockers, compatible bot writers that validate item existence, and a final backfill/reconciliation after legacy writers stop. Retaining legacy columns does not make old bot code understand new-only selections.

## Atomic spark updates: PRD 07

Bot commits `61b38dc` and `4510a1f` introduce transactional first-use creation and row locking, SQL balance arithmetic, clamped removals, merged guild membership, and consistent update timestamps. Partial replacement preserves omitted amounts. Overflow rolls back the transaction. Legacy null currencies read as zero. Reset on first use intentionally creates a zero-balance record.

Mutation commands defer their replies and report committed state. A Discord reply failure after commit cannot claim that saving failed. An uncertain database outcome tells the user to check `/spark progress` before retrying.

Independent database connections and lock synchronization verify concurrent creation and updates. Tests also cover replacement ordering, reset, removals, guild merging, null values, invalid input, and overflow rollback. No Hensei spark schema migration was needed. See [spark persistence and rollout](spark-persistence.md); old bot processes must stop before rollout because their legacy writes do not follow the new transaction protocol.

## Subsequent implementation

The Classic III catalogue work and an initial roll-until guard are now implemented locally. See [Classic III results](classic-iii.md) for exact scope, manifests, tests, and remaining work.

## Remaining implementation wave

Continue the remaining PRD 03 identity adoption, PRD 04 (simulation correctness), and PRD 08 (startup and interaction lifecycle). They can overlap using the [catalogue and simulation contract](catalogue-and-simulation-contract.md) and the new direct catalogue adapter. Classic III's separate Hensei worktree is implemented; production reconciliation and rollout remain pending.

PRD 06 can then adopt the new rate-up identity and validated probability model. PRD 05 must use the corrected simulation model for its final bounded execution implementation. Production rollout remains governed by the [overall plan](plan.md).
