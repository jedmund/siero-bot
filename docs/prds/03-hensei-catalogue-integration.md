# Hensei catalogue integration

Status: Classic III and direct catalogue reads implemented; full identity cutover remains planned

Repositories: siero-bot and hensei-api in a separate worktree for Classic III metadata  
Dependencies: [PRD 02](02-rateup-identity-migration.md) for rate-up cutover; [PRD 08](08-startup-and-interaction-lifecycle.md) for cache readiness  
Parent: [Overall plan](../plan.md)

## Problem and outcome

Implementation evidence, validation, and rollout: [Classic III](../classic-iii.md).

The bot already connects to local Hensei, but searches and cached draw pools originate from an incomplete legacy `gacha` table. Query weapons and summons directly, normalize current metadata once, and read settings through typed item references.

## Catalogue contract

Use `weapons.promotions` and `summons.promotions`, both non-null integer arrays, for pool membership. Preserve these IDs from Hensei:

| ID | Promotion | ID | Promotion |
| --- | --- | --- | --- |
| 1 | Premium | 7 | Summer |
| 2 | Classic | 8 | Halloween |
| 3 | Classic II | 9 | Holiday |
| 4 | Flash | 10 | Collab |
| 5 | Legend | 11 | Formal |
| 6 | Valentine | 12 | Classic III |

Character season numbers are a separate enum and must not be substituted for promotion IDs. `weapons.recruits` still points to `characters.granblue_id`; rarity and element mappings remain compatible. Do not use `weapons.gacha` as the sole eligibility gate: it was unpopulated locally.

IDs 1–11 record the original Hensei mapping. Classic III uses newly assigned ID 12 in the implementation branch, with a reviewed, rerunnable 251-item data migration; deployment remains pending. The manifest and shared-membership exceptions are recorded in the implementation evidence. This is a data and enum extension using the shared Classic simulation system.

## Requirements

- Port useful changes from local branch `feature/use-promotions-column` onto current ESM code, retaining later fixes. Do not import its incompatible rate-up identifier change.
- Replace gacha-based lookup and cache queries with direct item queries. Use one normalized item model with explicit type, item UUID, Granblue ID, promotions, and optional recruitment metadata.
- Preserve all known promotion metadata, including unsupported command modes; reject unsupported selections explicitly rather than silently mapping them to premium.
- Add Classic III to Hensei's promotion mapping and affected readers/writers, then update item promotion arrays. Extend the bot's Classic configuration and command choices to select this pool. Keep the Hensei changes in their own worktree and PR, with a data preview and explicit deployment ordering.
- Keep catalogue search separate from simulation eligibility. Non-drawable results cannot enter rate-ups or roll-until execution merely because they exist in the catalogue.
- Ensure duplicate character Granblue IDs cannot multiply weapon rows. Define deterministic ambiguity handling and report duplicates for Hensei cleanup; never choose an arbitrary duplicate without a documented rule.
- Read new rate-up references after migration. During the documented transition, support legacy-only rows or fail startup until the final backfill is complete. Writes use the new pair and retain an existing legacy mapping when available; do not fabricate gacha rows for new items.
- Correct Kysely types for nullability, numeric decoding, UUID identity, and timestamp behavior. Remove the catch-all `any` escape in spark types when touched, coordinating with PRD 07.

## Acceptance and validation

- A promoted item absent from legacy gacha is searchable and available in its valid pool.
- Pools contain each drawable UUID once even when recruitment metadata has duplicates.
- Tests cover every promotion ID, empty and unknown metadata, nullable catalogue fields, character lookup, and ambiguous Granblue IDs.
- Classic III's data migration changes only the intended pool memberships, preserves unrelated promotion IDs, and is stable when rerun. Bot fixtures verify Classic I, II, and III select their respective pools using the same engine.
- PostgreSQL integration tests verify rate-up reads and writes against the additive Hensei schema, including new-only items.
- Spark balance persistence and Discord user identity remain unchanged.

## Rollout and exclusions

Deploy only after PRD 02 and final old-writer reconciliation. Validate production promotion coverage first. This task defines catalogue identity and eligibility inputs; probability calculation belongs to PRD 04 and removal of legacy storage to PRD 12.
