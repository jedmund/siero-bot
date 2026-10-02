import type DrawableItem from "../interfaces/DrawableItem.js"
import type { ItemRateMap } from "../utils/types.js"
import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums.js"

export class SimulationValidationError extends Error {}
export interface CatalogueSnapshot {
  id: string
  loadedAt: string
  items: readonly DrawableItem[]
}
// Local validation protects saved settings; all probability compilation and draws live in Hensei.
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
