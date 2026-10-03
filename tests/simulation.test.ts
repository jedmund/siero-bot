import assert from "node:assert/strict"
import test from "node:test"
import {
  compileSimulation as compileCategorySimulation,
  drawDistribution,
  validateRateups,
  drawableIdentity,
} from "./reference/simulation.js"
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
const compileSimulation: typeof compileCategorySimulation = (
  snapshot,
  config,
) =>
  compileCategorySimulation(snapshot, {
    ...config,
    ssrCategoryShares: config.ssrCategoryShares ?? { weapon: 1, summon: 0 },
    categoryShares: config.categoryShares ?? {
      R: { characterWeapon: 0, weapon: 1, summon: 0 },
      SR: { characterWeapon: 0, weapon: 1, summon: 0 },
    },
  })
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

void test("captured distributions survive caller mutation and all seasonal selections", () => {
  for (const season of Object.values(Season)) {
    const seasonal = item(season, Rarity.SSR, Promotion.FLASH)
    seasonal.promotions.flash = false
    seasonal.seasons[season] = true
    const items = [item("r", Rarity.R), item("sr", Rarity.SR), seasonal]
    const compiled = compileSimulation(snapshot(items), {
      gala: Promotion.PREMIUM,
      season,
      rateups: [],
    })
    seasonal.name.en = "changed"
    seasonal.seasons[season] = false
    assert.equal(compiled.ordinary[2].item.name.en, "same")
    assert.equal(compiled.ordinary[2].item.seasons[season], true)
    assert.equal(Object.isFrozen(compiled.ordinary[2].item), true)
  }
})

void test("inferred category budgets reproduce supplied R/SR published rates and guaranteed shares", () => {
  const items: DrawableItem[] = []
  for (const [rarity, counts] of [
    [Rarity.R, [58, 65, 24]],
    [Rarity.SR, [111, 36, 21]],
  ] as const) {
    for (const [index, category] of (
      ["characterWeapon", "weapon", "summon"] as const
    ).entries()) {
      for (let n = 0; n < counts[index]; n++)
        items.push({
          ...item(`${rarity}-${category}-${n}`, rarity),
          drawCategory: category,
          type:
            category === "summon"
              ? DrawableItemType.SUMMON
              : DrawableItemType.WEAPON,
        })
    }
  }
  items.push(item("ssr", Rarity.SSR))
  const result = compileCategorySimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups: [],
    ssrCategoryShares: { weapon: 1, summon: 0 },
  })
  for (const [rarity, expected] of [
    [Rarity.R, [0.206, 0.646, 1.041]],
    [Rarity.SR, [0.045, 0.166, 0.19]],
  ] as const) {
    for (const [index, category] of (
      ["characterWeapon", "weapon", "summon"] as const
    ).entries()) {
      const entry = result.ordinary.find(
        (entry) =>
          entry.item.rarity === rarity && entry.item.drawCategory === category,
      )!
      // In-game rates are truncated to three decimal percentage places.
      assert.ok(
        entry.probability * 100 >= expected[index] &&
          entry.probability * 100 < expected[index] + 0.001,
      )
    }
  }
  for (const [index, category] of (
    ["characterWeapon", "weapon", "summon"] as const
  ).entries()) {
    const entry = result.guaranteed.find(
      (entry) =>
        entry.item.rarity === Rarity.SR && entry.item.drawCategory === category,
    )!
    const expected = [0.282, 1.044, 1.193][index]
    assert.ok(
      entry.probability * 100 >= expected &&
        entry.probability * 100 < expected + 0.001,
    )
  }
  assert.equal(
    result.ordinary.find((entry) => entry.item.rarity === Rarity.SSR)
      ?.probability,
    0.06,
  )
  assert.equal(
    result.guaranteed.find((entry) => entry.item.rarity === Rarity.SSR)
      ?.probability,
    0.06,
  )
})
void test("missing positive category budget errors; explicit shares allow restricted custom pools", () => {
  const items = [
    item("r", Rarity.R),
    item("sr", Rarity.SR),
    item("ssr", Rarity.SSR),
  ]
  assert.throws(
    () =>
      compileCategorySimulation(snapshot(items), {
        gala: Promotion.PREMIUM,
        rateups: [],
      }),
    /characterWeapon/,
  )
  assert.doesNotThrow(() =>
    compileSimulation(snapshot(items), {
      gala: Promotion.PREMIUM,
      rateups: [],
    }),
  )
})

