import DrawableItem from "../interfaces/DrawableItem"

export type CategoryMap = { [key: string]: Category }
export type ItemMap = { [key: number]: DrawableItem[] }
export type RateMap = {
  identifier: string
  rate: number
}[]
export type ItemRateMap = {
  item: DrawableItem
  rate: number
}[]
export type RarityRateMap = {
  [key: string]: number
}
