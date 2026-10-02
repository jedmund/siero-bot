import { loadCatalogue } from "./catalogue.js"
import { Client } from "./connection.js"

import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import type { ItemMap } from "../utils/types.js"

class Cache {
  _characterWeapons: ItemMap = {}
  _nonCharacterWeapons: ItemMap = {}
  _summons: ItemMap = {}

  public ready?: Promise<void>
  public load() {
    return (this.ready ??= loadCatalogue(Client).then((items) => {
      for (const rarity of [Rarity.R, Rarity.SR, Rarity.SSR]) {
        this._characterWeapons[rarity] = items.filter(
          (item) =>
            item.rarity === rarity && item.type === DrawableItemType.WEAPON,
        )
        this._nonCharacterWeapons[rarity] = []
        this._summons[rarity] = items.filter(
          (item) =>
            item.rarity === rarity && item.type === DrawableItemType.SUMMON,
        )
      }
    }))
  }

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

export default Cache
