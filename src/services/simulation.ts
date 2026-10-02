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
  ssrBudget: "https://granbluefantasy.jp/pages/?p=28206",
  guaranteeEvidence: "https://gbf.wiki/News%3AGame_Announcement_JP_6776",
  limitations:
    "No complete recorded banner table obtained; SR and guarantee allocations are explicit custom-model assumptions, not verified live rates",
})
export const CUSTOM_MODEL_ASSUMPTIONS = Object.freeze([
  "Hypothetical catalogue pool; not a current in-game banner",
  "Equal residual probability within each rarity; no universal limited multiplier",
  "SR ordinary budget 15%; guaranteed slot transfers R budget to SR, preserving SSR rates",
  "Catalogue membership does not model Zodiac rotations or spark exchange eligibility",
])
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
}

export function compileSimulation(
  snapshot: CatalogueSnapshot,
  config: SimulationConfig,
) {
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
      for (const item of pool)
        result.push({
          item,
          probability:
            featured.get(drawableIdentity(item)) ??
            (residual.length ? Math.max(0, remaining) / residual.length : 0),
        })
    }
    const total = result.reduce((sum, entry) => sum + entry.probability, 0)
    if (Math.abs(total - 1) > PROBABILITY_TOLERANCE)
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
      rateups
        .map(({ item, rate }) => [drawableIdentity(item), rate])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ]),
    config: Object.freeze({ ...config, rateups }),
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
