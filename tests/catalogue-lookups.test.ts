import assert from "node:assert/strict"
import test from "node:test"
import type { Kysely } from "kysely"
import type { Database } from "../src/services/connection.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import Api from "../src/services/api.js"
import Cache, {
  catalogueCache,
  CatalogueUnavailableError,
} from "../src/services/cache.js"
import { RateupStore } from "../src/services/rateupStore.js"
import { DrawableItemType, Promotion, Season } from "../src/utils/enums.js"

function item(id: string, promotion: Promotion, season?: Season): DrawableItem {
  return {
    id: "",
    item_id: id,
    drawableId: id,
    drawableType: "Weapon",
    granblue_id: id,
    type: DrawableItemType.WEAPON,
    rarity: 3,
    element: 1,
    name: { en: "Silver Vine", jp: "銀の蔓" },
    promotions: {
      premium: false,
      classic: false,
      classic_ii: false,
      classic_iii: false,
      flash: false,
      legend: false,
      [promotion]: true,
    },
    seasons: {
      summer: false,
      valentines: false,
      halloween: false,
      holiday: false,
      ...(season ? { [season]: true } : {}),
    },
  }
}

void test("catalogue reads coalesce cold loads and retain a valid snapshot during refresh failures", async () => {
  let loads = 0
  let now = 0
  let fail = false
  const source = item("one", Promotion.PREMIUM)
  const cache = new Cache(
    async () => {
      loads++
      if (fail) throw new Error("database offline")
      return [source]
    },
    () => now,
    60_000,
  )
  const [first, second] = await Promise.all([cache.read(), cache.read()])
  assert.equal(loads, 1)
  assert.equal(first, second)
  assert.ok(Object.isFrozen(first[0].name))
  await cache.read()
  assert.equal(loads, 1)
  fail = true
  now = 30_000
  await assert.rejects(cache.refresh(), /database offline/)
  assert.equal(await cache.read(), first)
  now = 60_001
  await assert.rejects(cache.read(), CatalogueUnavailableError)
  fail = false
  await cache.refresh()
  assert.notEqual(await cache.read(), first)
  assert.equal(cache.lastError, undefined)
})

void test("catalogue cold-load failures report availability and can recover", async () => {
  let fail = true
  const cache = new Cache(async () => {
    if (fail) throw new Error("database offline")
    return [item("one", Promotion.PREMIUM)]
  })
  await assert.rejects(cache.read(), CatalogueUnavailableError)
  fail = false
  assert.equal((await cache.read()).length, 1)
})

void test("lookups filter before pagination and preserve typed IDs, seasons and Classic isolation", async (t) => {
  const ordinary = item("shared", Promotion.PREMIUM)
  const flash = item("flash", Promotion.FLASH)
  const classic = item("classic", Promotion.CLASSIC_III)
  const formal = item("formal", Promotion.PREMIUM, Season.FORMAL)
  formal.promotions.premium = false
  formal.recruits = {
    id: "character",
    granblue_id: "character-id",
    name: { en: "Europa", jp: "エウロペ" },
  }
  const summon = {
    ...ordinary,
    drawableType: "Summon" as const,
    type: DrawableItemType.SUMMON,
  }
  const items = [classic, formal, ordinary, flash, summon]
  t.mock.method(catalogueCache, "read", async () => items)
  const premium = { promotion: Promotion.PREMIUM }
  const gala = { promotion: Promotion.FLASH }
  const seasonal = { promotion: Promotion.FLASH, season: Season.FORMAL }
  assert.deepEqual(
    (await Api.findItem("Silver Vine", 10, 0, premium)).map(
      (i) => i.drawableType,
    ),
    ["Weapon", "Summon"],
  )
  assert.equal((await Api.findItem("銀", 1, 1, gala))[0].item_id, "shared")
  assert.equal((await Api.findItem("Europa", 10, 0, seasonal))[0], formal)
  assert.deepEqual(await Api.findItem("Europa", 10, 0, gala), [])
  assert.deepEqual(
    await Api.findItem("Silver", 10, 0, { promotion: Promotion.CLASSIC_III }),
    [classic],
  )
  assert.equal(await Api.fetchItemInfoFromID("formal", gala), null)
  assert.equal(await Api.fetchItemInfoFromID("character-id", seasonal), formal)
  assert.equal(
    await Api.fetchItemInfoFromReference("Weapon:formal", gala),
    null,
  )
  assert.equal(
    await Api.fetchItemInfoFromReference("Weapon:shared", premium),
    ordinary,
  )
  assert.equal(
    await Api.fetchItemInfoFromReference("Summon:shared", premium),
    summon,
  )
  await assert.rejects(Api.fetchItemInfoFromID("shared", premium), /Ambiguous/)
  await assert.rejects(
    Api.findItem("Silver", 10, 0, {
      promotion: Promotion.CLASSIC,
      season: Season.FORMAL,
    }),
    /Classic pools/,
  )
  assert.equal((await Api.findItem("Silver")).length, 5)
})

void test("saved-rate reads use their cached catalogue and empty settings avoid catalogue reads", async () => {
  const target = item("shared", Promotion.PREMIUM)
  let rows = [{ type: "Weapon", itemId: "shared", rate: "0.3" }]
  let loads = 0
  const query = {
    select: () => query,
    where: () => query,
    execute: async () => rows,
  }
  const db = {
    selectFrom: (table: string) => {
      assert.equal(table, "gacha_rateups")
      return query
    },
  } as unknown as Kysely<Database>
  const store = new RateupStore(db, async () => {
    loads++
    return [target]
  })
  assert.deepEqual(await store.read("user"), [{ item: target, rate: 0.3 }])
  rows = []
  assert.deepEqual(await store.read("user"), [])
  assert.equal(loads, 1)
})

void test("transactional saved-rate reads bypass cached catalogue data", async () => {
  const tables = {
    gacha_rateups: [{ type: "Weapon", itemId: "fresh", rate: "0.3" }],
    weapons: [
      {
        id: "fresh",
        granblue_id: "fresh",
        name_en: "Fresh",
        name_jp: null,
        element: 1,
        rarity: 3,
        recruits: null,
        promotions: [1],
      },
    ],
    summons: [],
    characters: [],
  }
  const queried: string[] = []
  const transaction = {
    selectFrom: (table: keyof typeof tables) => {
      queried.push(table)
      const query = {
        select: () => query,
        where: () => query,
        execute: async () => tables[table],
      }
      return query
    },
  } as unknown as Kysely<Database>
  const store = new RateupStore({} as Kysely<Database>, async () => {
    throw new Error("Transactions must not consult the cache")
  })
  const rates = await store.read("user", transaction)
  assert.equal(rates[0].item.item_id, "fresh")
  assert.deepEqual(queried, [
    "gacha_rateups",
    "weapons",
    "summons",
    "characters",
  ])
})
