# Operations and schema contract

Status: Planned  
Repository: siero-bot with coordinated Hensei documentation  
Dependencies: Contracts from PRDs 02, 03, 08, and 09  
Parent: [Overall plan](../plan.md)

## Problem and outcome

The README is one sentence, configuration is incomplete, and manually declared database types can compile while disagreeing with Hensei. Make deployment requirements, schema compatibility, data freshness, and failure diagnosis explicit.

## Requirements

- Document installation, pinned tools, environment variables, development versus production startup, Discord scopes/permissions, command registration, and the database ownership boundary. Keep samples free of secrets.
- Add a narrow schema compatibility check covering the bot's required tables, column types, nullability assumptions, and enum mappings. A newer unrelated Hensei migration must not be rejected merely because its version differs.
- Test the contract against disposable PostgreSQL fixtures and a documented Hensei schema snapshot. Determine whether schema-generated types or explicit verified types fit the build best; either approach must detect the UUID/varchar mismatch that previously escaped compilation.
- Provide read-only preflight/postflight commands for catalogue coverage, duplicate identities, rate-up integrity, and cache freshness. Output aggregate diagnostics by default, not Discord user data or credentials.
- Add structured operational logs and lightweight health/readiness information for database connectivity, cache age, command failures/latency, bounded simulation termination, and raid backlog once available.
- Gate verbose SQL/debug logging by environment. Do not force production `DEBUG=*` or log configuration secrets.
- Write the coordinated deployment and rollback runbook, including old-writer quiescence, final backfill, new-only rate-up limitations, failed startup, cache degradation, and raid worker recovery.
- Document who updates catalogue promotions and how the bot refreshes them. A fresh cache timestamp is not proof that upstream catalogue metadata is complete.

## Acceptance and validation

- A maintainer can bring up a development bot from a clean checkout using the documentation and sample configuration.
- Missing or incompatible required columns produce a concise diagnostic before dependent commands run.
- Health checks distinguish ready, degraded, and unready states without leaking sensitive values.
- The runbook is exercised against a disposable database and controlled Discord test environment.
- Links, commands, and migration order match the actual implementation; production assumptions remain explicitly unverified until checked.

## Rollout and exclusions

Update this documentation as each dependent contract lands, before its production rollout. A new hosted monitoring platform, broad Hensei observability rewrite, or collection of message content is not required.
