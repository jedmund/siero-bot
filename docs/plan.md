# Siero bot modernization plan

Status: First implementation wave completed locally

Updated: 2026-10-02

Bring Siero onto the current Hensei catalogue, preserve saved user data, correct simulation results, and make the bot reliable to operate. This plan defines the work and its deployment order. Implementation status and validation results are recorded in [first-wave results](implementation-progress.md). Production deployment remains pending.

## Outcomes

- Catalogue searches and simulations use Hensei's current weapon and summon promotion arrays.
- Existing rate-ups and spark balances survive the transition.
- Simulations use consistent, validated probabilities and cannot block the bot indefinitely.
- Commands acknowledge interactions promptly and report failures accurately.
- Raid reminders survive restarts, and configuration supports more than one server.
- Reproducible builds, meaningful tests, and operating documentation support future maintenance.

## Verified baseline

The investigation used siero-bot `e000ca7`, hensei-api `17f17662` (matching remote HEAD at investigation time), and read-only queries against the configured local `hensei_dev` database. Its latest recorded schema migration was `20261002000100`. Production was not inspected; local counts are evidence, not production migration expectations.

| Finding | Evidence and consequence |
| --- | --- |
| The local connection already targets Hensei | Changing the connection URL alone does not fix compatibility. |
| Pool membership moved to item tables | `weapons.promotions` and `summons.promotions` are integer arrays; the bot still queries legacy `gacha` booleans. |
| The legacy catalogue is incomplete | 77 promoted weapons and 2 promoted summons have no legacy row; 13 existing summons have different old/new promotion metadata. |
| Existing local rate-ups are recoverable | All 42 map through their legacy gacha rows to valid catalogue items. |
| An unfinished migration exists | Local branch `feature/use-promotions-column`, commits `210b5dc`, `b0e0972`, `897d86b`, `1b7ac14`, `d745b0f`; absent from remote heads and not merged into main. |
| That branch is not deployable | It writes Granblue strings into UUID `gacha_rateups.gacha_id`; its varchar-to-UUID read join fails. It also predates ESM and later fixes. |
| Catalogue identifiers require care | Three duplicated character Granblue IDs multiply recruitment joins for promoted weapons. One duplicated weapon Granblue ID belongs to two non-promoted items. |
| A different eligibility flag is incomplete | All local `weapons.gacha` values are false, although 758 weapons have promotions. |
| Static checks are insufficient | Type checking and lint pass with a clean frozen-lockfile install; no behavioral test suite exists. |
| Dependencies need maintenance | The production dependency audit reported 14 advisories: 6 high, 5 moderate, 3 low. This is an affected-version report, not an exploitability finding. |

Other confirmed code defects include self-copy deleting saved rate-ups, inconsistent gacha weights and pools, object-reference exclusions, unbounded synchronous simulation, non-atomic spark arithmetic, cache initialization races, and discarded raid reconciliation results. The PRDs below define their repairs.

## Scope and implementation boundaries

Keep TypeScript, Sapphire, discord.js, Kysely, and PostgreSQL unless implementation uncovers a concrete blocker. Port useful parts of the old migration branch onto current code; do not merge it wholesale.

Hensei owns catalogue data and database schema changes. Make every hensei-api change in a **separate worktree and branch**, with its own commits and PR, as requested. Do not edit its existing working checkout. Bot changes remain in the Siero worktree. Link related PRs and state deployment dependencies in both repositories.

Use item UUID plus item type for persisted rate-up identity. Granblue IDs remain search identifiers; they are not assumed globally unique. UUID references are stable within the database lineage, not guaranteed across independent database rebuilds.

Each PRD is independently reviewable and contains its own scope and completion criteria. Independence does not imply that schema-dependent work can deploy out of order. Tests belong to the task changing behavior rather than a deferred testing phase.

The [catalogue and simulation contract](catalogue-and-simulation-contract.md) defines the proposed shared boundaries for PRDs 03 through 06, so their implementations can overlap without conflating catalogue membership, banner rates, and saved settings.

## Task index

PRDs 01 and 07 are implemented in the bot branch. PRD 02 is implemented in its separate Hensei worktree, with the full-suite qualification recorded in [first-wave results](implementation-progress.md). Nothing has been deployed. Other tasks remain planned. Priority reflects impact and dependency, not a promised schedule.

| PRD | Task | Repository | Priority | Prerequisites |
| --- | --- | --- | --- | --- |
| [01](prds/01-dependencies-and-ci.md) | Dependencies and reproducible checks | Siero | High | None |
| [02](prds/02-rateup-identity-migration.md) | Additive rate-up identity migration | Hensei API, separate worktree | Critical | None |
| [03](prds/03-hensei-catalogue-integration.md) | Current Hensei catalogue integration and Classic III data | Both | Critical | 02 for full cutover; 08 for readiness |
| [04](prds/04-simulation-correctness.md) | Simulation correctness | Siero | Critical | 03 catalogue contract |
| [05](prds/05-bounded-until-simulation.md) | Bounded roll-until simulation | Siero | Critical | 04 for final eligibility model; immediate guard can land earlier |
| [06](prds/06-rateup-workflows.md) | Safe rate-up workflows | Siero | Critical | 02 and 03 for final persistence; 04 for validation |
| [07](prds/07-atomic-spark-updates.md) | Atomic spark balance updates | Siero, Hensei if constraints needed | High | None |
| [08](prds/08-startup-and-interaction-lifecycle.md) | Startup and interaction lifecycle | Siero | High | None |
| [09](prds/09-durable-raid-scheduling.md) | Durable raid scheduling | Both | High | 08; separate Hensei worktree for new schema |
| [10](prds/10-command-usability.md) | Command usability and presentation | Siero | Medium | 03, 04, 06, 08 |
| [11](prds/11-operations-and-schema-contract.md) | Operations and schema contract | Siero, coordinated with Hensei | High | Contracts from 02, 03, 08, 09 |
| [12](prds/12-retire-legacy-gacha.md) | Retire legacy gacha storage | Both | Deferred | 02, 03, 06, 11 and verified production cutover |

