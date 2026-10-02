# Safe rate up workflows

Status: Planned

Repository: siero-bot

Dependencies: [PRD 02](02-rateup-identity-migration.md), [PRD 03](03-hensei-catalogue-integration.md), and validation from [PRD 04](04-simulation-correctness.md)

Parent: [Overall plan](../plan.md)

## Problem and outcome

Self-copy deletes settings before reading them. Replacement uses separate delete/insert statements, partial lookup failures can replace a complete configuration with a subset, and allowed totals exceed the simulator's SSR budget. Make every settings change validated, atomic, and accurately described to the user.

## Requirements

- Parse finite percentages strictly and resolve all requested items before writing. Reject incomplete item/rate pairs, duplicate resolved identities, unsupported rarity, unavailable items, and over-budget totals.
- Share validation with the simulation engine. If settings are stored without a banner, define the default validation context explicitly and revalidate for every effective banner; do not assume one configuration is valid on all banners.
- Unknown items, database errors, or selection timeout must not silently save a partial replacement. Keep the prior configuration and explain which input needs correction.
- Read the source before replacing the destination. Self-copy is a no-op that preserves settings.
- Perform replacement in a transaction. Serialize competing updates for the same Discord user or use an equivalent concurrency strategy, including users with no existing rows. Test this case rather than assuming deletion provides a lock.
- Await reset/delete operations and report success only after commit. Preserve distinct errors for an empty configuration and a failed database read.
- Make “Spark with these rates” simulate the source configuration without overwriting the clicker's settings. Keep saving another user's configuration behind the explicit copy action.
- For repeatable reruns, identify an immutable configuration snapshot or clearly label reruns that use current settings. Choose and document the persistence contract rather than promising a snapshot while fetching mutable source settings.
- Define reset and default-banner fallback behavior consistently across set, show, copy, and simulate. Configure the default source explicitly.

## Acceptance and validation

- Self-copy, failed inserts, unresolved inputs, timeouts, and concurrent replacements do not erase valid settings or create mixtures of two updates.
- Repeated source-item references resolve to a validation error before persistence.
- A rerun does not change the caller's saved settings.
- PostgreSQL tests verify rollback and new typed item references; interaction tests verify authorized selection and truthful success/error messages.

## Rollout and exclusions

Self-copy and transaction fixes may land against the legacy schema first. Final persistence uses PRD 02's contract. Database cleanup and optional multi-preset management belong to separate PRDs.
