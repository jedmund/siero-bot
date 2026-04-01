import DrawableItem from "./DrawableItem.js"
import type { RarityCount } from "./RarityCount.js"

export interface GachaResult {
  count: RarityCount
  items: DrawableItem[]
}
