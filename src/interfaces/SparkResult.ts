import DrawableItem from "./DrawableItem.js"
import type { RarityCount } from "./RarityCount.js"

export default interface SparkResult {
  count: RarityCount
  items: DrawableItem[]
}
