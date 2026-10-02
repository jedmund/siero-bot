import type DrawableItem from "../interfaces/DrawableItem.js"
import type { ItemRateMap } from "../utils/types.js"
import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums.js"

export class SimulationValidationError extends Error {}
function freezeItem(item: DrawableItem): DrawableItem {
  Object.freeze(item.name)
  Object.freeze(item.promotions)
  Object.freeze(item.seasons)
  if (item.promotionIds) Object.freeze(item.promotionIds)
  if (item.recruits) {
    Object.freeze(item.recruits.name)
    Object.freeze(item.recruits)
  }
  return Object.freeze(item)
}
export interface CatalogueSnapshot {
  id: string
  loadedAt: string
  items: readonly DrawableItem[]
}
export const PROBABILITY_TOLERANCE = 1e-12
// Verified 2026-10-02: official announcement confirms normal 3% / gala 6% SSR.
// It states selected limited weapons have higher rates, but no universal multiplier.
export const RULE_PROVENANCE = Object.freeze({
  verifiedAt: "2026-10-02",
  recordedTables: "tests/fixtures/user-banner-rates.json",
  ssrBudget: "https://granbluefantasy.jp/pages/?p=28206",
  guaranteeEvidence: "https://gbf.wiki/News%3AGame_Announcement_JP_6776",
  limitations:
    "Supplied in-game rate-table projection has no banner ID or unrounded probabilities; category budgets are inferred from counts and truncation intervals, not uniquely recoverable universal rules",
})
export const CUSTOM_MODEL_ASSUMPTIONS = Object.freeze([
  "Hypothetical catalogue pool; not a current in-game banner",
  "R category shares 12:42:25 and SR 5:6:4 inferred from supplied banner; extrapolation to other banners",
  "Guaranteed slot scales SR category shares to the non-SSR budget; SSR probabilities unchanged",
  "SSR weapon:summon shares 11:4 inferred from supplied banner table; other banners are hypothetical extrapolations",
  "Higher-weight residual weapons use weight 2; explicit profile identities or hypothetical selected-gala limited membership",
  "Featured rates deduct from their category; an exhausted category borrows from the other category while featured probabilities remain exact",
  "Catalogue membership does not model Zodiac rotations or spark exchange eligibility",
])
export type DrawCategory = "characterWeapon" | "weapon" | "summon"
export type CategoryShares = Readonly<Record<DrawCategory, number>>
export const DEFAULT_CATEGORY_SHARES = Object.freeze({
  R: Object.freeze({ characterWeapon: 12, weapon: 42, summon: 25 }),
  SR: Object.freeze({ characterWeapon: 5, weapon: 6, summon: 4 }),
})
export function drawCategory(item: DrawableItem): DrawCategory {
  if (item.type === DrawableItemType.SUMMON) return "summon"
  return item.drawCategory ?? (item.recruits ? "characterWeapon" : "weapon")
}
function residualWeight(item: DrawableItem, config: SimulationConfig): number {
  if (item.type !== DrawableItemType.WEAPON) return 1
  if (config.higherWeightIdentities)
    return config.higherWeightIdentities.includes(drawableIdentity(item))
      ? 2
      : 1
  return (config.gala === Promotion.FLASH ||
    config.gala === Promotion.LEGEND) &&
    item.promotions[config.gala] &&
    !item.promotions.premium
    ? 2
    : 1
}
export const drawableIdentity = (item: DrawableItem) =>
  `${item.drawableType ?? (item.type === DrawableItemType.WEAPON ? "Weapon" : "Summon")}:${item.drawableId ?? item.item_id}`

export function isEligibleItem(
  item: DrawableItem,
  gala: Promotion,
  season?: Season,
) {
  if (!Object.values(Promotion).includes(gala))
    throw new SimulationValidationError(`Unsupported promotion: ${gala}`)
  if (
    [Promotion.CLASSIC, Promotion.CLASSIC_II, Promotion.CLASSIC_III].includes(
      gala,
    )
  ) {
    if (season)
      throw new SimulationValidationError(
        "Classic pools do not support seasonal filters",
      )
    return !!item.promotions[gala]
  }
  return (
    item.promotions.premium ||
    !!item.promotions[gala] ||
    !!(season && item.seasons[season])
  )
}

