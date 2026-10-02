# Spark persistence contract

Spark add, remove, update and reset run in one PostgreSQL transaction. An initial
`INSERT ... ON CONFLICT DO NOTHING` handles missing users through the unique
`user_id` index; `SELECT ... FOR UPDATE` then serializes all changes to that user.
Arithmetic happens in PostgreSQL, and the transaction returns its locked previous
balance and committed replacement. Guild membership is a sorted union, so
concurrent commands from different servers preserve both memberships. Independent
users do not share a lock. Older bot processes must be stopped before rollout:
their stale read/replace commands do not follow this contract.

Add/remove/update require at least one supplied currency. Explicit zero is valid;
omitted fields are preserved. Amounts must be integers between zero and 2147483647. Removal clamps to zero. Accumulated integer overflow rolls back every
currency, guild addition and timestamp change. Reset creates a zero record on
first use and clears all currencies while preserving goals and guild membership.

Nullable legacy currencies are read as zero in progress, leaderboard and mutation
results; the next successful mutation stores zeros for those null fields. This
matches existing empty-balance meanings without a bulk migration. A read-only local
aggregate on 2026-10-02 found 48 rows and zero rows with null currencies. Production
was not audited; no data repair or constraints are introduced. `target_id` remains
nullable bigint (pg returns bigint as a string), never a generated ID.

Every successful mutation, including zero amounts and reset, assigns PostgreSQL
`clock_timestamp() AT TIME ZONE 'UTC'` to the existing timestamp-without-time-zone
column. Leaderboard freshness compares against database UTC with the same
14-day window. Discord replies use committed values; a failed reply after commit
must not tell the user that saving failed.

Run the integration suite with an explicit admin connection to the maintenance
`postgres` database, for example:

```sh
SPARK_TEST_ADMIN_URL=postgres://localhost/postgres pnpm test:integration
```

Tests create and drop a random `siero_sparks_test_*` database. They never load the
bot `.env`. Two independent single-connection pools are held behind database locks;
the tests inspect `pg_stat_activity` to confirm both operations reached the lock
before release. This covers absent-user creation, additions, guild unions,
replacement/reset ordering, clamping, legacy nulls and overflow rollback. Without
an explicit admin URL, the integration test skips; CI supplies it.