void test("supplied banner projection: every displayed rate, exact budgets and unchanged SSR probabilities", async () => {
  const { default: evidence } = await import(
    "./fixtures/user-banner-rates.json",
    { with: { type: "json" } }
  )
  const items = evidence.groups.flatMap((group) =>
    group.rewardIds.map((id) => ({
      ...item(id, (group.rarity - 1) as Rarity),
      granblue_id: id,
      drawCategory: (["characterWeapon", "weapon", "summon"] as const)[
        group.category
      ],
      type:
        group.category === 2
          ? DrawableItemType.SUMMON
          : DrawableItemType.WEAPON,
    })),
  )
  const higherWeightIdentities = items
    .filter((target) =>
      evidence.groups
        .find((group) => group.ordinaryPercent === "0.032")!
        .rewardIds.includes(target.granblue_id),
    )
    .map(drawableIdentity)
  const rateups = items
    .filter((target) =>
      ["1040221700", "1040320500"].includes(target.granblue_id),
    )
    .map((target) => ({ item: target, rate: 0.3 }))
  const result = compileCategorySimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups,
    higherWeightIdentities,
    profileSource: evidence.source,
  })
  assert.equal(items.length, 571)
  for (const [slot, distribution] of [
    ["ordinary", result.ordinary],
    ["guaranteed", result.guaranteed],
  ] as const) {
    assert.ok(
      Math.abs(
        distribution.reduce((sum, entry) => sum + entry.probability, 0) - 1,
      ) < 1e-12,
    )
    for (const entry of distribution) {
      const group = evidence.groups.find((group) =>
        group.rewardIds.includes(entry.item.granblue_id),
      )!
      const displayed =
        slot === "ordinary" ? group.ordinaryPercent : group.guaranteedPercent
      if (displayed === null) assert.equal(entry.probability, 0)
      else
        assert.equal(
          (Math.floor(entry.probability * 100000 + 1e-9) / 1000).toFixed(3),
          displayed,
          `${slot} ${entry.item.granblue_id}`,
        )
      if (entry.item.rarity === Rarity.SSR)
        assert.equal(
          probability(result.ordinary, entry.item),
          probability(result.guaranteed, entry.item),
        )
    }
  }
  for (const target of rateups)
    assert.equal(probability(result.ordinary, target.item), 0.003)
  assert.ok(Object.isFrozen(result.config.higherWeightIdentities))
})

void test("custom featured allocation borrows category budget without changing configured probabilities", () => {
  const weapon = item("featured", Rarity.SSR)
  const summon = {
    ...item("summon", Rarity.SSR),
    type: DrawableItemType.SUMMON,
  }
  const items = [item("r", Rarity.R), item("sr", Rarity.SR), weapon, summon]
  const result = compileSimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups: [{ item: weapon, rate: 5 }],
    ssrCategoryShares: { weapon: 11, summon: 4 },
  })
  assert.equal(probability(result.ordinary, weapon), 0.05)
  assert.ok(Math.abs(probability(result.ordinary, summon)! - 0.01) < 1e-12)
  const full = compileSimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups: [
      { item: weapon, rate: 4 },
      { item: summon, rate: 2 },
    ],
    ssrCategoryShares: { weapon: 11, summon: 4 },
  })
  assert.equal(probability(full.ordinary, weapon), 0.04)
  assert.equal(probability(full.ordinary, summon), 0.02)
})

void test("effective profile copies caller weights and shares and configuration identity distinguishes them", () => {
  const items = [
    item("r", Rarity.R),
    item("sr", Rarity.SR),
    item("ssr", Rarity.SSR),
  ]
  const categoryShares = {
    R: { characterWeapon: 0, weapon: 1, summon: 0 },
    SR: { characterWeapon: 0, weapon: 1, summon: 0 },
  }
  const ssrCategoryShares = { weapon: 1, summon: 0 }
  const higherWeightIdentities = [drawableIdentity(items[2])]
  const compiled = compileCategorySimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups: [],
    categoryShares,
    ssrCategoryShares,
    higherWeightIdentities,
  })
  categoryShares.R.weapon = 0
  ssrCategoryShares.summon = 1
  higherWeightIdentities.push("Weapon:changed")
  assert.equal(compiled.config.categoryShares.R.weapon, 1)
  assert.equal(compiled.config.ssrCategoryShares.summon, 0)
  assert.equal(compiled.config.higherWeightIdentities?.length, 1)
  assert.ok(Object.isFrozen(compiled.config.categoryShares.R))
  const different = compileSimulation(snapshot(items), {
    gala: Promotion.LEGEND,
    rateups: [],
    higherWeightIdentities: [],
  })
  assert.notEqual(compiled.configId, different.configId)
})