export function validateRateups(
  items: readonly DrawableItem[],
  rateups: ItemRateMap,
  gala?: Promotion,
  season?: Season,
): ItemRateMap {
  const pool = new Map(
    items
      .filter((item) =>
        gala
          ? isEligibleItem(item, gala, season)
          : Object.values(Promotion).some((mode) =>
              isEligibleItem(item, mode),
            ) || Object.values(Season).some((value) => item.seasons[value]),
      )
      .map((item) => [drawableIdentity(item), item]),
  )
  const seen = new Set<string>()
  let total = 0
  const validated = rateups.map(({ item, rate }) => {
    const key = drawableIdentity(item)
    if (seen.has(key))
      throw new SimulationValidationError("Duplicate rate-up drawable identity")
    seen.add(key)
    const canonical = pool.get(key)
    if (!canonical)
      throw new SimulationValidationError(
        `Rate-up item ${item.name.en} is unavailable in the selected pool`,
      )
    if (canonical.rarity !== Rarity.SSR || item.rarity !== Rarity.SSR)
      throw new SimulationValidationError(
        "Only SSR items support custom rate-ups",
      )
    if (!Number.isFinite(rate) || rate < 0)
      throw new SimulationValidationError(
        "Rate-up percentages must be finite and nonnegative",
      )
    total += rate
    return { item: canonical, rate }
  })
  const budget =
    gala === undefined || gala === Promotion.FLASH || gala === Promotion.LEGEND
      ? 6
      : 3
  if (total > budget)
    throw new SimulationValidationError(
      `Rate-up percentages exceed the ${budget}% SSR budget`,
    )
  return validated
}
export interface DistributionEntry {
  item: DrawableItem
  probability: number
}
export interface SimulationConfig {
  gala: Promotion
  season?: Season
  rateups: ItemRateMap
  categoryShares?: { R: CategoryShares; SR: CategoryShares }
  ssrCategoryShares?: Readonly<{ weapon: number; summon: number }>
  higherWeightIdentities?: readonly string[]
  profileSource?: string
}

