import assert from "node:assert/strict"
import test from "node:test"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { DrawableItemType, Element, Rarity } from "../src/utils/enums.js"
import { RenderingUtils } from "../src/utils/rendering.js"

void test("featured summaries distinguish new-only typed identities and disclose inferred odds", () => {
  const weapon: DrawableItem = {
    id: "",
    item_id: "shared-uuid",
    granblue_id: "1040221700",
    type: DrawableItemType.WEAPON,
    rarity: Rarity.SSR,
    element: Element.NULL,
    name: { en: "Silver Vine", jp: "" },
    promotions: { premium: true, classic: false, flash: false, legend: false },
    seasons: {
      summer: false,
      holiday: false,
      halloween: false,
      valentines: false,
    },
  }
  const summon = { ...weapon, type: DrawableItemType.SUMMON }
  const other = { ...weapon, item_id: "other-uuid" }
  const result = {
    count: { R: 0, SR: 0, SSR: 4 },
    items: [weapon, { ...weapon }, summon, other],
  }
  const rateups = [{ item: weapon, rate: 0.3 }]
  assert.match(
    RenderingUtils.renderSummary(result, rateups),
    /Rate-up Items: 2/,
  )
  assert.equal(
    RenderingUtils.renderSpark(result, rateups).toJSON().footer?.text,
    RenderingUtils.simulationNotice,
  )
})
