import { Client } from "./connection.js"

import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums"
import type DrawableItem from "../interfaces/DrawableItem"
import type { ItemMap } from "../utils/types.js"
import { sql } from "kysely"

interface GachaResult {
  id: string | null
  character_id?: string | null
  premium: boolean
  classic: boolean
  flash: boolean
  legend: boolean
  valentines: boolean
  summer: boolean
  halloween: boolean
  holiday: boolean
  granblue_id: string | null
  character_granblue_id?: string | null
  name_en: string | null
  name_jp: string | null
  character_name_en?: string | null
  character_name_jp?: string | null
  recruits_id?: string | null
  rarity: number | null
}

class Cache {
  _characterWeapons: ItemMap = {}
  _nonCharacterWeapons: ItemMap = {}
  _summons: ItemMap = {}

  // isExpired = this.isExpired.bind(this)
  lastUpdated = new Date(0)
  ttl = 1000 * 60 * 24 * 4 // 4 days in milliseconds

  public constructor() {
    this.fetchAllCharacterWeapons()
    this.fetchAllNonCharacterWeapons()
    this.fetchAllSummons()
  }

  // Cache methods
  // @ts-ignore
  private isExpired() {
    return this.lastUpdated.getTime() + this.ttl < new Date().getTime()
  }

  // @ts-ignore
  private resetCache() {
    this.lastUpdated = new Date(0)
  }

  // Subset retrieval methods
  public characterWeapons(rarity: Rarity, gala?: Promotion, season?: Season) {
    return this._characterWeapons[rarity].filter((item: DrawableItem) =>
      this.filterItem(item, gala, season)
    )
  }

  public summons(rarity: Rarity, gala?: Promotion, season?: Season) {
    return this._summons[rarity].filter((item: DrawableItem) =>
      this.filterItem(item, gala, season)
    )
  }

  public limitedWeapons(gala: Promotion) {
    let limitedWeapons: DrawableItem[] = []

    if (gala === Promotion.FLASH) {
      limitedWeapons = this._characterWeapons[Rarity.SSR].filter(
        (item: DrawableItem) =>
          item.promotions.flash && !item.promotions.premium
      )
    } else if (gala === Promotion.LEGEND) {
      limitedWeapons = this._characterWeapons[Rarity.SSR].filter(
        (item: DrawableItem) =>
          item.promotions.legend && !item.promotions.premium
      )
    }

    return limitedWeapons
  }

  public filterItem(item: DrawableItem, gala?: Promotion, season?: Season) {
    const hasPromotion =
      gala !== undefined && gala !== Promotion.PREMIUM ? true : false
    const hasSeason = season !== undefined ? true : false

    if (hasPromotion && hasSeason && gala && season)
      return item.seasons[season] && item.promotions[gala]
    else if (hasPromotion && !hasSeason && gala) return item.promotions[gala]
    else if (!hasPromotion && hasSeason && season) return item.seasons[season]
    else return item.promotions.premium
  }

  // Batch fetching methods
  private async fetchAllCharacterWeapons() {
    await this.fetchCharacterWeapons(Rarity.R)
    await this.fetchCharacterWeapons(Rarity.SR)
    await this.fetchCharacterWeapons(Rarity.SSR)
  }

  private async fetchAllNonCharacterWeapons() {
    await this.fetchNonCharacterWeapons(Rarity.R)
    await this.fetchNonCharacterWeapons(Rarity.SR)
    await this.fetchNonCharacterWeapons(Rarity.SSR)
  }

  private async fetchAllSummons() {
    await this.fetchSummons(Rarity.R)
    await this.fetchSummons(Rarity.SR)
    await this.fetchSummons(Rarity.SSR)
  }

