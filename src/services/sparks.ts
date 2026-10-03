import { sql, type Kysely } from "kysely"
import type { Database } from "./connection.js"
import type { Spark } from "../interfaces/Spark.js"

export type SparkCurrencies = Partial<Spark>
export type SparkOperation = "add" | "remove" | "update" | "reset"
export const MAX_SPARK_AMOUNT = 2147483647
export class SparkInputError extends Error {}
export class SparkOverflowError extends Error {}

export function normalizeSpark(
  row:
    | SparkCurrencies
    | {
        crystals: number | null
        tickets: number | null
        ten_tickets: number | null
      },
): Spark {
  return {
    crystals: row.crystals ?? 0,
    tickets: row.tickets ?? 0,
    ten_tickets: row.ten_tickets ?? 0,
  }
}

/** Null legacy balances mean zero. No bulk repair or schema change is performed. */
export class SparkService {
  constructor(private readonly db: Kysely<Database>) {}

  async mutate(
    userId: string,
    operation: SparkOperation,
    input: SparkCurrencies = {},
    guildIds: string[] = [],
  ) {
    const keys = ["crystals", "tickets", "ten_tickets"] as const
    if (
      operation !== "reset" &&
      !keys.some((key) => input[key] !== undefined)
    ) {
      throw new SparkInputError("Provide at least one currency amount.")
    }
    for (const key of keys) {
      const value = input[key]
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 0 || value > MAX_SPARK_AMOUNT)
      ) {
        throw new SparkInputError(
          "Currency amounts must be whole numbers between 0 and 2147483647.",
        )
      }
    }
    try {
      return await this.db.transaction().execute(async (trx) => {
        // The unique user_id conflict waits for first-use inserts. Every writer then
        // takes this same row lock, so replacement/reset and arithmetic serialize.
        await trx
          .insertInto("sparks")
          .values({
            user_id: userId,
            guild_ids: [],
            crystals: 0,
            tickets: 0,
            ten_tickets: 0,
          })
          .onConflict((conflict) => conflict.column("user_id").doNothing())
          .execute()
        const row = await trx
          .selectFrom("sparks")
          .selectAll()
          .where("user_id", "=", userId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const previous = normalizeSpark(row)
        const expression = (key: (typeof keys)[number]) => {
          const current = sql<number>`coalesce(${sql.ref(key)}, 0)`
          if (operation === "reset") return sql<number>`0`
          const amount = input[key]
          if (amount === undefined) return current
          if (operation === "update") return sql<number>`${amount}`
          if (operation === "add")
            return sql<number>`${current} + ${amount}::integer`
          return sql<number>`greatest(${current} - ${amount}::integer, 0)`
        }
        const updated = await trx
          .updateTable("sparks")
          .set({
            crystals: expression("crystals"),
            tickets: expression("tickets"),
            ten_tickets: expression("ten_tickets"),
            guild_ids: sql<
              string[]
            >`ARRAY(SELECT DISTINCT guild_id FROM unnest(guild_ids || ${guildIds}::varchar[]) AS guild_id ORDER BY guild_id)`,
            updated_at: sql<Date>`clock_timestamp() AT TIME ZONE 'UTC'`,
          })
          .where("user_id", "=", userId)
          .returningAll()
          .executeTakeFirstOrThrow()
        return {
          previous,
          current: normalizeSpark(updated),
          guildIds: updated.guild_ids,
          updatedAt: updated.updated_at,
        }
      })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "22003") {
        throw new SparkOverflowError(
          "The resulting balance exceeds the maximum supported amount. No changes were saved.",
        )
      }
      throw error
    }
  }
}
