import { loadCatalogue } from "./catalogue.js"
import { SparkService } from "./sparks.js"
import DrawableItem from "../interfaces/DrawableItem.js"
import type { Spark } from "../interfaces/Spark.js"
import { ItemRateMap } from "../utils/types.js"
import { Client } from "./connection.js"

export class CatalogueValidationError extends Error {}

class Api {
  // Methods: Fetching methods

  public static async fetchItemInfoFromReference(reference: string): Promise<DrawableItem | null> {
    return (await loadCatalogue(Client)).find(item => `${item.drawableType}:${item.item_id}` === reference) ?? null
  }

  public static async fetchItemInfoFromID(
    id: string,
  ): Promise<DrawableItem | null> {
    const matches = (await loadCatalogue(Client)).filter(item => item.granblue_id === id || item.recruits?.granblue_id === id)
    if (matches.length > 1) throw new Error(`Ambiguous Granblue ID ${id}; choose a catalogue item explicitly`)
    return matches[0] ?? null
  }

  public static async findItem(name: string, limit = 10, offset = 0): Promise<DrawableItem[]> {
    const search = name.toLocaleLowerCase()
    return (await loadCatalogue(Client)).filter(item => [item.name.en, item.name.jp, item.recruits?.name.en, item.recruits?.name.jp].some(value => value?.toLocaleLowerCase().includes(search))).sort((a, b) => `${a.type}:${a.item_id}`.localeCompare(`${b.type}:${b.item_id}`)).slice(offset, offset + limit)
  }

  // Methods: Rateup methods

  public static validateRateups(rateups: ItemRateMap) {
    if (rateups.some(({ item }) => !item.legacyGachaId)) throw new CatalogueValidationError("This catalogue item requires the drawable rate-up identity migration before rates can be saved")
    if (rateups.some(({ item }) => ![...Object.values(item.promotions), ...Object.values(item.seasons)].some(Boolean))) throw new CatalogueValidationError("This catalogue item is unavailable in supported draw pools")
  }

  public static async addRateups(user_id: string, rateups: ItemRateMap) {
    this.validateRateups(rateups)
    return await Client.insertInto("gacha_rateups")
      .values(
        rateups.map((rateup) => {
          return {
            gacha_id: rateup.item.legacyGachaId!,
            user_id: user_id,
            rate: rateup.rate,
          }
        }),
      )
      .execute()
  }

  public static async fetchRateups(userId: string): Promise<ItemRateMap> {
    try {
      const results = await Client.selectFrom("gacha_rateups")
        .innerJoin("gacha", "gacha.id", "gacha_rateups.gacha_id")
        .select(["gacha.drawable_id", "gacha.drawable_type", "gacha_rateups.rate"])
        .where("gacha_rateups.user_id", "=", userId)
        .execute()

      const catalogue = await loadCatalogue(Client)
      return results.flatMap(result => {
        const item = catalogue.find(value => value.drawableType === result.drawable_type && value.item_id === result.drawable_id)
        return item ? [{ item, rate: Number(result.rate) }] : []
      })
    } catch (error) {
      console.error(`Error fetching rateups for user ${userId}:`, error)
      return []
    }
  }

  public static async copyRateups(
    sourceUserId: string,
    destinationUserId: string,
  ) {
    const rateups = await this.fetchRateups(sourceUserId)
    this.validateRateups(rateups)
    await this.removeRateups(destinationUserId)
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
          crystals: response.crystals ?? 0,
          tickets: response.tickets ?? 0,
          ten_tickets: response.ten_tickets ?? 0,
        },
      }

      return dict
    } else return response
  }

  public static async updateSpark({
    userId,
    guildIds = [],
    ...currencies
  }: {
    userId: string
    guildIds?: string[]
    crystals?: number
    tickets?: number
    ten_tickets?: number
  }) {
    return (
      await new SparkService(Client).mutate(
        userId,
        "update",
        currencies,
        guildIds,
      )
    ).current
  }

  public static async resetSpark(userId: string) {
    return new SparkService(Client).mutate(userId, "reset")
  }

}

export default Api
