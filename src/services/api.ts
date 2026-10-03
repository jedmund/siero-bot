import { catalogueCache } from "./cache.js"
import { Promotion, Season } from "../utils/enums.js"
import { SparkService } from "./sparks.js"
import DrawableItem from "../interfaces/DrawableItem.js"
import type { Spark } from "../interfaces/Spark.js"
import { ItemRateMap } from "../utils/types.js"
import { Client } from "./connection.js"
import { RateupStore } from "./rateupStore.js"
import { drawableIdentity, isEligibleItem, validateRateups } from "./simulation.js"

export class CatalogueValidationError extends Error {}

export interface CatalogueScope { promotion: Promotion; season?: Season }

class Api {
  private static async items(scope?: CatalogueScope) {
    const items = await catalogueCache.read()
    return scope ? items.filter(item => isEligibleItem(item, scope.promotion, scope.season)) : items
  }
  // Methods: Fetching methods

  public static async fetchItemInfoFromReference(
    reference: string,
    scope?: CatalogueScope,
  ): Promise<DrawableItem | null> {
    return (
      (await this.items(scope)).find(
        (item) => drawableIdentity(item) === reference,
      ) ?? null
    )
  }

  public static async fetchItemInfoFromID(
    id: string,
    scope?: CatalogueScope,
  ): Promise<DrawableItem | null> {
    const matches = (await this.items(scope)).filter(
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
    scope?: CatalogueScope,
  ): Promise<DrawableItem[]> {
    const search = name.toLocaleLowerCase()
    return (await this.items(scope))
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
    validateRateups(await catalogueCache.read(), rateups)
  }

  public static async addRateups(userId: string, rateups: ItemRateMap) {
    return new RateupStore(Client).replace(userId, rateups)
  }

  public static async fetchRateups(userId: string): Promise<ItemRateMap> {
    return new RateupStore(Client, () => catalogueCache.read()).read(userId)
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
