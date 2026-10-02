# Catalogue and simulation contract

Status: Proposed implementation contract for PRDs 03 through 06  
Updated: 2026-10-02

This contract lets catalogue integration, simulation, and command workflows be implemented separately. It defines the boundary between Hensei's general item metadata and a specific simulation configuration. It is not a claim that the current bot implements these interfaces or that Hensei already stores complete banner rates.

## Item identity

Every drawable has a `drawableType` of `Weapon` or `Summon` and a `drawableId` containing the Hensei item UUID. The pair is the identity for persistence, exclusions, deduplication, rate-ups, and successful target matching.

`granblueId` is a separate catalogue lookup/display identifier. Neither a name nor a Granblue ID is assumed globally unique. The legacy `gacha.id` must not be exposed as the normalized item's identity.

Recruitment data is optional display metadata associated with a weapon. A duplicate character lookup must not produce duplicate weapons in a draw pool. Where records disagree, apply a documented catalogue policy or report ambiguity; do not select an arbitrary joined row and silently change probabilities.

## Catalogue snapshots

A normalized catalogue item contains:

- Typed UUID identity and Granblue ID.
- Available English/Japanese display names, rarity, and element.
- Promotion IDs from Hensei, preserving all known and unknown IDs for diagnostics.
- Optional recruited character metadata, including season and series where needed for display/classification.

A snapshot contains a stable snapshot identifier, load timestamp, normalized items, and aggregate validation diagnostics. Publish only complete snapshots. A simulation holds one immutable snapshot for its whole run, even if a refresh occurs concurrently.

Database adapters own SQL, null handling, numeric decoding, duplicate joins, and conversion into the domain model. The simulation engine receives no database connection, Discord interaction, or global cache singleton.

## Availability and banner definitions

Promotion arrays describe general pool membership. Character season/series describe character classification. Neither is a complete record of a particular live banner's item list, individual rates, Zodiac rotation, or exchange list.

Keep these concepts distinct:

| Concept | Meaning |
| --- | --- |
| General membership | Catalogue metadata used to construct a supported hypothetical pool |
| Draw availability | The exact set of items eligible in the selected simulation |
| Item probability | The effective unconditional chance for a particular slot distribution |
| Featured status | Presentation metadata; not a numeric probability |
| Exchange eligibility | A separate list, required only when modeling spark exchange |

Use explicit banner kinds, including Premium, Flash, Legend, and individual Classic pools. Classic III catalogue population and enum assignment are owned by PRD 03. Do not invent its numeric ID in the bot before Hensei assigns it. Unsupported modes fail validation rather than falling back to Premium.

Represent a recorded real banner and a hypothetical custom simulation distinctly. A recorded banner needs source/date information and complete per-item distributions. Custom simulations need documented rules for allocating the probability not assigned by the user. Do not label a catalogue-derived hypothetical configuration as the current in-game banner.

Automatic live banner ingestion is outside the first implementation wave. Verified fixtures can validate the engine independently of such an integration.

## Probabilities and validation

Internally use unconditional probabilities between zero and one. Convert a user-entered percentage once: `0.3%` becomes `0.003`. If sampling rarity first, conditional item probabilities must be derived from the unconditional distribution rather than applying the rarity probability twice.

Compile the input into explicit distributions for ordinary slots and the guaranteed slot of a ten-part draw. Validate each independently. A ten-part guarantee is not implemented by blindly renormalizing the ordinary distribution after removing R items; use the verified guarantee rules or recorded guarantee table.

The compiler owns:

- Eligibility checks and deterministic typed-identity deduplication.
- Finite, nonnegative probabilities and budgets.
- Duplicate user selections, unsupported rarities, and unavailable items.
- Empty buckets, zero residual budgets, and effective per-item weights.
- Conservation of total probability and a documented treatment of published rounding.

Reject substantive distribution errors. Do not silently normalize a 0.97 total to hide an incorrect rarity budget. Any rounding tolerance must be bounded, justified by the input precision, and covered by tests.

Return a validated configuration or structured errors usable by both rate-up commands and simulation commands. Validation must finish before replacing settings or starting a run.

## Engine input and output

Inputs are an immutable catalogue snapshot, a validated effective banner configuration, and an injectable random-number source. Expose single-draw and ten-part operations without database or Discord side effects.

Results contain drawn item identities, rarity counts, effective configuration identity, catalogue snapshot identity, and draw count. Rendering derives names from the same snapshot or a preserved result payload, not a second independently refreshed catalogue.

A 300-draw result does not automatically include an exchanged item. If exchange is modeled, return it separately and require the exchange-eligibility list. Roll-until measures a natural draw unless the command explicitly offers acquisition by exchange.

Bounded execution and interaction cancellation are orchestration responsibilities under PRD 05. The engine exposes enough granular operations to yield between batches; no engine method should conceal an unbounded loop.

## Persistence and interaction ownership

PRD 02 adds nullable database fields `drawable_type` and `drawable_id`. PRD 03 maps them to the domain identity above. During transition, legacy-only rows require a documented fallback or a completed backfill before readiness. A valid new-only reference must not be treated as an orphan just because `gacha_id` is null.

PRD 06 owns transactional configuration replacement, self-copy behavior, concurrency, and default settings selection. The engine validates probabilities but never writes settings. Public rerun buttons do not implicitly replace a user's settings.

Owned selectors accept only their initiating user. Public reruns can be invoked by another user, using the explicitly documented snapshot/current-settings behavior. PRD 08 owns acknowledgement and collector cleanup for both cases.

## Test fixtures shared between tasks

Agree on fixtures before finalizing implementations:

- A current promoted item with no legacy gacha row.
- A weapon with duplicate recruited-character matches but one drawable identity.
- Same-name distinct items and non-unique Granblue IDs.
- Ordinary, limited, seasonal, and Classic pool membership, including retained shared membership.
- A rate-up item excluded from residual buckets by identity.
- Zero/fully allocated budgets, invalid totals, and empty eligible pools.
- Distinct ordinary and guaranteed-slot rate tables from a verified banner source.
- A legacy-only setting, a dual-reference setting, a new-only setting, and conflicting references.

Source-specific game rules and their verification evidence belong with PRD 04's fixtures. This boundary deliberately does not assert a universal limited-item multiplier or equal R/SR item rates.
