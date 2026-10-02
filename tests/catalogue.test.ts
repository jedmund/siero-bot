import assert from "node:assert/strict"
import test from "node:test"
import type { Kysely } from "kysely"
import type { Database } from "../src/services/connection.js"
import { loadCatalogue } from "../src/services/catalogue.js"
import Gacha from "../src/services/gacha.js"
import Api from "../src/services/api.js"
import Cache from "../src/services/cache.js"
import { Promotion, Rarity } from "../src/utils/enums.js"

void test("direct catalogue adapter selects each Classic pool and duplicate recruits never multiply draws", async () => {
  const tables = {
    weapons: [2, 3, 12].map((promotion, index) => ({
      id: `weapon-${index}`,
      granblue_id: `${index}`,
      name_en: `Weapon ${index}`,
      name_jp: null,
      element: null,
      rarity: 3,
      recruits: "duplicate",
      promotions: [promotion, 99],
    })),
    summons: [
      {
        id: "shared",
        granblue_id: "4",
        name_en: "Shared",
        name_jp: null,
        rarity: 3,
        element: 1,
        promotions: [1, 12],
      },
    ],
    characters: ["first", "second"].map((id) => ({
      id,
      granblue_id: "duplicate",
      name_en: id,
      name_jp: null,
      element: 1,
      rarity: 3,
    })),
    gacha: [],
  }
  const db = {
    selectFrom: (table: keyof typeof tables) => ({
      selectAll: () => ({ execute: async () => tables[table] }),
      select: () => ({ execute: async () => tables[table] }),
    }),
  } as unknown as Kysely<Database>
  const items = await loadCatalogue(db)
  assert.equal(items.length, 4)
  assert.ok(
    items.every(
      (item) => !item.recruits && !item.legacyGachaId && item.id === "",
    ),
  )
  assert.deepEqual(items[0].promotionIds, [2, 99])
  const cache = new Cache()
  cache._characterWeapons[Rarity.SSR] = items.filter(
    (item) => item.drawableType === "Weapon",
  )
  cache._summons[Rarity.SSR] = items.filter(
    (item) => item.drawableType === "Summon",
  )
  cache._nonCharacterWeapons[Rarity.SSR] = []
  for (const [mode, expected] of [
    [Promotion.CLASSIC, "weapon-0"],
    [Promotion.CLASSIC_II, "weapon-1"],
    [Promotion.CLASSIC_III, "weapon-2"],
  ] as const) {
    assert.equal(cache.characterWeapons(Rarity.SSR, mode).length, 1)
    assert.equal(
      cache.fetchWeapon(Rarity.SSR, [], undefined, mode).item_id,
      expected,
    )
    assert.equal(cache.fetchItem(Rarity.SSR, mode).promotions[mode], true)
  }
  assert.equal(
    cache.summons(Rarity.SSR, Promotion.CLASSIC_III)[0].item_id,
    "shared",
  )
  assert.equal(
    cache.summons(Rarity.SSR, Promotion.PREMIUM)[0].item_id,
    "shared",
  )
  assert.throws(
    () => cache.filterItem(items[0], "unknown" as Promotion),
    /Unsupported/,
  )
})

void test("same Gacha engine draws all Classic modes with UUID exclusions and 3% SSR budgets", () => {
  const cache = new Cache()
  for (const rarity of [Rarity.R, Rarity.SR, Rarity.SSR]) {
    cache._characterWeapons[rarity] = []
    cache._summons[rarity] = []
    cache._nonCharacterWeapons[rarity] = []
    for (const mode of [
      Promotion.CLASSIC,
      Promotion.CLASSIC_II,
      Promotion.CLASSIC_III,
    ]) {
      cache._characterWeapons[rarity].push({
        id: "",
        item_id: `${mode}-${rarity}`,
        granblue_id: "",
        type: 0,
        name: { en: mode, jp: "" },
        rarity,
        element: 0,
        promotions: {
          premium: false,
          classic: mode === Promotion.CLASSIC,
          classic_ii: mode === Promotion.CLASSIC_II,
          classic_iii: mode === Promotion.CLASSIC_III,
          flash: false,
          legend: false,
        },
        seasons: {
          summer: false,
          valentines: false,
          halloween: false,
          holiday: false,
        },
      })
    }
  }
  for (const mode of [
    Promotion.CLASSIC,
    Promotion.CLASSIC_II,
    Promotion.CLASSIC_III,
  ]) {
    const engine = new Gacha([], mode, undefined, cache)
    assert.equal(engine.rates.weapon.rate, 3)
    const result = engine.tenPartRoll(100)
    assert.ok(result.items.every((item) => item.promotions[mode]))
    const item = cache.characterWeapons(Rarity.SSR, mode)[0]
    assert.throws(
      () => new Gacha([{ item, rate: 4 }], mode, undefined, cache),
      /budget/,
    )
    assert.throws(
      () => new Gacha([{ item, rate: NaN }], mode, undefined, cache),
      /finite/,
    )
    assert.throws(
      () =>
        new Gacha(
          [
            { item, rate: 1 },
            { item: { ...item }, rate: 1 },
          ],
          mode,
          undefined,
          cache,
        ),
      /Duplicate/,
    )
    const full = new Gacha([{ item, rate: 3 }], mode, undefined, cache)
    assert.ok(Number.isFinite(full.rates.weapon.rate))
    assert.equal(full.rates.weapon.rate, 0)
    assert.throws(
      () => Api.validateRateups([{ item, rate: 1 }]),
      /identity migration/,
    )
  }
})
