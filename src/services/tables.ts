import type { Generated } from "kysely"

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
  gacha_id: string
  user_id: string
  rate: number
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
  recruits: Generated<string>
  rarity: number
  element: number
}

export interface SummonTable {
  id: Generated<string>
  granblue_id: string
  name_en: string
  name_jp: string
  rarity: number
  element: number
}

export interface SparkTable {
  [key: string]: any
  id: Generated<string>
  user_id: string
  guild_ids: string[]
  crystals: number
  tickets: number
  ten_tickets: number
  target_id: Generated<string>
  target_type: string
  updated_at: Date
}
