import Cache, { catalogueCache } from "./cache.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import type { RarityCount } from "../interfaces/RarityCount.js"
import type { ItemRateMap } from "../utils/types.js"
import { Promotion, Rarity, Season } from "../utils/enums.js"
import {
  compileSimulation,
  drawDistribution,
  drawableIdentity,
  type CatalogueSnapshot,
} from "./simulation.js"
export { SimulationValidationError } from "./simulation.js"

const cache = catalogueCache
export default class Gacha {
  readonly effective: ReturnType<typeof compileSimulation>
  readonly rateups: ItemRateMap
  readonly rates: { weapon: { rate: number; count: number } }
  constructor(
    rateups: ItemRateMap,
    public gala: Promotion,
    public season?: Season,
    catalogue: Cache | CatalogueSnapshot = cache.snapshot,
    private random: () => number = Math.random,
  ) {
    const captured =
      catalogue instanceof Cache
        ? {
            id: "legacy-test-catalogue",
            loadedAt: new Date().toISOString(),
            items: [Rarity.R, Rarity.SR, Rarity.SSR].flatMap((rarity) => [
              ...(catalogue._characterWeapons[rarity] ?? []),
              ...(catalogue._nonCharacterWeapons[rarity] ?? []),
              ...(catalogue._summons[rarity] ?? []),
            ]),
          }
        : catalogue
    this.effective = compileSimulation(captured, { gala, season, rateups })
    this.rateups = this.effective.config.rateups
    const residual = this.effective.ordinary.filter(
      (entry) =>
        entry.item.rarity === Rarity.SSR &&
        !this.rateups.some(
          (rateup) =>
            drawableIdentity(rateup.item) === drawableIdentity(entry.item),
        ),
    )
    this.rates = {
      weapon: {
        rate: (residual[0]?.probability ?? 0) * 100,
        count: residual.length,
      },
    }
  }
  public static async create(
    rateups: ItemRateMap,
    gala: Promotion,
    season?: Season,
  ) {
    await cache.load()
    return new Gacha(rateups, gala, season, cache.snapshot)
  }
  public canDraw(item: DrawableItem) {
    return this.effective.ordinary.some(
      (entry) =>
        drawableIdentity(entry.item) === drawableIdentity(item) &&
        entry.probability > 0,
    )
  }
  public singleRoll() {
    return drawDistribution(this.effective.ordinary, this.random)
  }
  public tenPartRoll(
    times = 1,
    fetchAllItems = true,
  ): {
    count: RarityCount
    items: DrawableItem[]
    effective?: ReturnType<typeof compileSimulation>
    drawCount?: number
    snapshotId?: string
  } {
    if (!Number.isSafeInteger(times) || times < 0)
      throw new Error("Ten-part count must be a nonnegative safe integer")
    const count: RarityCount = { R: 0, SR: 0, SSR: 0 }
    const items: DrawableItem[] = []
    for (let i = 0; i < times; i++)
      for (let j = 0; j < 10; j++) {
        const item = drawDistribution(
          j === 9 ? this.effective.guaranteed : this.effective.ordinary,
          this.random,
        )
        count[
          item.rarity === Rarity.R
            ? "R"
            : item.rarity === Rarity.SR
              ? "SR"
              : "SSR"
        ]++
        if (fetchAllItems || item.rarity === Rarity.SSR) items.push(item)
      }
    return {
      count,
      items,
      effective: this.effective,
      drawCount: times * 10,
      snapshotId: this.effective.snapshotId,
    }
  }
  public spark() {
    return this.tenPartRoll(30, false)
  }
  public isLimited(item: DrawableItem) {
    return (
      !!(item.promotions.flash || item.promotions.legend) &&
      !item.promotions.premium
    )
  }
  public isSeasonal(item: DrawableItem) {
    return Object.values(item.seasons).some(Boolean) && !item.promotions.premium
  }
  public isClassic(item: DrawableItem) {
    return (
      !!(
        item.promotions.classic ||
        item.promotions.classic_ii ||
        item.promotions.classic_iii
      ) && !item.promotions.premium
    )
  }
  public getSeason(item: DrawableItem) {
    return (
      Object.values(Season).find((season) => item.seasons[season]) ??
      "all seasons"
    )
  }
}
