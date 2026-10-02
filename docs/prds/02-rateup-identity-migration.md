# Rate up identity migration

Status: Planned  
Repository: hensei-api in a new worktree and branch  
Dependencies: None; bot adoption is [PRD 03](03-hensei-catalogue-integration.md)  
Parent: [Overall plan](../plan.md)

## Problem and outcome

Saved settings currently reference `gacha_rateups.gacha_id`, a UUID pointing to a legacy `gacha` row. Removing catalogue dependence on that table requires a direct item reference. Preserve each user's chosen item and percentage while allowing rate-ups for items absent from the legacy catalogue.

The unfinished Siero branch writes a Granblue string into that UUID column and compares varchar with UUID. It is incompatible with the current schema. All 42 investigated local settings are mappable, but production requires its own preflight.

## Proposed schema contract

Add nullable `drawable_type` and UUID `drawable_id` columns to `gacha_rateups`. Supported types are exactly `Weapon` and `Summon`. A check constraint permits either both fields absent during transition or a complete valid-type pair. Add indexes for the new lookup and user access as justified by the queries.

Retain `gacha_id`, Discord `user_id`, numeric `rate`, and existing timestamps. Do not repurpose the old UUID field, convert Discord IDs to Hensei account IDs, or make the new fields mandatory while old writers remain active.

The polymorphic pair is not protected by a conventional cross-table foreign key. Document this limitation and validate item existence in backfill, writes, and integrity checks. Catalogue deletion handling must not silently erase saved settings.

## Migration requirements

- Create a separate Hensei worktree, branch, and PR; preserve the existing checkout and its local changes.
- Follow Hensei schema and data migration conventions. Backfill by joining `gacha_rateups.gacha_id` to `gacha.id` and copying `drawable_type` and `drawable_id`, validating the actual item exists.
- Supply read-only preflight and reconciliation checks for orphaned references, invalid types, conflicting new/old references, duplicate settings, and row-count preservation.
- Make the backfill rerunnable and avoid overwriting an already populated conflicting reference. Surface such conflicts for repair.
- Resolve duplicate settings explicitly before adding uniqueness constraints; do not arbitrarily keep one rate. Final mandatory-column and uniqueness enforcement belongs to [PRD 12](12-retire-legacy-gacha.md).
- Document that old writers can create new legacy-only rows after the initial backfill. Quiesce them and perform a final reconciliation before bot cutover.

## Acceptance and validation

- Existing settings resolve to the same item, user, and rate before and after backfill.
- Fixtures cover weapons, summons, missing items, orphaned gacha rows, duplicates, already-migrated rows, and conflicting references.
- A second backfill makes no unintended changes.
- Legacy bot inserts still work during the additive phase; a new-only item can be stored with the new pair and a null legacy reference.
- PostgreSQL migration tests and the Hensei-required checks pass. No Discord messages are sent by migration tests.

## Deployment and rollback

Deploy this additive migration before the compatible bot. Keep populated new columns during an application rollback. Dropping them would lose the only identity for new-only items. Retaining `gacha_id` supports old entries, but does not make a legacy bot understand new-only entries. Destructive cleanup is explicitly outside this PRD.
