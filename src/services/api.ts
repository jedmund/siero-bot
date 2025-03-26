import DrawableItem from "../interfaces/DrawableItem"
import { DrawableItemType, Rarity, Element } from "../utils/enums"
import { ItemRateMap } from "../utils/types"
import { Client } from "./connection"

class Api {
  // Methods: Fetching methods

  public static async fetchItemInfoFromID(id: string) {
    const item: any = await Client.selectFrom("gacha")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .leftJoin("characters", "characters.granblue_id", "weapons.recruits")
      .leftJoin("summons", "summons.id", "gacha.drawable_id")
      .select([
        "gacha.id",
        "gacha.drawable_type",
        "weapons.id as weapon_id",
        "weapons.name_en as weapon_name_en",
        "weapons.name_jp as weapon_name_jp",
        "weapons.granblue_id as weapon_granblue_id",
        "characters.id as character_id",
        "characters.name_en as character_name_en",
        "characters.name_jp as character_name_jp",
        "characters.granblue_id as character_granblue_id",
        "summons.id as summon_id",
        "summons.name_en as summon_name_en",
        "summons.name_jp as summon_name_jp",
        "summons.granblue_id as summon_granblue_id",
        "gacha.premium",
        "gacha.classic",
        "gacha.flash",
        "gacha.legend",
        "gacha.valentines",
        "gacha.summer",
        "gacha.halloween",
        "gacha.holiday",
      ])
      .where(({ or, cmpr }) =>
        or([
          cmpr("characters.granblue_id", "=", id),
          cmpr("summons.granblue_id", "=", id),
          cmpr("weapons.granblue_id", "=", id),
        ])
      )
      .executeTakeFirst()

    return this.transformItem(item)
  }

  public static async findItem(name: string) {
    const results = await Client.selectFrom("gacha")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .leftJoin("characters", "characters.granblue_id", "weapons.recruits")
      .leftJoin("summons", "summons.id", "gacha.drawable_id")
      .select([
        "gacha.id",
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
      .where(({ or, cmpr }) =>
        or([
          cmpr("characters.name_en", "ilike", `%${name}%`),
          cmpr("characters.name_jp", "ilike", `%${name}%`),
          cmpr("summons.name_en", "ilike", `%${name}%`),
          cmpr("summons.name_jp", "ilike", `%${name}%`),
          cmpr("weapons.name_en", "ilike", `%${name}%`),
          cmpr("weapons.name_jp", "ilike", `%${name}%`),
        ])
      )
      .execute()

    return results.map((result: RawResult) => this.transformItem(result))
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

  public static async fetchRateups(userId: string) {
    const results = await Client.selectFrom("gacha_rateups")
      .leftJoin("gacha", "gacha.id", "gacha_rateups.gacha_id")
      .leftJoin("weapons", "weapons.id", "gacha.drawable_id")
      .leftJoin("characters", "characters.granblue_id", "weapons.recruits")
      .leftJoin("summons", "summons.id", "gacha.drawable_id")
      .select([
        "gacha.id",
        "gacha.drawable_id",
        "gacha.drawable_type",
        "gacha_rateups.rate",
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
      .where("user_id", "=", userId)
      .execute()

    return results.map((result: any) => {
      return {
        item: this.transformItem(result),
        rate: parseFloat(result.rate),
      }
    })
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
    if (crystals) payload.crystals = crystals
    if (tickets) payload.tickets = tickets
    if (ten_tickets) payload.ten_tickets = ten_tickets

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

  private static transformItem(item: RawResult) {
    let nameObject: { en: string; jp: string }
    let itemId: string
    let granblueId: string
    let type: DrawableItemType
    let rarity: Rarity
    let element: Element

    if (item.drawable_type === "Summon") {
      itemId = item.summon_id || ""
      nameObject = {
        en: item.summon_name_en || "",
        jp: item.summon_name_jp || "",
      }
      granblueId = item.summon_granblue_id || ""
      type = DrawableItemType.SUMMON
      rarity = item.summon_rarity || 3
      element = item.summon_element || 0
    } else {
      itemId = item.weapon_id || ""
      nameObject = {
        en: item.weapon_name_en || "",
        jp: item.weapon_name_jp || "",
      }
      granblueId = item.weapon_granblue_id || ""
      type = DrawableItemType.WEAPON
      rarity = item.weapon_rarity || 3
      element = item.weapon_element || 0
    }

    const transformed: DrawableItem = {
      id: item.id || "",
      item_id: itemId,
      name: nameObject,
      granblue_id: granblueId,
      type: type,
      rarity: rarity,
      element: element,
      promotions: {
        premium: item.premium || false,
        classic: item.classic || false,
        flash: item.flash || false,
        legend: item.legend || false,
      },
      seasons: {
        valentines: item.valentines || false,
        summer: item.summer || false,
        halloween: item.halloween || false,
        holiday: item.holiday || false,
      },
    }

    if (
      type === DrawableItemType.WEAPON &&
      item.character_name_en !== null &&
      item.character_name_jp !== null &&
      item.character_id !== null &&
      item.character_granblue_id !== null
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
