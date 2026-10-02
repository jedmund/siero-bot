import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { Kysely, PostgresDialect } from "kysely"
import { Client, Pool } from "pg"
import type { Database } from "../src/services/connection.js"
import { loadCatalogue } from "../src/services/catalogue.js"
import Cache from "../src/services/cache.js"
import { Promotion, Rarity } from "../src/utils/enums.js"

void test(
  "catalogue queries retain UUID uniqueness and pool membership on disposable PostgreSQL",
  { skip: !process.env.SPARK_TEST_ADMIN_URL },
  async () => {
    const url = new URL(process.env.SPARK_TEST_ADMIN_URL!)
    assert.equal(url.pathname, "/postgres")
    const name = `siero_catalogue_test_${randomUUID().replaceAll("-", "")}`
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
      CREATE TABLE gacha (id uuid PRIMARY KEY, drawable_id uuid, drawable_type varchar);`)
      const ids = [randomUUID(), randomUUID(), randomUUID()]
      for (const [index, promotion] of [2, 3, 12].entries())
        await observer.query(
          "INSERT INTO weapons VALUES ($1,$2,$3,NULL,NULL,3,'duplicate',$4)",
          [ids[index], `${index}`, `Weapon ${index}`, [promotion]],
        )
      for (const id of [randomUUID(), randomUUID()])
        await observer.query(
          "INSERT INTO characters VALUES ($1,'duplicate','Character',NULL,1)",
          [id],
        )
      const items = await loadCatalogue(db)
      assert.equal(items.length, 3)
      assert.ok(items.every((item) => !item.recruits && !item.legacyGachaId))
      const cache = new Cache()
      cache._characterWeapons[Rarity.SSR] = items
      cache._summons[Rarity.SSR] = []
      cache._nonCharacterWeapons[Rarity.SSR] = []
      for (const [index, mode] of [
        Promotion.CLASSIC,
        Promotion.CLASSIC_II,
        Promotion.CLASSIC_III,
      ].entries()) {
        assert.equal(
          cache.fetchWeapon(Rarity.SSR, [], undefined, mode).item_id,
          ids[index],
        )
        assert.equal(cache.fetchItem(Rarity.SSR, mode).item_id, ids[index])
      }
    } finally {
      await db.destroy()
      await observer.end()
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      await admin.end()
    }
  },
)