## Delivery sequence

### Establish a dependable baseline

Complete dependency and CI work, then introduce behavioral tests alongside the first repairs. Fix self-copy, atomic spark arithmetic, interaction acknowledgement, and a hard roll-until limit early where they do not depend on the catalogue migration. Preserve those fixes while porting catalogue code.

### Expand the Hensei schema

Implement PRD 02 in its own Hensei worktree. Inspect production schema and aggregate data quality before finalizing migration assumptions. Add nullable typed references, backfill valid rows, and retain the old reference. Verify failures or duplicates explicitly rather than deleting data to make constraints pass.

### Implement and validate the bot cutover

Deliver PRDs 03, 04, 05, 06, and 08 against the additive schema. Catalogue reads use item promotions; rate-up reads and writes use typed UUID references. Test with Hensei-shaped fixtures and a disposable PostgreSQL database, including legacy-only, dual-reference, and new-item cases.

Classic III has not yet been populated in Hensei. Treat it as catalogue maintenance within PRD 03: add an explicit promotion ID without renumbering existing IDs, then update the relevant weapon and summon promotion arrays through a reviewed Hensei data migration in a separate worktree. Preserve any intended membership in other pools. The simulator consumes Classic III through the shared Classic configuration; it does not need a separate simulation engine.

Deploy the additive schema before the new bot. Quiesce old bot writers for the final backfill and reconciliation, then start the new bot only after its schema and cache checks pass. Legacy bots can create rows without the new columns until stopped, so a one-time earlier backfill alone is not enough.

### Complete reliability and product work

Finish persistent raid scheduling, command presentation, and operations work. Database changes for raid state have their own migration and worktree; they are not bundled into the rate-up identity change. Document exact command behavior and deployment recovery procedures.

### Contract after verification

PRD 12 is a later deployment, not part of the initial cutover. Keep the legacy tables and columns until production reads, writes, saved balances, and simulation behavior have been verified and all consumers inventoried.

## Data preservation and rollback

Preserve Discord user IDs, guild IDs, percentages, balances, and rate-up selections. Report unmappable references and duplicate settings with a repair policy; do not silently reset them.

During transition, retain `gacha_id` and populate it when an existing legacy mapping is available. New catalogue items may have no such mapping. An old bot cannot read those new selections even if the old column remains. Do not describe a binary rollback as lossless: either use a prior compatible bot build, or explicitly reconcile new-only settings before reverting to legacy code. Never delete those settings to enable rollback.

Keep destructive cleanup separate. A migration down method cannot reconstruct every new catalogue item or resurrect dropped historical data; the runbook must state its real limits.

## Validation and release criteria

- Clean pinned-toolchain installation, build, lint, and meaningful automated tests pass.
- PostgreSQL tests exercise schema types, migrations, transactional settings changes, and concurrent balance updates.
- Simulator tests prove probability conservation, pool membership, ID-based exclusions, guarantees, and bounded execution using deterministic randomness.
- Interaction tests cover acknowledgement, authorization, expiry, errors, and slow dependencies.
- Production preflight and postflight reports reconcile settings and catalogue coverage without exposing user records or credentials.
- A controlled Discord smoke test covers gacha, rate-ups, sparks, selectors, and scheduled raids.
- The documented rollback path is tested before legacy cleanup.

## Decisions to resolve during implementation

- Which current banner rules, limited-item weights, ten-part guarantees, and supported seasonal combinations should the simulator model? Confirm authoritative rules and current catalogue semantics rather than preserving assumptions in existing code.
- How should duplicate recruited-character records be resolved? The bot must not multiply draw entries while catalogue cleanup is pending.
- Are Collab simulations supported initially, or explicitly rejected until a complete rule definition exists? Classic II and Formal metadata must not be silently dropped.
- What retry and duplicate-notification policy should durable raid reminders use after an uncertain Discord send result?
- Is the production database fully populated with promotion metadata? Local data and source code do not prove this.

## Source references

- Bot: [database types](../src/services/tables.ts), [catalogue queries](../src/services/api.ts), [cache](../src/services/cache.ts), [simulation](../src/services/gacha.ts).
- Hensei: [schema](https://github.com/jedmund/hensei-api/blob/17f1766204dc76bc0154067220265316543e400c/db/schema.rb), [enum mappings](https://github.com/jedmund/hensei-api/blob/17f1766204dc76bc0154067220265316543e400c/app/models/concerns/granblue_enums.rb), [original migration plan](https://github.com/jedmund/hensei-api/blob/17f1766204dc76bc0154067220265316543e400c/docs/plans/character-season-series.md).
- The baseline audit and database counts above were obtained on 2026-10-02. The updated production dependency audit reports zero advisories; production data still requires its own preflight.
