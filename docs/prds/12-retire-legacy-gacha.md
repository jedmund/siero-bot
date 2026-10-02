# Retire legacy gacha storage

Status: Deferred until production cutover is verified  
Repositories: hensei-api in a new worktree and siero-bot  
Dependencies: PRDs 02, 03, 06, and 11; verified production migration  
Parent: [Overall plan](../plan.md)

## Problem and outcome

Keeping two catalogue representations indefinitely invites drift and continued use of stale data. Remove legacy storage only after direct catalogue reads and typed rate-up identity are proven in production and no remaining consumer requires it.

## Entry criteria

- The new bot reads promotions directly and writes complete typed references for every setting.
- Production reconciliation confirms preserved selections and rates, no unresolved references, and no old writers.
- Search source code, scheduled tasks, maintenance scripts, and deployment configuration across Hensei and Siero for legacy table consumers. Retire or replace them explicitly, including gacha migration/verification rake tasks.
- The rollback runbook uses a compatible bot build or a documented data restoration path; reverting to legacy code is no longer assumed safe.
- Verify a restorable backup and record the agreed post-cutover observation period. Elapsed time alone is not evidence that cleanup is safe.

## Requirements

- Create a separate cleanup Hensei worktree, branch, and PR. State destructive operations and deployment prerequisites plainly.
- Resolve duplicate settings under an explicit preservation policy, then enforce required typed identity, allowed types, and uniqueness for the intended per-user item selection contract.
- Remove `gacha_rateups.gacha_id` and the legacy `gacha` table only after all dependencies are eliminated.
- Remove obsolete Hensei models/tasks and Siero types, compatibility reads/writes, and mappings that exist only for the old schema. Preserve promotion enum definitions and current catalogue data.
- Refresh schema checks, fixtures, and operations documentation so they describe the final state rather than the transition.
- Account for migration duration and database locks when choosing deployment mechanics.

## Acceptance and validation

- Fresh-schema and upgrade-path integration tests both pass with no legacy gacha table.
- Every existing rate-up still resolves to the same typed item and percentage.
- Repository searches and runtime smoke tests show no dependency on the removed columns or table.
- Document and test restoration procedures on a disposable database. If a down migration cannot restore dropped data, mark it irreversible rather than pretending reconstruction is complete.

## Exclusions

Do not include this cleanup in the additive migration or initial bot deployment. It does not authorize removing unrelated Hensei schema or correcting catalogue data by deleting records silently.
