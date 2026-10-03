import { sql, type Kysely, type Transaction } from "kysely"
import type { Database } from "./connection.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import { loadCatalogue } from "./catalogue.js"
import type { ItemRateMap } from "../utils/types.js"
import { validateRateups } from "./simulation.js"

export class RateupStore {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly readCatalogue?: () => Promise<readonly DrawableItem[]>,
  ) {}

  async read(
    userId: string,
    db: Kysely<Database> | Transaction<Database> = this.db,
  ): Promise<ItemRateMap> {
    const rows = await db
      .selectFrom("gacha_rateups")
      .select(["drawable_type as type", "drawable_id as itemId", "rate"])
      .where("user_id", "=", userId)
      .execute()
    if (!rows.length) return []
    // Transactions deliberately read their own catalogue to validate mutations
    // against current database state, even when normal reads use the cache.
    const items = db === this.db && this.readCatalogue
      ? await this.readCatalogue()
      : await loadCatalogue(db)
    return rows.map((row) => {
      if (!row.type || !row.itemId)
        throw new Error("Rate-up has no typed item reference")
      const item = items.find(
        (item) =>
          item.drawableType === row.type && item.item_id === row.itemId,
      )
      if (!item)
        throw new Error("Rate-up references an unavailable catalogue item")
      const rate = Number(row.rate)
      if (!Number.isFinite(rate))
        throw new Error("Invalid stored rate-up percentage")
      return { item, rate }
    })
  }

  private async lock(db: Transaction<Database>, userId: string) {
    await sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`.execute(
      db,
    )
  }

  private async write(
    db: Transaction<Database>,
    userId: string,
    rates: ItemRateMap,
  ) {
    const items = await loadCatalogue(db)
    const validated = validateRateups(items, rates)
    await db.deleteFrom("gacha_rateups").where("user_id", "=", userId).execute()
    if (validated.length)
      await db
        .insertInto("gacha_rateups")
        .values(
          validated.map(({ item, rate }) => ({
            user_id: userId,
            rate,
            drawable_type: item.drawableType!,
            drawable_id: item.item_id,
          })),
        )
        .execute()
  }

  async replace(userId: string, rates: ItemRateMap) {
    return this.db.transaction().execute(async (db) => {
      await this.lock(db, userId)
      await this.write(db, userId, rates)
    })
  }

  async reset(userId: string) {
    return this.replace(userId, [])
  }

  async copy(source: string, destination: string) {
    return this.db.transaction().execute(async (db) => {
      // Stable lock ordering avoids reciprocal-copy deadlocks, including empty users.
      for (const userId of [...new Set([source, destination])].sort())
        await this.lock(db, userId)
      const rates = await this.read(source, db)
      if (source !== destination) await this.write(db, destination, rates)
      return rates
    })
  }
}
