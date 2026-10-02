# Classic III catalogue implementation

Status: Implemented and locally validated; production reconciliation and deployment pending

Updated: 2026-10-02

Classic III uses promotion ID **12**. Existing IDs 1–11 keep their meanings. Hensei owns the membership data; the bot reads the promotion arrays directly.

## Membership evidence

The reviewed manifest contains 251 items:

| Category | Items | Availability change |
| --- | ---: | --- |
| SSR recruitment weapons | 44 | Move to Classic III |
| SSR summons exclusive to Classic III | 8 | Move to Classic III |
| SSR summons shared with Premium | 15 | Add Classic III |
| R/SR weapons | 139 | Add Classic III |
| R/SR summons | 45 | Add Classic III |

The [wiki character list](https://gbf.wiki/SSR_Characters_List#Classic_Draw_III), [wiki summon list](https://gbf.wiki/SSR_Summons_List#Classic_Draw_III), and [Gamewith's yearly lists](https://xn--bck3aza1a2if6kra4ee0hf.gamewith.jp/article/show/547972) agree on the SSR roster. The SSR release window is March 10, 2018 through March 9, 2020. Some local summon release dates are unreliable, so the migration uses an explicit list of Granblue IDs and validates their unique resolution instead of selecting by date.

Shared SSR summons include six Archangels, six Crest summons, **Belial, Gorilla, and Demonbream**. The [wiki Draw summary](https://gbf.wiki/Draw#Classic_III) omits the last three exceptions; the detailed lists and Gamewith identify them. The eight exclusive summons are Freyr, Hamsa, Anat for Love and War, Poseidon, Sylph, Cerberus, Magus, and Marduk.

The lower-rarity manifest combines the published Premium R/SR rule and release cutoff with existing local catalogue records. It excludes seasonal Water Balloons. No selected R/SR record has a missing release date or falls on the cutoff boundary. This is a reviewed local catalogue manifest, not an independently exported in-game R/SR list. Production must reconcile its own catalogue before deployment.

Ordinary Classic III exchange eligibility differs from draw eligibility: Belial and the six Archangels are excluded from ordinary Vermilion exchange, while the special Step Up offer allows them. This change assigns draw membership; it does not implement Step Up draws or exchange eligibility.

Evidence was retrieved without needing the user's alternate wiki access. A direct 2026 official announcement and current in-game rate table were not obtained. These sources support the catalogue work, but do not establish exact per-item simulation probabilities.

## Preservation and rollout

Hensei changes live in `/private/tmp/hensei-classic-iii`, branch `feature/classic-iii`, commits `12c7ff79` and `ab80d96b`. The manifest is `db/data/manifests/classic_iii.csv` and the data migration is `db/data/20261002000001_assign_classic_iii_promotions.rb`. The API runbook is `docs/classic-iii-migration.md`.

For the 52 exclusive SSR entries, the migration removes obsolete ordinary availability IDs 1, 4, 5, 6, 7, 8, and 9 and adds 12. Keeping those ordinary flags would leak the items into Flash, Legend, and seasonal banner simulations. Shared entries only gain 12. Other promotion values are preserved.

The migration resolves every manifest identifier before changing rows, rejects missing or ambiguous records and metadata mismatches, serializes against catalogue writes, and can be rerun. Preview is read-only. The [local before/after preview](classic-iii-preview.csv) contains all 251 proposed changes, excluding environment-specific UUIDs. It is not a production reconciliation report. Existing legacy `gacha` rows are not extended or manufactured. An old backfill task is guarded against overwriting authoritative populated promotion arrays.

The Hensei web label/editor update lives separately in `/private/tmp/hensei-classic-iii-web`, branch `feature/classic-iii-label`, commit `f21d429f1`. It adds ID 12 to the existing promotion label map, which powers both displays and editing choices. Targeted TypeScript, ESLint, and formatting checks passed.

Deploy the API enum/parser support and reviewed data migration, the web label, and the compatible bot together according to the Hensei runbook. Stop old bot processes during the rollout: legacy `gacha` membership remains stale. Database rollback requires the actual prior memberships, not a guessed reverse mapping.

## Validation

An independent evidence review found no missing, extra, or duplicate identities in the 251-entry manifest. The migration and its rerun passed against a disposable database populated with catalogue fields only. The actual `data_migrate` task, history tracking, and data schema dump also passed.

Hensei's final focused suite passed 76 examples, including parser and migration tests, with 66.39% coverage. Targeted RuboCop checks passed. The earlier full-suite run had 3,096 examples, one known baseline cross-party GridCharacters failure, and two pending examples, with 81.07% coverage. That full run preceded the final locking and metadata-drift checks; the focused suite was rerun after those changes. The full suite is not green.

The Classic III data version precedes the separate rate-up identity migration. Regenerate `db/data_schema.rb` at the newer version when combining their branches. No existing application database was changed, and nothing was pushed or deployed.

## Bot integration

Bot commits `ad70c36` and `5b8c96c` replace legacy membership queries with direct item promotion reads and add explicit Classic I, II, and III command choices. Recruitment joins cannot duplicate a drawable; ambiguous character display metadata is omitted with a diagnostic. Typed item UUID references distinguish selector options even when Granblue IDs repeat. A real legacy mapping remains separate for existing rate-up persistence; new-only settings are rejected before replacing saved settings.

Simulations await catalogue loading, use the selected Classic pool throughout the draw, and give all Classic modes the 3% SSR rarity budget. Validation rejects unsupported combinations, incomplete rarity pools, duplicate custom identities, invalid custom rates, and SSR budgets above the selected mode's allowance. Zero-rate targets stay excluded. R/SR custom rate-ups are rejected before saved settings are replaced.

The expanded search required an immediate roll-until guard. It now checks actual target availability, matches typed identity, and stops with an explicit failure after 100,000 draws. It no longer silently changes the requested promotion. This loop is still synchronous; yielding, cancellation, detailed accounting, and broader probability correctness remain future work.

The integrated bot passes build, source/test type checking, lint, scoped formatting, and all 11 tests with no skips. Tests include real PostgreSQL catalogue queries and spark concurrency, all three Classic pools through the same engine, typed selector identities, zero-probability exclusions, and unavailable/capped roll-until results. Discord login was mocked; no live command registration was performed.

## Scope remaining

This is the Classic III portion of [PRD 03](prds/03-hensei-catalogue-integration.md). Typed UUID rate-up persistence still requires the separate identity migration and bot adoption. Broader probability correctness, recorded banner fixtures, and responsive roll-until execution remain assigned to PRDs 04–06. Existing gala probability and limited-item allocation defects are not certified fixed by these Classic tests. Do not describe this catalogue change as completing those tasks.
