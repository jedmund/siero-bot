import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import type {
  GachaTable,
  GachaRateupTable,
  SparkTable,
  CharacterTable,
  SummonTable,
  WeaponTable,
} from "./tables"

export interface Database {
  sparks: SparkTable
  characters: CharacterTable
  summons: SummonTable
  weapons: WeaponTable
  gacha: GachaTable
  gacha_rateups: GachaRateupTable
}

const postgresConfig = {
  pool: new Pool({
    host: "localhost",
    user: "justin",
    database: "hensei_dev",
    // connectionString: "postgresql://justin@0.0.0.0/hensei_dev",
  }),
}

export const Client = new Kysely<Database>({
  dialect: new PostgresDialect(postgresConfig),
  log: ["query", "error"],
})
