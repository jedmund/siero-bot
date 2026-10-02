import { DrawableItemType, Element, Rarity } from "../utils/enums.js"
import type { Character } from "./Character.js"

export default interface DrawableItem {
  legacyGachaId?: string
  drawableId?: string
  drawableType?: "Weapon" | "Summon"
  promotionIds?: number[]
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
    classic_ii?: boolean
    classic_iii?: boolean
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
