import type { DrawableItemType, Element, Rarity } from "../utils/enums"

export default interface UntilResult {
  granblue_id: string
  name: {
    en: string
    jp: string
  }
  recruits?: {
    en: string
    jp: string
  }
  rarity: Rarity
  element: Element
  type: DrawableItemType
  promotion: {
    premium: boolean
    classic: boolean
    flash: boolean
    legend: boolean
  }
  season: {
    valentines: boolean
    summer: boolean
    halloween: boolean
    holiday: boolean
  }
}
