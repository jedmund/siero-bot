import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import type {
  GachaRateupTable,
  SparkTable,
  CharacterTable,
  SummonTable,
  WeaponTable,
} from "./tables.js"

export interface Database {
  sparks: SparkTable
  characters: CharacterTable
  summons: SummonTable
  weapons: WeaponTable
  gacha_rateups: GachaRateupTable
}

const postgresConfig = {
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
  }),
}

export const Client = new Kysely<Database>({
  dialect: new PostgresDialect(postgresConfig),
  log: ["error"],
})
