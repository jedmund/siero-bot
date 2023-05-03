import { DrawableItemType, Rarity } from "../utils/enums"

export default interface DrawableItem {
  [index: string]: any | string | number | boolean | null
  id: string
  item_id: string
  granblue_id: string
  type: DrawableItemType
  name: {
    [index: string]: string
    en: string
    jp: string
  }
  recruits?: Character
  rarity: Rarity
  promotions: {
    premium: boolean
    classic: boolean
    flash: boolean
    legend: boolean
  }
  seasons: {
    halloween: boolean
    holiday: boolean
    summer: boolean
    valentines: boolean
  }
}
