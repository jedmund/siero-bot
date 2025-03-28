import { DrawableItemType, Rarity } from "../utils/enums"

export default interface DrawableItem {
  id: string
  item_id: string
  granblue_id: string
  type: DrawableItemType
  name: {
    en: string
    jp: string
  }
  recruits?: Character
  rarity: Rarity
  element: Element
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
