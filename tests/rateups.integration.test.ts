import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { Kysely, PostgresDialect } from "kysely"
import { Client, Pool } from "pg"
import type { Database } from "../src/services/connection.js"
import { loadCatalogue } from "../src/services/catalogue.js"
import { RateupStore } from "../src/services/rateupStore.js"

void test(
  "typed rate-ups preserve atomicity, legacy compatibility and concurrent empty-user updates",
  { skip: !process.env.SPARK_TEST_ADMIN_URL },
  async () => {
    const url = new URL(process.env.SPARK_TEST_ADMIN_URL!)
    assert.equal(url.pathname, "/postgres")
    const name = `siero_rates_test_${randomUUID().replaceAll("-", "")}`
    const admin = new Client({ connectionString: url.toString() })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${name}"`)
    url.pathname = `/${name}`
    const observer = new Client({ connectionString: url.toString() })
    const db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: url.toString() }),
      }),
    })
    try {
      await observer.connect()
      await observer.query(`CREATE TABLE weapons (id uuid PRIMARY KEY, granblue_id varchar, name_en varchar, name_jp varchar, element integer, rarity integer, recruits varchar, promotions integer[] NOT NULL);
      CREATE TABLE summons (id uuid PRIMARY KEY, granblue_id varchar, name_en varchar, name_jp varchar, element integer, rarity integer, promotions integer[] NOT NULL);
      CREATE TABLE characters (id uuid PRIMARY KEY, granblue_id varchar, name_en varchar, name_jp varchar, element integer);
      CREATE TABLE gacha (id uuid PRIMARY KEY, drawable_id uuid, drawable_type varchar);
      CREATE TABLE gacha_rateups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, rate numeric NOT NULL, gacha_id uuid REFERENCES gacha(id), drawable_type varchar, drawable_id uuid, CHECK ((drawable_type IS NULL) = (drawable_id IS NULL)));`)
      const ids = [randomUUID(), randomUUID()]
      const legacy = randomUUID()
      for (const [i, id] of ids.entries())
        await observer.query(
          "INSERT INTO weapons VALUES ($1,$2,$3,NULL,1,3,NULL,'{1}')",
          [id, `${i}`, `Item ${i}`],
        )
      await observer.query("INSERT INTO gacha VALUES ($1,$2,'Weapon')", [
        legacy,
        ids[0],
      ])
      const store = new RateupStore(db)
      const items = await loadCatalogue(db)
      const a = [{ item: items[0], rate: 0.3 }]
      const b = [{ item: items[1], rate: 0.4 }]
      await observer.query(
        "INSERT INTO gacha_rateups (user_id,rate,gacha_id) VALUES ('legacy',0.3,$1)",
        [legacy],
      )
      assert.equal((await store.read("legacy"))[0].item.item_id, ids[0])
      await store.replace("new", b)
      assert.equal((await store.read("new"))[0].item.item_id, ids[1])
      assert.equal(
        (
          await observer.query(
            "SELECT gacha_id FROM gacha_rateups WHERE user_id='new'",
          )
        ).rows[0].gacha_id,
        null,
      )
      await store.replace("dual", a)
      assert.equal((await store.read("dual"))[0].item.item_id, ids[0])
      await store.copy("dual", "dual")
      assert.equal((await store.read("dual")).length, 1)
      await observer.query(
        "UPDATE gacha_rateups SET drawable_id=$1 WHERE user_id='dual'",
        [ids[1]],
      )
      await assert.rejects(store.read("dual"), /Conflicting/)
      await store.replace("dual", a)
      await observer.query(
        "ALTER TABLE gacha_rateups ADD CONSTRAINT fail_insert CHECK (user_id <> 'dual' OR rate <> 0.4)",
      )
      await assert.rejects(store.replace("dual", b))
      assert.equal((await store.read("dual"))[0].rate, 0.3)
      await observer.query(
        "ALTER TABLE gacha_rateups DROP CONSTRAINT fail_insert",
      )
      await assert.rejects(store.replace("dual", [...a, ...a]))
      assert.equal((await store.read("dual")).length, 1)
      await observer.query("BEGIN")
      await observer.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('empty', 0))",
      )
      const concurrent = Promise.all([
        store.replace("empty", a),
        store.replace("empty", b),
      ])
      const deadline = Date.now() + 10000
      let blocked = 0
      while (Date.now() < deadline) {
        blocked = Number(
          (
            await observer.query(
              "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock'",
              [name],
            )
          ).rows[0].n,
        )
        if (blocked === 2) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      assert.equal(
        blocked,
        2,
        "Both replacements must wait even for a user with no rows",
      )
      await observer.query("COMMIT")
      await concurrent
      const result = await store.read("empty")
      assert.equal(result.length, 1)
      assert.ok([0.3, 0.4].includes(result[0].rate))
      await store.reset("empty")
      assert.deepEqual(await store.read("empty"), [])
      await observer.query("DROP TABLE gacha_rateups")
      await assert.rejects(store.read("empty"))
    } finally {
      await db.destroy()
      await observer.end()
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      await admin.end()
    }
  },
)
