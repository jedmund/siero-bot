import type DrawableItem from "../interfaces/DrawableItem.js"
import type { ItemRateMap } from "../utils/types.js"
import { DrawableItemType, Promotion, Season } from "../utils/enums.js"
import { drawableIdentity } from "./simulation.js"
import { GachaClient, type CatalogueItem } from "./gachaClient.js"
export { SimulationValidationError } from "./simulation.js"

export function drawable(item: CatalogueItem): DrawableItem {
  return {
    id: "",
    item_id: item.drawable_id,
    drawableId: item.drawable_id,
    drawableType: item.drawable_type,
    granblue_id: item.granblue_id,
    name: { en: item.name.en, jp: item.name.ja },
    type:
      item.drawable_type === "Weapon"
        ? DrawableItemType.WEAPON
        : DrawableItemType.SUMMON,
    rarity: item.rarity,
    element: item.element,
    promotions: {
      premium: item.promotions.includes(1),
      classic: item.promotions.includes(2),
      classic_ii: item.promotions.includes(3),
      classic_iii: item.promotions.includes(12),
      flash: item.promotions.includes(4),
      legend: item.promotions.includes(5),
    },
    seasons: {
      valentines: item.promotions.includes(6),
      summer: item.promotions.includes(7),
      halloween: item.promotions.includes(8),
      holiday: item.promotions.includes(9),
      formal: item.promotions.includes(11),
    },
    recruits: item.recruits
      ? {
          id: "",
          granblue_id: "",
          name: { en: item.recruits.en, jp: item.recruits.ja },
        }
      : undefined,
  }
}
export default class Gacha {
  constructor(
    readonly rateups: ItemRateMap,
    public gala: Promotion,
    public season?: Season,
    private client = new GachaClient(),
  ) {}
  static create(rateups: ItemRateMap, gala: Promotion, season?: Season) {
    return Promise.resolve(new Gacha(rateups, gala, season))
  }
  configuration() {
    return {
      mode: this.gala,
      season: this.season,
      rateups: this.rateups.map(({ item, rate }) => ({
        identity: drawableIdentity(item),
        percent: rate,
      })),
    }
  }
  async singleRoll() {
    const result = await this.client.run("draw", {
      ...this.configuration(),
      purchase: "singles",
      draws: "1",
    })
    return drawable(result.ordered![0])
  }
  async tenPartRoll(times = 1, fetchAllItems = true) {
    const result = await this.client.run("draw", {
      ...this.configuration(),
      purchase: "ten",
      draws: String(times * 10),
    })
    return {
      count: {
        R: Number(result.totals!.R),
        SR: Number(result.totals!.SR),
        SSR: Number(result.totals!.SSR),
      },
      items: (result.ordered ?? [])
        .filter((item) => fetchAllItems || item.rarity === 3)
        .map(drawable),
      seed: result.seed,
    }
  }
  spark() {
    return this.tenPartRoll(30, false)
  }
}
