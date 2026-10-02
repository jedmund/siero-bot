# Atomic spark balance updates

Status: Planned  
Repository: siero-bot; hensei-api in a separate worktree if constraints are added  
Dependencies: None  
Parent: [Overall plan](../plan.md)

## Problem and outcome

Spark add/remove reads a balance, computes a replacement locally, and writes it back. Concurrent commands can lose an update. Preserve balances through atomic database operations and keep leaderboard freshness consistent with successful changes.

## Requirements

- Perform increments and clamped decrements atomically in PostgreSQL, including first-use upserts. Update guild membership without losing concurrent additions.
- Keep `/spark update` as an explicit replacement of supplied fields; preserve omitted currencies. Define its ordering relative to add, remove, and reset as serialized committed operations.
- Set `updated_at` for every successful balance mutation, including reset. Use a consistent database timestamp representation.
- Define no-input behavior and reject invalid amounts before writes. Handle accumulated integer overflow without partial updates or a false success message.
- Retain Discord string user IDs and the existing balance meanings. Do not tie records to Hensei account UUIDs.
- Correct database types and insert requirements: guild IDs are required; currency columns currently permit null despite defaults; `target_id` is a nullable bigint, not an automatically generated string. Audit existing null balances before choosing repair or read normalization.
- Return enough committed state to report correct balances and deltas under concurrency. Do not calculate a success message from a stale preliminary read.

## Acceptance and validation

- Two simultaneous additions to one balance both persist, including creation of a previously absent user.
- Concurrent guild updates retain both guilds; removals never produce a negative balance.
- Partial replacements, reset, null legacy data, and overflow have explicit tested results.
- Reset refreshes leaderboard eligibility consistently with other updates.
- PostgreSQL concurrency tests use independent connections and synchronization so they exercise the actual race.

## Rollout and exclusions

This can ship before catalogue migration because the spark schema remains largely compatible. Any new check constraints or data repairs require a separate Hensei migration and preflight. New savings goals, account linking, and financial tracking features are outside scope.
