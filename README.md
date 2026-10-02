# Siero bot

A TypeScript Discord bot using Sapphire and PostgreSQL.

Use Node **24.21.0** and pnpm **10.34.6**, pinned in `mise.toml`, `package.json`,
and CI. `mise install` installs both tools. Then run:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm lint
pnpm format-check
pnpm test
```

Tests use Node's built-in runner through tsx. Integration tests create and drop a
unique test database for catalogue, rate-up, or spark cases. Set `SPARK_TEST_ADMIN_URL` to a PostgreSQL
admin connection whose database is `postgres`; never point it at a user database.
CI supplies a disposable PostgreSQL service and this URL. Without the URL,
integration tests skip in the normal suite; pure tests still run. The explicit
`test:integration` command fails if the URL is absent. To exercise integration explicitly:

```sh
SPARK_TEST_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test:integration
```

Copy `env.sample` to `.env` and configure the bot credentials and database URL for
actual development. `pnpm dev` watches TypeScript. `pnpm start` runs the compiled
`build/dist/index.js`; it requires a prior `pnpm build`. `pnpm serve` is an alias
for production start. Installation does not implicitly compile or start the bot.

`DATABASE_URL` targets the Hensei database. Hensei owns schema and catalogue data
migrations; the bot only reads weapon/summon catalogue data and writes its saved
settings and balances. `DEFAULT_RATEUP_USER_ID` optionally names the Discord user
whose saved rates are used when a caller has none. It is not inferred from the
bot application's client ID. Omit it to use no default featured rates.

Before deploying this version, apply the Hensei typed rate-up identity migration
([API #494](https://github.com/jedmund/hensei-api/pull/494)), Classic III catalogue
migration ([API #493](https://github.com/jedmund/hensei-api/pull/493)), and reviewed
catalogue reconciliation. Stop old bot writers, run the final rate-up backfill
and read-only preflight, and require a clean report before starting this build.
An old bot cannot read selections that have only the new typed reference;
retain a compatible build for rollback rather than deleting those selections.

The catalogue refreshes every 15 minutes. Failed refreshes retain the last
complete snapshot, but simulations refuse snapshots older than one hour.
Missing positive-probability categories produce an explicit incomplete-catalogue
error. Fix the upstream data instead of renormalizing onto an incomplete pool.

Catalogue simulations are hypothetical banners. Category allocations inferred
from supplied in-game tables reproduce their displayed rates, but the tables do
not uniquely reveal unrounded probabilities or establish rules for every banner.
SR-or-higher slots preserve SSR probabilities and allocate the remainder to SR.
Featured percentages are absolute per-draw chances. Roll-until counts complete
ten-draw purchases, yields every 1,000 draws, and stops after 100,000 draws.

## Local simulation CLI

Run simulations without Discord using the same engine as the bot:

```sh
pnpm simulate --mode flash --draws 300 --seed example
pnpm simulate --mode classic_iii --draws 1000
pnpm simulate --mode legend --rateup 1040221700=0.3 --rateup 1040320500=0.3
pnpm simulate --mode premium --singles --draws 25 --json
pnpm simulate --help
```

The CLI reads `DATABASE_URL` from the shell, defaulting to
`postgres://localhost/hensei_dev`; it does not load the bot's `.env` or log in to
Discord. Its PostgreSQL connection is read-only. Run the catalogue migrations
before using it. Ten-draw runs require a multiple of ten and use the SR-or-higher
distribution for every tenth slot; `--singles` uses ordinary odds throughout.
Draw counts are limited to one million. All modes and seasonal filters supported
by the engine are available. Custom rate-ups use game IDs and absolute percentage
values; they do not change saved settings. No saved user rate-ups are loaded.

The default seed is `1`. Matching options and catalogue data reproduce the same
results, regardless of database row order. Text output summarizes rarities and
SSR drops; `--json` includes every observed item count, typed identity, effective
rate-ups, and model assumptions. With pnpm, use `pnpm --silent simulate --json`
for JSON stdout without the package-script banner. Catalogue diagnostics go to
stderr. These are hypothetical catalogue pools, not verified live banners.

For deployment, install all dependencies with the frozen lockfile, run
`pnpm build`, then `pnpm prune --prod`. Retain `package.json`, `build/dist`, and
production `node_modules` together at the application root. Start with
`NODE_ENV=production pnpm start`. TypeScript, tsx, and type declarations are build
or development tools; they are unnecessary for the compiled runtime. Deployment
must finish the build before pruning. The startup smoke test imports real runtime dependencies, replaces login,
and disables dotenv configuration, proving the compiled entry path without contacting Discord
or loading local credentials; it does not prove successful real bot login.

`pnpm format-check` covers maintained tooling, tests, and this README. Existing application source and planning documents are excluded from this
initial formatting baseline to avoid unrelated mechanical changes. `pnpm format`
formats the same set. Existing promise-handling exceptions are listed in
`eslint.config.mjs` and remain follow-up work.
