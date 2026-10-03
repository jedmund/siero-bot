import { randomUUID } from "node:crypto"
import { loadCatalogue } from "./catalogue.js"
import { Client } from "./connection.js"

import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import type { ItemMap } from "../utils/types.js"

export class CatalogueUnavailableError extends Error {}

class Cache {
  _characterWeapons: ItemMap = {}
  _nonCharacterWeapons: ItemMap = {}
  _summons: ItemMap = {}
  private current?: CatalogueSnapshot
  private pending?: Promise<void>
  private timer?: ReturnType<typeof setInterval>
  public lastError?: unknown
  constructor(private loader: () => Promise<DrawableItem[]> = () => loadCatalogue(Client), private now = Date.now, public maximumAgeMs = 60 * 60 * 1000) {}

  public get snapshot(): CatalogueSnapshot {
    if (!this.current || this.ageMs > this.maximumAgeMs) throw new CatalogueUnavailableError("Catalogue is unavailable or stale; please try again later")
    return this.current
  }
  public async read(): Promise<readonly DrawableItem[]> {
    try {
      await this.load()
      return this.snapshot.items
    } catch (cause) {
      throw new CatalogueUnavailableError("Catalogue is unavailable or stale; please try again later", { cause })
    }
  }
  public get ageMs() { return this.current ? this.now() - Date.parse(this.current.loadedAt) : Infinity }
  public load(): Promise<void> { return this.current ? Promise.resolve() : this.refresh() }
  public refresh(): Promise<void> {
    if (this.pending) return this.pending
    this.pending = this.loader().then(items => {
      if (!items.length) throw new Error("Catalogue contains no drawable items")
      const identities = new Set<string>()
      for (const item of items) {
        const identity = `${item.type}:${item.item_id}`
        if (!item.item_id || ![DrawableItemType.WEAPON, DrawableItemType.SUMMON].includes(item.type) || ![Rarity.R, Rarity.SR, Rarity.SSR].includes(item.rarity) || identities.has(identity)) throw new Error("Catalogue contains invalid or duplicate drawable identities")
        identities.add(identity)
      }
      const immutable = deepFreeze(structuredClone(items))
      const snapshot = Object.freeze({ id: randomUUID(), loadedAt: new Date(this.now()).toISOString(), items: immutable })
      const weapons: ItemMap = {}, summons: ItemMap = {}, other: ItemMap = {}
      for (const rarity of [Rarity.R, Rarity.SR, Rarity.SSR]) {
        weapons[rarity] = immutable.filter(item => item.rarity === rarity && item.type === DrawableItemType.WEAPON)
        summons[rarity] = immutable.filter(item => item.rarity === rarity && item.type === DrawableItemType.SUMMON)
        other[rarity] = []
      }
      this._characterWeapons = weapons
      this._summons = summons
      this._nonCharacterWeapons = other
      this.current = snapshot
      this.lastError = undefined
    }).catch((error: unknown) => { this.lastError = error; throw error }).finally(() => { this.pending = undefined })
    return this.pending
  }
  public startRefresh(intervalMs = 15 * 60 * 1000) {
    this.stopRefresh()
    this.timer = setInterval(() => { void this.refresh().catch(error => console.error("Catalogue refresh failed", error)) }, intervalMs)
    this.timer.unref()
  }
  public stopRefresh() { if (this.timer) clearInterval(this.timer); this.timer = undefined }
  public async close() { this.stopRefresh(); await this.pending?.catch(() => undefined) }

  // Subset retrieval methods
  public characterWeapons(rarity: Rarity, gala?: Promotion, season?: Season) {
    return this._characterWeapons[rarity].filter((item: DrawableItem) =>
      this.filterItem(item, gala, season),
    )
  }

  public summons(rarity: Rarity, gala?: Promotion, season?: Season) {
    return this._summons[rarity].filter((item: DrawableItem) =>
      this.filterItem(item, gala, season),
    )
  }

  public limitedWeapons(gala: Promotion) {
    let limitedWeapons: DrawableItem[] = []

    if (gala === Promotion.FLASH) {
      limitedWeapons = this._characterWeapons[Rarity.SSR].filter(
        (item: DrawableItem) =>
          item.promotions.flash && !item.promotions.premium,
      )
    } else if (gala === Promotion.LEGEND) {
      limitedWeapons = this._characterWeapons[Rarity.SSR].filter(
        (item: DrawableItem) =>
          item.promotions.legend && !item.promotions.premium,
      )
    }

    return limitedWeapons
  }

  public filterItem(item: DrawableItem, gala?: Promotion, season?: Season) {
    if (gala && !Object.values(Promotion).includes(gala))
      throw new Error(`Unsupported promotion: ${gala}`)
    const classic =
      gala === Promotion.CLASSIC ||
      gala === Promotion.CLASSIC_II ||
      gala === Promotion.CLASSIC_III
    if (classic && season)
      throw new Error("Classic pools do not support seasonal filters")
    if (classic) return !!item.promotions[gala!]
    const hasPromotion = gala !== undefined && gala !== Promotion.PREMIUM
    if (hasPromotion && season)
      return item.seasons[season] && !!item.promotions[gala!]
    if (hasPromotion) return !!item.promotions[gala!]
    if (season) return item.seasons[season]
    return item.promotions.premium
  }

  // Single fetching methods
  public fetchItem(rarity: Rarity, gala?: Promotion, season?: Season) {
    const set = [
      ...this._characterWeapons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season),
      ),
      ...this._nonCharacterWeapons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season),
      ),
      ...this._summons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season),
      ),
    ]

    const rand = Math.floor(Math.random() * set.length)
    return set[rand]
  }

  public fetchWeapon(
    rarity: Rarity,
    exclusions: DrawableItem[],
    season?: Season,
    gala?: Promotion,
  ) {
    const list = this.characterWeapons(rarity, gala, season).filter(
      (item: DrawableItem) =>
        !exclusions.some(
          (excluded) =>
            excluded.type === item.type && excluded.item_id === item.item_id,
        ),
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }

  public fetchSummon(
    rarity: Rarity,
    exclusions: DrawableItem[],
    season?: Season,
    gala?: Promotion,
  ) {
    const list = this.summons(rarity, gala, season).filter(
      (item: DrawableItem) =>
        !exclusions.some(
          (excluded) =>
            excluded.type === item.type && excluded.item_id === item.item_id,
        ),
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }

  public fetchLimited(gala: Promotion, exclusions: DrawableItem[]) {
    const list = this.limitedWeapons(gala).filter(
      (item: DrawableItem) =>
        !exclusions.some(
          (excluded) =>
            excluded.type === item.type && excluded.item_id === item.item_id,
        ),
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }
}

export interface CatalogueSnapshot { readonly id: string; readonly loadedAt: string; readonly items: readonly DrawableItem[] }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
export const catalogueCache = new Cache()
export default Cache
