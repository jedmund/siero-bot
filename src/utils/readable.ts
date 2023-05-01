import { DrawableItemType, Element, Rarity } from "./enums"

export function readableElement(element: Element) {
  switch (element) {
    case Element.NULL:
      return "Null"
    case Element.WIND:
      return "Wind"
    case Element.FIRE:
      return "Fire"
    case Element.WATER:
      return "Water"
    case Element.EARTH:
      return "Earth"
    case Element.DARK:
      return "Dark"
    case Element.LIGHT:
      return "Light"
  }
}

export function readableRarity(rarity: Rarity) {
  switch (rarity) {
    case Rarity.R:
      return "R"
    case Rarity.SR:
      return "SR"
    case Rarity.SSR:
      return "SSR"
  }
}

export function readableType(type: DrawableItemType) {
  switch (type) {
    case DrawableItemType.WEAPON:
      return "Weapon"
    case DrawableItemType.SUMMON:
      return "Summon"
  }
}
