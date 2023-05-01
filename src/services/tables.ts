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
  recruits_id: Generated<string>
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
  user_id: Generated<string>
  crystals: number
  tickets: number
  ten_tickets: number
  target_id: Generated<string>
  target_memo: string
  last_updated: Date
}
