import type { ColumnType, Generated } from "kysely"

export interface GachaTable {
  id: Generated<string>
  drawable_id: string // Weapon | Summon
  drawable_type: "Weapon" | "Summon"
  premium: boolean
  classic: boolean
  flash: boolean
  legend: boolean
  valentines: boolean
  summer: boolean
  halloween: boolean
  holiday: boolean
}

export interface GachaRateupTable {
  id: Generated<string>
  gacha_id: string | null
  drawable_type: "Weapon" | "Summon" | null
  drawable_id: string | null
  user_id: string
  rate: ColumnType<number | string, number, number>
}

export interface CharacterTable {
  id: Generated<string>
  granblue_id: string
  name_en: string
  name_jp: string
  rarity: number
  element: number
}

export interface WeaponTable {
  id: Generated<string>
  granblue_id: string
  name_en: string
  name_jp: string
  promotions: number[]
  recruits: string | null
  rarity: number
  element: number
}

export interface SummonTable {
  promotions: number[]
  id: Generated<string>
  granblue_id: string
  name_en: string
  name_jp: string
  rarity: number
  element: number
}

export interface SparkTable {
  id: Generated<string>
  user_id: string
  guild_ids: string[]
  crystals: Generated<number | null>
  tickets: Generated<number | null>
  ten_tickets: Generated<number | null>
  target_id: ColumnType<
    string | null,
    string | bigint | null | undefined,
    string | bigint | null
  >
  target_type: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >
  target_memo: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >
  updated_at: Generated<Date>
}
