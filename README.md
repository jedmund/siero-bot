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
unique `siero_sparks_test_*` database. Set `SPARK_TEST_ADMIN_URL` to a PostgreSQL
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

For deployment, install all dependencies with the frozen lockfile, run
`pnpm build`, then `pnpm prune --prod`. Retain `package.json`, `build/dist`, and
production `node_modules` together at the application root. Start with
`NODE_ENV=production pnpm start`. TypeScript, tsx, and type declarations are build
or development tools; they are unnecessary for the compiled runtime. Deployment
must finish the build before pruning. The startup smoke test imports real runtime dependencies, replaces login,
and disables dotenv configuration, proving the compiled entry path without contacting Discord
or loading local credentials; it does not prove successful real bot login.

`pnpm format-check` covers maintained tooling, tests, this README, and the dependency
report. Existing application source and planning documents are excluded from this
initial formatting baseline to avoid unrelated mechanical changes. `pnpm format`
formats the same set. See [the dependency report](docs/dependencies.md) for audit
results and the remaining promise-lint baseline.
