# Dependency and tooling review

Reviewed 2026-10-02. Node 24.21.0 is the supported LTS runtime, with pnpm 10.34.6.
Node type declarations follow major 24. The lockfile fixes resolved dependency
versions; clean development and CI install with `pnpm install --frozen-lockfile`.

Runtime dependencies were refreshed within their existing major versions except
Kysely, upgraded from 0.27 to 0.28.17 for security fixes. The reviewed
[0.28 release notes](https://github.com/kysely-org/kysely/releases/tag/0.28.0)
cover controlled transactions, optional disposal, empty-list handling, query
compiler changes, and internal type removals. This application uses standard
PostgreSQL queries and no custom query compiler or migration API. Compilation
passes without application changes. The newer 0.29 line is deferred to avoid an
unnecessary additional compatibility change.

TypeScript stays on 5.9.3 because current TypeScript 7 exceeds the supported
TypeScript ESLint parser range. dotenv stays on 16.6.1, preserving established
configuration behavior. ESLint was upgraded to 10.11.0 because ESLint 9 is now
unsupported; the existing flat configuration migrates cleanly. globals advances from 16 to 17 to match current Node definitions; other development
tools retain their prior major lines. Node 24 satisfies their engine requirements.
Sources: [Node releases](https://nodejs.org/en/about/previous-releases),
[ESLint support](https://eslint.org/version-support), package registry engine and
peer metadata, and the referenced Kysely release notes.

## Production audit

`pnpm audit --prod --json` reports zero advisories (56 production dependencies):
0 critical, 0 high, 0 moderate, 0 low. The investigated baseline reported 14.
Kysely is 0.28.17; updated discord.js resolves maintained undici and ws versions
(undici 6.29.0 and ws 8.22.0) recorded in `pnpm-lock.yaml`. No advisory suppression or forced transitive override
was necessary. There are no remaining affected packages in this audit snapshot;
this does not imply absence of future advisories or prove reachability of historical
ones. CI reruns the production audit.

The original lockfile was re-audited on the same date and reproduces 14 advisories
(6 high, 5 moderate, 3 low), affecting Kysely (3), ws (2), and undici (9).
Kysely's JSON-path issues are fixed in 0.28.12 and 0.28.17, and its MySQL string
literal issue in 0.28.14. This bot uses PostgreSQL and no JSON-path or `sql.lit`
queries, so the reported MySQL path is inapplicable and the inspected JSON paths
are absent. See the [Kysely security advisories](https://github.com/kysely-org/kysely/security/advisories).
ws fixes memory disclosure and fragment exhaustion in 8.20.1 and 8.21.0;
undici fixes HTTP/cookie/interceptor and WebSocket issues through 6.28.1. Both are
used transitively by Discord libraries, so exposure depends on their actual
protocol paths and remote inputs; this review does not establish historical
exploitability. The updated versions clear all 14 affected-version findings.

A separate deployment directory containing only the manifest, frozen lockfile,
compiled build, smoke hook, and production dependencies passed startup smoke
under Node 24.21.0. No development packages, local credentials, Discord login, or
database connection were used. This verifies the move of build tools to devDependencies.

## Lint baseline

Node globals replace browser globals. Type-aware `no-floating-promises` and
`no-misused-promises` enforce promise handling in application TypeScript and tests.
Seven existing files temporarily disable these two rules: `src/index.ts`,
`src/commands/raid.ts`, `src/commands/rateup.ts`,
`src/scripts/purge-commands.ts`, `src/services/cache.ts`,
`src/services/rateup.ts`, and `src/services/until.ts`. They contain 21 existing
violations; fix and remove the exceptions in the interaction/startup, rate-up,
bounded simulation, and raid lifecycle PRDs. All other lint rules still run for
those files. New service files, including sparks, remain protected.

The tooling test verifies that ESLint actually rejects an unhandled TypeScript
promise outside the exceptions. Another negative fixture proves a broken behavior
assertion exits the test runner unsuccessfully. Compiled startup is checked with
real runtime dependencies, a mocked login method, and dotenv loading disabled.
This does not discover command modules, access PostgreSQL, or authenticate to Discord.

## CI reproducibility

Checkout v6, setup-node v6, and pnpm/action-setup v4 are pinned to reviewed tag
commit SHAs. CI grants only contents read permission and avoids persisting checkout
credentials. Ubuntu 24.04 and PostgreSQL 17.11 are explicit runner/service versions.
The PostgreSQL service exists only for disposable integration databases. Review
pins and the audit report when upgrading tools; no action auto-upgrade is enabled.

ESLint 10 also introduces `no-useless-assignment`; three pre-existing findings
are temporarily scoped out in raid, gacha, and rendering. This adds no behavior
changes and leaves the rule enforced in new files.
