import assert from "node:assert/strict"
import test from "node:test"
import {
  compileSimulation,
  drawDistribution,
  validateRateups,
  drawableIdentity,
} from "../src/services/simulation.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import {
  DrawableItemType,
  Element,
  Promotion,
  Rarity,
  Season,
} from "../src/utils/enums.js"

function item(
  id: string,
  rarity: Rarity,
  promotion: Promotion = Promotion.PREMIUM,
): DrawableItem {
  return {
    id,
    item_id: id,
    granblue_id: id,
    type: DrawableItemType.WEAPON,
    name: { en: "same", jp: "" },
    rarity,
    element: Element.NULL,
    promotions: {
      premium: false,
      classic: false,
      flash: false,
      legend: false,
      [promotion]: true,
    },
    seasons: {
      summer: false,
      holiday: false,
      halloween: false,
      valentines: false,
    },
  }
}
const snapshot = (items: DrawableItem[]) => ({
  id: "fixture",
  loadedAt: "2026-10-02",
  items,
})
const probability = (
  distribution: ReturnType<typeof compileSimulation>["ordinary"],
  target: DrawableItem,
) =>
  distribution.find(
    (entry) => drawableIdentity(entry.item) === drawableIdentity(target),
  )?.probability

for (const gala of Object.values(Promotion))
  void test(`${gala} conserves ordinary and guaranteed probability`, () => {
    const items = [
      item("r", Rarity.R, gala),
      item("sr", Rarity.SR, gala),
      item("ssr", Rarity.SSR, gala),
    ]
    const result = compileSimulation(snapshot(items), { gala, rateups: [] })
    for (const distribution of [result.ordinary, result.guaranteed])
      assert.ok(
        Math.abs(
          distribution.reduce((sum, entry) => sum + entry.probability, 0) - 1,
        ) < 1e-12,
      )
    const ssr = [Promotion.FLASH, Promotion.LEGEND].includes(gala) ? 0.06 : 0.03
    assert.equal(probability(result.ordinary, items[2]), ssr)
    assert.equal(probability(result.guaranteed, items[2]), ssr)
    assert.equal(probability(result.guaranteed, items[0]), 0)
    assert.equal(drawDistribution(result.guaranteed, () => 0).rarity, Rarity.SR)
  })
void test("unconditional rateups retain configured chance and identity excludes residual", () => {
  const target = item("target", Rarity.SSR)
  const items = [
    item("r", Rarity.R),
    item("sr", Rarity.SR),
    target,
    { ...target },
    item("other", Rarity.SSR),
  ]
  const result = compileSimulation(snapshot(items), {
    gala: Promotion.PREMIUM,
    rateups: [{ item: { ...target }, rate: 0.3 }],
  })
  assert.equal(probability(result.ordinary, target), 0.003)
  assert.equal(probability(result.guaranteed, target), 0.003)
  assert.equal(
    result.ordinary.filter((entry) => entry.item.item_id === "target").length,
    1,
  )
  assert.ok(Math.abs(probability(result.ordinary, items[4])! - 0.027) < 1e-12)
})
void test("full allocation supports zero residual; missing residual fails", () => {
  const ssr = item("ssr", Rarity.SSR)
  const items = [item("r", Rarity.R), item("sr", Rarity.SR), ssr]
  assert.equal(
    probability(
      compileSimulation(snapshot(items), {
        gala: Promotion.PREMIUM,
        rateups: [{ item: ssr, rate: 3 }],
      }).ordinary,
      ssr,
    ),
    0.03,
  )
  assert.throws(
    () =>
      compileSimulation(snapshot(items), {
        gala: Promotion.PREMIUM,
        rateups: [{ item: ssr, rate: 0 }],
      }),
    /residual/,
  )
  assert.throws(
    () =>
      compileSimulation(snapshot([]), { gala: Promotion.PREMIUM, rateups: [] }),
    /residual/,
  )
})
void test("invalid percentages, duplicates, unavailable selections rejected before draws", () => {
  const ssr = item("ssr", Rarity.SSR)
  for (const rate of [NaN, Infinity, -1, 3.01])
    assert.throws(() =>
      validateRateups([ssr], [{ item: ssr, rate }], Promotion.PREMIUM),
    )
  assert.throws(
    () =>
      validateRateups(
        [ssr],
        [
          { item: ssr, rate: 0 },
          { item: { ...ssr }, rate: 0 },
        ],
        Promotion.PREMIUM,
      ),
    /Duplicate/,
  )
  assert.throws(
    () =>
      validateRateups(
        [ssr],
        [{ item: item("missing", Rarity.SSR), rate: 0 }],
        Promotion.PREMIUM,
      ),
    /unavailable/,
  )
  assert.throws(
    () =>
      validateRateups(
        [item("sr", Rarity.SR)],
        [{ item: item("sr", Rarity.SR), rate: 0 }],
        Promotion.PREMIUM,
      ),
    /SSR/,
  )
  assert.equal(validateRateups([ssr], [{ item: ssr, rate: 6 }]).length, 1)
})
void test("season membership union keeps ordinary items and exact Classic membership", () => {
  const seasonal = item("summer", Rarity.SSR, Promotion.FLASH)
  seasonal.promotions.flash = false
  seasonal.seasons.summer = true
  const flash = item("flash", Rarity.SSR, Promotion.FLASH)
  const classic = item("classic", Rarity.SSR, Promotion.CLASSIC_III)
  const items = [
    item("r", Rarity.R),
    item("sr", Rarity.SR),
    item("ordinary", Rarity.SSR),
    seasonal,
    flash,
    classic,
  ]
  const result = compileSimulation(snapshot(items), {
    gala: Promotion.FLASH,
    season: Season.SUMMER,
    rateups: [],
  })
  assert.deepEqual(
    result.ordinary
      .filter((entry) => entry.item.rarity === Rarity.SSR)
      .map((entry) => entry.item.item_id),
    ["ordinary", "summer", "flash"],
  )
  assert.throws(
    () =>
      compileSimulation(snapshot(items), {
        gala: Promotion.CLASSIC_III,
        season: Season.SUMMER,
        rateups: [],
      }),
    /seasonal/,
  )
})
void test("typed identity keeps same UUID weapon and summon distinct; RNG boundaries", () => {
  const weapon = item("ssr", Rarity.SSR)
  const summon = { ...weapon, type: DrawableItemType.SUMMON }
  const result = compileSimulation(
    snapshot([item("r", Rarity.R), item("sr", Rarity.SR), weapon, summon]),
    { gala: Promotion.PREMIUM, rateups: [] },
  )
  assert.equal(result.ordinary.length, 4)
  for (const value of [-0.1, 1, NaN, Infinity])
    assert.throws(
      () => drawDistribution(result.ordinary, () => value),
      /Random/,
    )
  for (const entry of result.ordinary.filter(
    (entry) => entry.probability > 0,
  )) {
    const index = result.ordinary.indexOf(entry)
    const prior = result.ordinary
      .slice(0, index)
      .reduce((sum, row) => sum + row.probability, 0)
    assert.equal(
      drawDistribution(result.ordinary, () => prior + entry.probability / 2),
      entry.item,
    )
  }
})
