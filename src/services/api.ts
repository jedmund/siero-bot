import DrawableItem from "../interfaces/DrawableItem"
import { DrawableItemType, Rarity, Element } from "../utils/enums"
import { ItemRateMap } from "../utils/types"
import { Client } from "./connection"

class Api {
  // Methods: Fetching methods

  private static baseGachaQuery() {
    return Client.selectFrom("gacha")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .leftJoin("characters", "characters.granblue_id", "weapons.recruits")
      .leftJoin("summons", "summons.id", "gacha.drawable_id")
      .select([
        "gacha.id",
        "gacha.drawable_id",
        "gacha.drawable_type",
        "weapons.id as weapon_id",
        "weapons.name_en as weapon_name_en",
        "weapons.name_jp as weapon_name_jp",
        "weapons.granblue_id as weapon_granblue_id",
        "weapons.rarity as weapon_rarity",
        "weapons.element as weapon_element",
        "characters.id as character_id",
        "characters.name_en as character_name_en",
        "characters.name_jp as character_name_jp",
        "characters.granblue_id as character_granblue_id",
        "characters.element as character_element",
        "characters.rarity as character_rarity",
        "summons.id as summon_id",
        "summons.name_en as summon_name_en",
        "summons.name_jp as summon_name_jp",
        "summons.granblue_id as summon_granblue_id",
        "summons.rarity as summon_rarity",
        "summons.element as summon_element",
        "gacha.premium",
        "gacha.classic",
        "gacha.flash",
        "gacha.legend",
        "gacha.valentines",
        "gacha.summer",
        "gacha.halloween",
        "gacha.holiday",
      ])
  }

  public static async fetchItemInfoFromID(
    id: string
  ): Promise<DrawableItem | null> {
    try {
      const query = this.baseGachaQuery()
        .where(({ or, eb }) =>
          or([
            eb("weapons.granblue_id", "=", id),
            eb("summons.granblue_id", "=", id),
            eb("characters.granblue_id", "=", id),
          ])
        )
        .limit(1)

      const item = await query.executeTakeFirst()

      return item ? this.transformItem(item) : null
    } catch (error) {
      console.error(`Error fetching item with ID ${id}:`, error)
      return null
    }
  }

  public static async findItem(
    name: string,
    limit = 10,
    offset = 0
  ): Promise<DrawableItem[]> {
    try {
      const results = await this.baseGachaQuery()
        .where(({ or, eb }) =>
          or([
            eb("weapons.name_en", "ilike", `%${name}%`),
            eb("weapons.name_jp", "ilike", `%${name}%`),
            eb("summons.name_en", "ilike", `%${name}%`),
            eb("summons.name_jp", "ilike", `%${name}%`),
            eb("characters.name_en", "ilike", `%${name}%`),
            eb("characters.name_jp", "ilike", `%${name}%`),
          ])
        )
        .limit(limit)
        .offset(offset)
        .execute()

      return results
        .map((result) => this.transformItem(result))
        .filter((item): item is DrawableItem => item !== null)
    } catch (error) {
      console.error(`Error finding items with name ${name}:`, error)
      return []
    }
  }

  // Methods: Rateup methods

  public static async addRateups(user_id: string, rateups: ItemRateMap) {
    return await Client.insertInto("gacha_rateups")
      .values(
        rateups.map((rateup) => {
          return {
            gacha_id: rateup.item.id,
            user_id: user_id,
            rate: rateup.rate,
          }
        })
      )
      .execute()
  }

  public static async fetchRateups(userId: string): Promise<ItemRateMap> {
    try {
      const results = await this.baseGachaQuery()
        .leftJoin("gacha_rateups", "gacha_rateups.gacha_id", "gacha.id")
        .select(["gacha_rateups.rate"])
        .where("gacha_rateups.user_id", "=", userId)
        .execute()

      return results
        .map((result: RawResult) => {
          const item = this.transformItem(result)
          if (!item) return null

          return {
            item, // now TypeScript knows item is not null
            rate: parseFloat(String(result.rate) || "0"),
          }
        })
        .filter(
          (entry): entry is { item: DrawableItem; rate: number } =>
            entry !== null
        )
    } catch (error) {
      console.error(`Error fetching rateups for user ${userId}:`, error)
      return []
    }
  }

