import assert from "node:assert/strict"
import test from "node:test"
import Gacha from "../src/services/gacha.js"
import { GachaClient } from "../src/services/gachaClient.js"
import { Promotion, Season } from "../src/utils/enums.js"

await test("Discord gacha adapter delegates fixed draws and maps immutable API display data", async () => {
  const requests: Record<string, unknown>[] = []
  const client = new GachaClient("http://test", async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return Response.json({
      seed: "replay",
      draws: "300",
      totals: { R: "200", SR: "99", SSR: "1" },
      ordered: [
        {
          identity: "Weapon:uuid",
          drawable_type: "Weapon",
          drawable_id: "uuid",
          granblue_id: "123",
          name: { en: "Weapon", ja: "武器" },
          recruits: { en: "Europa", ja: "エウロペ" },
          rarity: 3,
          element: 3,
          promotions: [11],
        },
      ],
    })
  })
  const gacha = new Gacha([], Promotion.PREMIUM, Season.FORMAL, client)
  const result = await gacha.spark()
  assert.equal(result.count.SSR, 1)
  assert.equal(result.items[0].drawableId, "uuid")
  assert.equal(result.items[0].recruits?.name.en, "Europa")
  assert.equal(result.items[0].seasons.formal, true)
  assert.equal(result.seed, "replay")
  assert.deepEqual(requests[0], {
    mode: "premium",
    season: "formal",
    rateups: [],
    purchase: "ten",
    draws: "300",
  })
})
