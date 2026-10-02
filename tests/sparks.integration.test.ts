import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { Kysely, PostgresDialect } from "kysely"
import { Client, Pool } from "pg"
import type { Database } from "../src/services/connection.js"
import {
  SparkService,
  SparkInputError,
  SparkOverflowError,
  MAX_SPARK_AMOUNT,
} from "../src/services/sparks.js"

const adminUrl = process.env.SPARK_TEST_ADMIN_URL

test(
  "spark mutations serialize on disposable PostgreSQL",
  { skip: !adminUrl },
  async () => {
    const url = new URL(adminUrl!)
    assert.equal(
      url.pathname,
      "/postgres",
      "Admin URL must target postgres, never an application database",
    )
    const name = `siero_sparks_test_${randomUUID().replaceAll("-", "")}`
    const admin = new Client({ connectionString: url.toString() })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${name}"`)
    url.pathname = `/${name}`
    const observer = new Client({ connectionString: url.toString() })
    const dbs = ["spark_test_a", "spark_test_b"].map(
      (application_name) =>
        new Kysely<Database>({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: url.toString(),
              max: 1,
              application_name,
            }),
          }),
        }),
    )
    const [a, b] = dbs.map((db) => new SparkService(db))
    try {
      await observer.connect()
      await observer.query(`CREATE TABLE sparks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL UNIQUE,
      guild_ids varchar[] NOT NULL, crystals integer DEFAULT 0, tickets integer DEFAULT 0,
      ten_tickets integer DEFAULT 0, target_id bigint, target_type varchar, target_memo varchar,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
      async function waitBlocked(count: number) {
        const deadline = Date.now() + 10000
        while (Date.now() < deadline) {
          const result = await observer.query(
            "SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname = $1 AND application_name LIKE 'spark_test_%' AND wait_event_type = 'Lock'",
            [name],
          )
          if (result.rows[0].n === count) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(
          `Expected ${count} independent clients waiting on database locks`,
        )
      }
      const blocker = new Client({ connectionString: url.toString() })
      await blocker.connect()
      try {
        // Hold an uncommitted first-use insert: both service connections must reach
        // the unique-index conflict before release, proving the missing-user race.
        await blocker.query("BEGIN")
        await blocker.query(
          "INSERT INTO sparks(user_id,guild_ids) VALUES ('new', '{}')",
        )
        const first = a.mutate("new", "add", { crystals: 10 }, ["guild-a"])
        await waitBlocked(1)
        const second = b.mutate("new", "add", { crystals: 20 }, ["guild-b"])
        await waitBlocked(2)
        await blocker.query("ROLLBACK")
        const results = await Promise.all([first, second])
        assert.equal(
          results.reduce(
            (sum, result) =>
              sum + result.current.crystals - result.previous.crystals,
            0,
          ),
          30,
        )
        const persisted = await observer.query(
          "SELECT * FROM sparks WHERE user_id='new'",
        )
        assert.equal(persisted.rows[0].crystals, 30)
        assert.deepEqual(persisted.rows[0].guild_ids, ["guild-a", "guild-b"])
        assert.deepEqual(
          results
            .map((result) => result.previous.crystals)
            .sort((x, y) => x - y),
          [0, results[0].previous.crystals === 0 ? 10 : 20],
        )

        async function race(
          left: () => ReturnType<SparkService["mutate"]>,
          right: () => ReturnType<SparkService["mutate"]>,
        ) {
          await blocker.query("BEGIN")
          await blocker.query(
            "SELECT * FROM sparks WHERE user_id='new' FOR UPDATE",
          )
          const one = left()
          await waitBlocked(1)
          const two = right()
          await waitBlocked(2)
          await blocker.query("COMMIT")
          return Promise.all([one, two])
        }
        const replacements = await race(
          () => a.mutate("new", "update", { crystals: 100 }),
          () => b.mutate("new", "add", { crystals: 7 }),
        )
        assert.equal(replacements[0].current.crystals, 100)
        assert.equal(replacements[1].previous.crystals, 100)
        assert.equal(replacements[1].current.crystals, 107)
        const reset = await race(
          () => a.mutate("new", "reset"),
          () => b.mutate("new", "remove", { crystals: 1000 }),
        )
        assert.equal(reset[1].previous.crystals, 0)
        assert.equal(reset[1].current.crystals, 0)
        await a.mutate("new", "update", { tickets: 15, ten_tickets: 2 })
        const removals = await race(
          () => a.mutate("new", "remove", { tickets: 10 }),
          () => b.mutate("new", "remove", { tickets: 10 }),
        )
        assert.equal(removals[1].current.tickets, 0)
        assert.equal(removals[1].current.ten_tickets, 2)
      } finally {
        await blocker.end()
      }

      await assert.rejects(a.mutate("invalid", "add", {}), SparkInputError)
      for (const crystals of [-1, 1.5, NaN, Infinity, MAX_SPARK_AMOUNT + 1]) {
        await assert.rejects(
          a.mutate("invalid", "update", { crystals }),
          SparkInputError,
        )
      }
      assert.equal(
        (
          await observer.query(
            "SELECT count(*)::integer AS n FROM sparks WHERE user_id='invalid'",
          )
        ).rows[0].n,
        0,
      )
      await observer.query(
        "INSERT INTO sparks(user_id,guild_ids,crystals,tickets,ten_tickets,updated_at) VALUES ('legacy', '{}', NULL,NULL,NULL,'2000-01-01')",
      )
      const legacy = await a.mutate("legacy", "add", { crystals: 2 })
      assert.deepEqual(legacy.previous, {
        crystals: 0,
        tickets: 0,
        ten_tickets: 0,
      })
      assert.deepEqual(legacy.current, {
        crystals: 2,
        tickets: 0,
        ten_tickets: 0,
      })
      const partial = await a.mutate("legacy", "update", { tickets: 4 })
      assert.deepEqual(partial.current, {
        crystals: 2,
        tickets: 4,
        ten_tickets: 0,
      })
      await a.mutate("legacy", "update", { crystals: MAX_SPARK_AMOUNT })
      const before = (
        await observer.query("SELECT * FROM sparks WHERE user_id='legacy'")
      ).rows[0]
      await assert.rejects(
        a.mutate("legacy", "add", { crystals: 1, tickets: 2 }, [
          "overflow-guild",
        ]),
        SparkOverflowError,
      )
      assert.deepEqual(
        (await observer.query("SELECT * FROM sparks WHERE user_id='legacy'"))
          .rows[0],
        before,
      )
      await observer.query(
        "UPDATE sparks SET updated_at='2000-01-01' WHERE user_id='legacy'",
      )
      await a.mutate("legacy", "reset")
      assert.equal(
        (
          await observer.query(
            "SELECT count(*)::integer AS n FROM sparks WHERE user_id='legacy' AND updated_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '14 days'",
          )
        ).rows[0].n,
        1,
      )
      const firstReset = await a.mutate("reset-first-use", "reset")
      assert.deepEqual(firstReset.current, {
        crystals: 0,
        tickets: 0,
        ten_tickets: 0,
      })
    } finally {
      await Promise.all(dbs.map((db) => db.destroy()))
      await observer.end()
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      await admin.end()
    }
  },
)