  // Single fetching methods
  public fetchItem(rarity: Rarity, gala?: Promotion, season?: Season) {
    const set = [
      ...this._characterWeapons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season)
      ),
      ...this._nonCharacterWeapons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season)
      ),
      ...this._summons[rarity].filter((item: DrawableItem) =>
        this.filterItem(item, gala, season)
      ),
    ]

    const rand = Math.floor(Math.random() * set.length)
    return set[rand]
  }

  public fetchWeapon(
    rarity: Rarity,
    exclusions: DrawableItem[],
    season?: Season
  ) {
    const list = this.characterWeapons(rarity, undefined, season).filter(
      (item: DrawableItem) => !exclusions.includes(item)
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }

  public fetchSummon(
    rarity: Rarity,
    exclusions: DrawableItem[],
    season?: Season
  ) {
    const list = this.summons(rarity, undefined, season).filter(
      (item: DrawableItem) => !exclusions.includes(item)
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }

  public fetchLimited(gala: Promotion, exclusions: DrawableItem[]) {
    const list = this.limitedWeapons(gala).filter(
      (item: DrawableItem) => !exclusions.includes(item)
    )
    const r = Math.floor(Math.random() * list.length)
    return list[r]
  }

  // Transformation methods
  private transformIntoDrawableItems(
    items: GachaResult[],
    type: DrawableItemType
  ) {
    return items.map((item: GachaResult) =>
      this.transformIntoDrawableItem(item, type)
    )
  }

  private transformIntoDrawableItem(item: GachaResult, type: DrawableItemType) {
    let drawableItem: DrawableItem = {
      id: item.id || "",
      granblue_id: item.granblue_id || "",
      name: {
        en: item.name_en || "",
        jp: item.name_jp || "",
      },
      type: type,
      rarity: item.rarity || 0,
      promotions: {
        premium: item.premium || false,
        classic: item.classic || false,
        flash: item.flash || false,
        legend: item.legend || false,
      },
      seasons: {
        halloween: item.halloween || false,
        holiday: item.holiday || false,
        summer: item.summer || false,
        valentines: item.valentines || false,
      },
    }

    if (item.character_id) {
      drawableItem.recruits = {
        id: item.character_id || "",
        granblue_id: item.character_granblue_id || "",
        name: {
          en: item.character_name_en || "",
          jp: item.character_name_jp || "",
        },
      }
    }

    return drawableItem
  }

  // Fetching methods
  private async fetchCharacterWeapons(rarity: Rarity) {
    const items = await Client.selectFrom("gacha")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .leftJoin("characters", "characters.id", "weapons.recruits_id")
      .select([
        "weapons.id",
        "weapons.granblue_id",
        "weapons.name_en",
        "weapons.name_jp",
        "weapons.rarity",
        "weapons.recruits_id",
        "characters.id as character_id",
        "characters.granblue_id as character_granblue_id",
        "characters.name_en as character_name_en",
        "characters.name_jp as character_name_jp",
        "gacha.premium",
        "gacha.classic",
        "gacha.flash",
        "gacha.legend",
        "gacha.valentines",
        "gacha.summer",
        "gacha.halloween",
        "gacha.holiday",
      ])
      .where(sql`recruits_id IS NOT NULL`)
      .where("weapons.rarity", "=", rarity)
      .execute()

    this._characterWeapons[rarity] = this.transformIntoDrawableItems(
      items,
      DrawableItemType.WEAPON
    )
  }

  private async fetchNonCharacterWeapons(rarity: Rarity) {
    const items = await Client.selectFrom("gacha")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .select([
        "weapons.id",
        "weapons.granblue_id",
        "weapons.name_en",
        "weapons.name_jp",
        "weapons.rarity",
        "weapons.recruits_id",
        "gacha.premium",
        "gacha.classic",
        "gacha.flash",
        "gacha.legend",
        "gacha.valentines",
        "gacha.summer",
        "gacha.halloween",
        "gacha.holiday",
      ])
      .where(sql`recruits_id IS NULL`)
      .where("rarity", "=", rarity)
      .execute()

    this._nonCharacterWeapons[rarity] = this.transformIntoDrawableItems(
      items,
      DrawableItemType.WEAPON
    )
  }

  private async fetchSummons(rarity: Rarity) {
    const items = await Client.selectFrom("gacha")
      .leftJoin("summons", "summons.id", "gacha.drawable_id")
      .select([
        "summons.id",
        "summons.granblue_id",
        "summons.name_en",
        "summons.name_jp",
        "summons.rarity",
        "gacha.premium",
        "gacha.classic",
        "gacha.flash",
        "gacha.legend",
        "gacha.valentines",
        "gacha.summer",
        "gacha.halloween",
        "gacha.holiday",
      ])
      .where("rarity", "=", rarity)
      .execute()

    this._summons[rarity] = this.transformIntoDrawableItems(
      items,
      DrawableItemType.SUMMON
    )
  }
}

export default Cache
