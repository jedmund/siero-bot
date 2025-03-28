interface GachaItemRecord {
  id: string | null
  item_id: string | null
  character_id?: string | null
  premium: boolean
  classic: boolean
  flash: boolean
  legend: boolean
  valentines: boolean
  summer: boolean
  halloween: boolean
  holiday: boolean
  granblue_id: string | null
  character_granblue_id?: string | null
  name_en: string | null
  name_jp: string | null
  element: number | null
  character_name_en?: string | null
  character_name_jp?: string | null
  character_element?: number | null
  recruits?: string | null
  rarity: number | null
}
