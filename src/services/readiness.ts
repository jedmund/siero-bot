import type { Kysely } from "kysely"
import type { Database } from "./connection.js"

// LIMIT 0 checks column availability without reading settings or mutating data.
export async function checkRateupSchema(database: Kysely<Database>) {
  try {
    await database.selectFrom("gacha_rateups")
      .select(["drawable_type", "drawable_id"])
      .limit(0)
      .execute()
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined
    if (code === "42703" || code === "42P01") {
      throw new Error("Missing typed rate-up migration: gacha_rateups must provide drawable_type and drawable_id before starting the bot", { cause: error })
    }
    throw new Error("Could not verify the rate-up schema; check database connectivity before starting the bot", { cause: error })
  }
}
