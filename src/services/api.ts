import { loadCatalogue } from "./catalogue.js"
import { SparkService } from "./sparks.js"
import DrawableItem from "../interfaces/DrawableItem.js"
import type { Spark } from "../interfaces/Spark.js"
import { ItemRateMap } from "../utils/types.js"
import { Client } from "./connection.js"
import { RateupStore } from "./rateupStore.js"
import { validateRateups } from "./simulation.js"

export class CatalogueValidationError extends Error {}

class Api {
  // Methods: Fetching methods

  public static async fetchItemInfoFromReference(
    reference: string,
  ): Promise<DrawableItem | null> {
    return (
      (await loadCatalogue(Client)).find(
        (item) => `${item.drawableType}:${item.item_id}` === reference,
      ) ?? null
    )
  }

  public static async fetchItemInfoFromID(
    id: string,
  ): Promise<DrawableItem | null> {
    const matches = (await loadCatalogue(Client)).filter(
      (item) => item.granblue_id === id || item.recruits?.granblue_id === id,
    )
    if (matches.length > 1)
      throw new Error(
        `Ambiguous Granblue ID ${id}; choose a catalogue item explicitly`,
      )
    return matches[0] ?? null
  }

  public static async findItem(
    name: string,
    limit = 10,
    offset = 0,
  ): Promise<DrawableItem[]> {
    const search = name.toLocaleLowerCase()
    return (await loadCatalogue(Client))
      .filter((item) =>
        [
          item.name.en,
          item.name.jp,
          item.recruits?.name.en,
          item.recruits?.name.jp,
        ].some((value) => value?.toLocaleLowerCase().includes(search)),
      )
      .sort((a, b) =>
        `${a.type}:${a.item_id}`.localeCompare(`${b.type}:${b.item_id}`),
      )
      .slice(offset, offset + limit)
  }

  // Methods: Rateup methods

  public static async validateRateups(rateups: ItemRateMap) {
    validateRateups(await loadCatalogue(Client), rateups)
  }

  public static async addRateups(userId: string, rateups: ItemRateMap) {
    return new RateupStore(Client).replace(userId, rateups)
  }

  public static async fetchRateups(userId: string): Promise<ItemRateMap> {
    return new RateupStore(Client).read(userId)
  }

  public static async copyRateups(
    sourceUserId: string,
    destinationUserId: string,
  ) {
    return new RateupStore(Client).copy(sourceUserId, destinationUserId)
  }

  public static removeRateups(userId: string) {
    return new RateupStore(Client).reset(userId)
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