export function compileSimulation(
  snapshot: CatalogueSnapshot,
  config: SimulationConfig,
) {
  const categoryShares = config.categoryShares ?? DEFAULT_CATEGORY_SHARES
  config = {
    ...config,
    categoryShares: Object.freeze({
      R: Object.freeze({ ...categoryShares.R }),
      SR: Object.freeze({ ...categoryShares.SR }),
    }),
    ssrCategoryShares: Object.freeze({
      ...(config.ssrCategoryShares ?? { weapon: 11, summon: 4 }),
    }),
    higherWeightIdentities: config.higherWeightIdentities
      ? Object.freeze([...config.higherWeightIdentities].sort())
      : undefined,
  }
  // Copy at the boundary: a refresh or caller mutation cannot change a running simulation.
  const items = [
    ...new Map(
      snapshot.items
        .filter((item) => isEligibleItem(item, config.gala, config.season))
        .map((item) => [
          drawableIdentity(item),
          freezeItem(structuredClone(item)),
        ]),
    ).values(),
  ]
  const rateups = validateRateups(
    items,
    config.rateups,
    config.gala,
    config.season,
  )
  const featured = new Map(
    rateups.map(({ item, rate }) => [drawableIdentity(item), rate / 100]),
  )
  const ssr =
    config.gala === Promotion.FLASH || config.gala === Promotion.LEGEND
      ? 0.06
      : 0.03
  const build = (guaranteed: boolean) => {
    const result: DistributionEntry[] = []
    const budgets = new Map([
      [Rarity.R, guaranteed ? 0 : 0.85 - ssr],
      [Rarity.SR, guaranteed ? 1 - ssr : 0.15],
      [Rarity.SSR, ssr],
    ])
    for (const [rarity, budget] of budgets) {
      const pool = items.filter((item) => item.rarity === rarity)
      const residual = pool.filter(
        (item) => !featured.has(drawableIdentity(item)),
      )
      const allocated =
        rarity === Rarity.SSR
          ? [...featured.values()].reduce((a, b) => a + b, 0)
          : 0
      const remaining = budget - allocated
      if (remaining < -PROBABILITY_TOLERANCE)
        throw new SimulationValidationError("Negative residual rarity budget")
      if (remaining > PROBABILITY_TOLERANCE && !residual.length)
        throw new SimulationValidationError(
          `No eligible rarity ${rarity} items remain for residual budget`,
        )
      if (rarity !== Rarity.SSR) {
        const shares = (config.categoryShares ?? DEFAULT_CATEGORY_SHARES)[
          rarity === Rarity.R ? "R" : "SR"
        ]
        const totalShares = Object.values(shares).reduce(
          (sum, value) => sum + value,
          0,
        )
        if (
          !Number.isFinite(totalShares) ||
          totalShares <= 0 ||
          [shares.characterWeapon, shares.weapon, shares.summon].some(
            (value) => !Number.isFinite(value) || value < 0,
          )
        )
          throw new SimulationValidationError(
            "Category shares must be finite, nonnegative, and have a positive total",
          )
        for (const category of [
          "characterWeapon",
          "weapon",
          "summon",
        ] as const) {
          const categoryPool = pool.filter(
            (item) => drawCategory(item) === category,
          )
          const categoryBudget = (budget * shares[category]) / totalShares
          if (categoryBudget > PROBABILITY_TOLERANCE && !categoryPool.length)
            throw new SimulationValidationError(
              `Catalogue incomplete: No eligible rarity ${rarity} ${category} items for the category budget; load complete draw-pool membership before simulation`,
            )
          for (const item of categoryPool)
            result.push({
              item,
              probability: categoryPool.length
                ? categoryBudget / categoryPool.length
                : 0,
            })
        }
      } else {
        const summons = residual.filter(
          (item) => drawCategory(item) === "summon",
        )
        const weapons = residual.filter(
          (item) => drawCategory(item) !== "summon",
        )
        const shares = config.ssrCategoryShares ?? { weapon: 11, summon: 4 }
        const shareTotal = shares.weapon + shares.summon
        if (
          !Number.isFinite(shareTotal) ||
          shareTotal <= 0 ||
          !Number.isFinite(shares.weapon) ||
          !Number.isFinite(shares.summon) ||
          shares.weapon < 0 ||
          shares.summon < 0
        )
          throw new SimulationValidationError(
            "SSR category shares must be finite, nonnegative, and have a positive total",
          )
        const allocations = { weapon: 0, summon: 0 }
        for (const { item, rate } of rateups)
          allocations[drawCategory(item) === "summon" ? "summon" : "weapon"] +=
            rate / 100
        const residualBudgets = {
          weapon: Math.max(
            0,
            (budget * shares.weapon) / shareTotal - allocations.weapon,
          ),
          summon: Math.max(
            0,
            (budget * shares.summon) / shareTotal - allocations.summon,
          ),
        }
        const residualTotal = residualBudgets.weapon + residualBudgets.summon
        const weaponBudget = residualTotal
          ? (Math.max(0, remaining) * residualBudgets.weapon) / residualTotal
          : 0
        const summonBudget = residualTotal
          ? (Math.max(0, remaining) * residualBudgets.summon) / residualTotal
          : 0
        if (weaponBudget > PROBABILITY_TOLERANCE && !weapons.length)
          throw new SimulationValidationError(
            "Catalogue incomplete: No eligible SSR weapons for residual category budget",
          )
        if (summonBudget > PROBABILITY_TOLERANCE && !summons.length)
          throw new SimulationValidationError(
            "Catalogue incomplete: No eligible SSR summons for residual category budget",
          )
        const totalWeaponWeight = weapons.reduce(
          (sum, item) => sum + residualWeight(item, config),
          0,
        )
        for (const item of pool)
          result.push({
            item,
            probability:
              featured.get(drawableIdentity(item)) ??
              (drawCategory(item) === "summon"
                ? summonBudget / summons.length
                : totalWeaponWeight
                  ? (weaponBudget * residualWeight(item, config)) /
                    totalWeaponWeight
                  : 0),
          })
      }
    }
    const total = result.reduce((sum, entry) => sum + entry.probability, 0)
    if (!Number.isFinite(total) || Math.abs(total - 1) > PROBABILITY_TOLERANCE)
      throw new SimulationValidationError(
        `Distribution totals ${total}, expected 1`,
      )
    return Object.freeze(result.map((entry) => Object.freeze(entry)))
  }
  for (const rateup of rateups) Object.freeze(rateup)
  Object.freeze(rateups)
  const ordinary = build(false)
  const guaranteed = build(true)
  return Object.freeze({
    snapshotId: snapshot.id,
    configId: JSON.stringify([
      "catalogue-custom",
      snapshot.id,
      config.gala,
      config.season ?? null,
      config.categoryShares ?? DEFAULT_CATEGORY_SHARES,
      config.ssrCategoryShares ?? { weapon: 11, summon: 4 },
      config.higherWeightIdentities ?? "hypothetical-selected-gala",
      config.profileSource ?? "catalogue-extrapolation",
      rateups
        .map(({ item, rate }) => [drawableIdentity(item), rate])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ]),
    config: Object.freeze({
      ...config,
      rateups,
      categoryShares: config.categoryShares ?? DEFAULT_CATEGORY_SHARES,
      ssrCategoryShares: config.ssrCategoryShares ?? { weapon: 11, summon: 4 },
    }),
    assumptions: CUSTOM_MODEL_ASSUMPTIONS,
    ordinary,
    guaranteed,
  })
}
export function drawDistribution(
  distribution: readonly DistributionEntry[],
  random: () => number = Math.random,
) {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new SimulationValidationError(
      "Random source must return a finite number in [0, 1)",
    )
  let cumulative = 0
  for (const entry of distribution) {
    cumulative += entry.probability
    if (value < cumulative) return entry.item
  }
  const last = distribution.findLast((entry) => entry.probability > 0)
  if (!last)
    throw new SimulationValidationError("Cannot draw an empty distribution")
  return last.item
}
