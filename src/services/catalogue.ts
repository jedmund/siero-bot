import type { Kysely } from "kysely"
import type { Database } from "./connection.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import { DrawableItemType, Element, Rarity } from "../utils/enums.js"

export const promotionIds = {
  premium: 1,
  classic: 2,
  classic_ii: 3,
  flash: 4,
  legend: 5,
  classic_iii: 12,
} as const

// Recruitment is display metadata. Ambiguous matches are omitted and reported;
// they never multiply drawable rows or choose an arbitrary character.
export async function loadCatalogue(
  db: Kysely<Database>,
): Promise<DrawableItem[]> {
  const [weapons, summons, characters, legacy] = await Promise.all([
    db
      .selectFrom("weapons")
      .select([
        "id",
        "granblue_id",
        "name_en",
        "name_jp",
        "element",
        "rarity",
        "recruits",
        "promotions",
      ])
      .execute(),
    db
      .selectFrom("summons")
      .select([
        "id",
        "granblue_id",
        "name_en",
        "name_jp",
        "element",
        "rarity",
        "promotions",
      ])
      .execute(),
    db
      .selectFrom("characters")
      .select(["id", "granblue_id", "name_en", "name_jp", "element"])
      .execute(),
    db
      .selectFrom("gacha")
      .select(["id", "drawable_id", "drawable_type"])
      .execute(),
  ])
  const characterMap = new Map<string, typeof characters>()
  for (const character of characters)
    characterMap.set(character.granblue_id, [
      ...(characterMap.get(character.granblue_id) ?? []),
      character,
    ])
  const legacyMap = new Map<string, typeof legacy>()
  for (const mapping of legacy) {
    const key = `${mapping.drawable_type}:${mapping.drawable_id}`
    legacyMap.set(key, [...(legacyMap.get(key) ?? []), mapping])
  }
  const result: DrawableItem[] = []
  for (const [type, rows] of [
    [DrawableItemType.WEAPON, weapons],
    [DrawableItemType.SUMMON, summons],
  ] as const) {
    for (const row of rows) {
      const ids = row.promotions ?? []
      if (![Rarity.R, Rarity.SR, Rarity.SSR].includes(row.rarity)) continue
      const mappings =
        legacyMap.get(
          `${type === DrawableItemType.WEAPON ? "Weapon" : "Summon"}:${row.id}`,
        ) ?? []
      const item: DrawableItem = {
        id: mappings.length === 1 ? mappings[0].id : "",
        legacyGachaId: mappings.length === 1 ? mappings[0].id : undefined,
        item_id: row.id,
        drawableId: row.id,
        drawableType: type === DrawableItemType.WEAPON ? "Weapon" : "Summon",
        granblue_id: row.granblue_id ?? "",
        type,
        name: { en: row.name_en ?? "", jp: row.name_jp ?? "" },
        rarity: row.rarity,
        element: row.element ?? Element.NULL,
        promotionIds: [...ids],
        promotions: {
          premium: ids.includes(1),
          classic: ids.includes(2),
          classic_ii: ids.includes(3),
          classic_iii: ids.includes(12),
          flash: ids.includes(4),
          legend: ids.includes(5),
        },
        seasons: {
          valentines: ids.includes(6),
          summer: ids.includes(7),
          halloween: ids.includes(8),
          holiday: ids.includes(9),
        },
      }
      if (
        type === DrawableItemType.WEAPON &&
        "recruits" in row &&
        row.recruits
      ) {
        const matches = characterMap.get(row.recruits) ?? []
        if (matches.length === 1) {
          const character = matches[0]
          item.recruits = {
            id: character.id,
            granblue_id: character.granblue_id,
            name: { en: character.name_en ?? "", jp: character.name_jp ?? "" },
          }
          item.element = character.element ?? item.element
        } else if (matches.length > 1)
          console.warn(
            `Ambiguous recruitment metadata for weapon ${row.id}: ${matches.length} characters`,
          )
      }
      result.push(item)
    }
  }
  return result
}