  public static async copyRateups(
    sourceUserId: string,
    destinationUserId: string
  ) {
    await this.removeRateups(destinationUserId)
    const rateups = await this.fetchRateups(sourceUserId)
    if (rateups.length > 0) await this.addRateups(destinationUserId, rateups)

    return rateups
  }

  public static removeRateups(userId: string) {
    return Client.deleteFrom("gacha_rateups")
      .where("user_id", "=", userId)
      .execute()
  }

  // Methods: Spark methods
  public static async fetchSpark(userId: string) {
    const response = await Client.selectFrom("sparks")
      .select(["guild_ids", "crystals", "tickets", "ten_tickets"])
      .where("user_id", "=", userId)
      .limit(1)
      .executeTakeFirst()

    if (response) {
      const dict: {
        guildIds: string[]
        spark: Spark
      } = {
        guildIds: response.guild_ids,
        spark: {
          crystals: response.crystals,
          tickets: response.tickets,
          ten_tickets: response.ten_tickets,
        },
      }

      return dict
    } else return response
  }

  public static async updateSpark({
    userId,
    guildIds,
    crystals,
    tickets,
    ten_tickets,
  }: {
    userId: string
    guildIds?: string[]
    crystals?: number
    tickets?: number
    ten_tickets?: number
  }) {
    const payload: { [key: string]: string | string[] | number } = {
      user_id: userId,
      updated_at: new Date(Date.now())
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
    }
    if (guildIds) payload.guild_ids = guildIds
    if (crystals !== undefined) payload.crystals = crystals
    if (tickets !== undefined) payload.tickets = tickets
    if (ten_tickets !== undefined) payload.ten_tickets = ten_tickets

    return await Client.insertInto("sparks")
      .values(payload)
      .onConflict((oc) => oc.column("user_id").doUpdateSet(payload))
      .returning(["crystals", "tickets", "ten_tickets"])
      .executeTakeFirst()
  }

  public static async resetSpark(userId: string) {
    await Client.updateTable("sparks")
      .set({
        crystals: 0,
        tickets: 0,
        ten_tickets: 0,
      })
      .where("user_id", "=", userId)
      .returning(["crystals", "tickets", "ten_tickets"])
      .execute()
  }

  // Methods: Data transformation methods

  private static transformItem(item: RawResult): DrawableItem | null {
    if (!item) return null

    // determine type first
    const isWeapon = item.drawable_type === "Weapon"
    const isSummon = item.drawable_type === "Summon"

    if (!isWeapon && !isSummon) return null // invalid type

    const type = isWeapon ? DrawableItemType.WEAPON : DrawableItemType.SUMMON

    // get appropriate fields based on type
    const nameEn = isWeapon ? item.weapon_name_en : item.summon_name_en
    const nameJp = isWeapon ? item.weapon_name_jp : item.summon_name_jp
    const itemId = isWeapon ? item.weapon_id : item.summon_id
    const granblueId = isWeapon
      ? item.weapon_granblue_id
      : item.summon_granblue_id
    const rarity = isWeapon ? item.weapon_rarity : item.summon_rarity
    const element = isWeapon ? item.weapon_element : item.summon_element

    // validate required fields
    if (
      !nameEn ||
      !nameJp ||
      !itemId ||
      !granblueId ||
      !rarity ||
      element === undefined
    ) {
      console.error("Missing required fields for item:", item)
      return null
    }

    const transformed: DrawableItem = {
      id: item.id || "",
      item_id: itemId,
      name: { en: nameEn, jp: nameJp },
      granblue_id: granblueId,
      type,
      rarity: rarity as Rarity,
      element: element as Element,
      promotions: {
        premium: !!item.premium,
        classic: !!item.classic,
        flash: !!item.flash,
        legend: !!item.legend,
      },
      seasons: {
        valentines: !!item.valentines,
        summer: !!item.summer,
        halloween: !!item.halloween,
        holiday: !!item.holiday,
      },
    }

    // only add recruits for weapons with character data
    if (
      isWeapon &&
      item.character_id &&
      item.character_name_en &&
      item.character_name_jp &&
      item.character_granblue_id
    ) {
      transformed.recruits = {
        id: item.character_id,
        granblue_id: item.character_granblue_id,
        name: {
          en: item.character_name_en,
          jp: item.character_name_jp,
        },
      }
    }

    return transformed
  }
}

export default Api
