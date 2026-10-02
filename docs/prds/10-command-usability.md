# Command usability and presentation

Status: Planned

Repository: siero-bot

Dependencies: PRDs 03, 04, 06, and 08

Parent: [Overall plan](../plan.md)

## Problem and outcome

Users navigate ambiguous item names and many rate-up arguments, results can obscure the effective configuration, and presentation has small correctness defects. Make supported workflows understandable and repeatable after the underlying data and simulation fixes land.

## Requirements

- Add item autocomplete with stable identifiers and useful disambiguation such as element, season, rarity, and recruited character. Search may use Hensei nicknames where available. Bound results and avoid a slow full-catalogue query on every keystroke.
- Preserve name and Granblue ID entry where useful, but handle duplicate IDs explicitly. Never infer the selected item solely from its display name.
- Show the effective banner, season, rate-up configuration, and catalogue freshness where relevant. Explicitly identify unsupported modes instead of silently falling back.
- Provide reusable preset/rerun behavior on top of PRD 06's configuration contract. Decide whether presets are named persistent records or shareable snapshots before adding storage; any schema extension gets its own Hensei worktree and migration.
- Display percentages with appropriate precision, including SSR percentages that are currently floored to whole numbers.
- Replace fragile character-weapon sorting with a deterministic rarity order, retaining duplicates that represent separate draws. Bound or paginate output to Discord message/embed limits.
- Fix `/choose final` to honor its advertised daily behavior by including a documented date/timezone in the deterministic input. Define whether option order affects the result.
- Correct no-results text, provide explicit DM/guild guidance, and disable expired controls. Avoid exposing database identifiers or internal errors in normal product messages.

## Acceptance and validation

- Same-name variants can be selected unambiguously through autocomplete and fallback selection.
- A displayed rerun configuration matches the configuration actually simulated, without altering saved settings.
- Sorting, percentage formatting, oversized output, expired controls, and daily-choice boundaries have deterministic tests.
- Commands remain usable without adopting optional presets, and command help matches implemented behavior.

## Rollout and exclusions

Ship presentation fixes in small changes after the engine contract stabilizes. Live automatic banner ingestion, a web dashboard, and a new Hensei account-linking flow are outside this task. Persistent named presets are an optional follow-on within this PRD, not a blocker for core repair releases.
