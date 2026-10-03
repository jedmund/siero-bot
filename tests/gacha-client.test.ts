import assert from "node:assert/strict"
import test from "node:test"
import Gacha from "../src/services/gacha.js"
import { GachaClient, GachaApiError } from "../src/services/gachaClient.js"
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

await test("connection failures become actionable gacha errors without exposing connection details", async () => {
  const cause = new TypeError("fetch failed: private connection details")
  const client = new GachaClient("http://localhost:3000/api/v1", async () => {
    throw cause
  })
  await assert.rejects(
    client.run("until", { mode: "premium", target: "Weapon:uuid" }),
    (error: unknown) => {
      assert.ok(error instanceof GachaApiError)
      assert.match(error.message, /Cannot reach the gacha service/)
      assert.match(error.message, /HENSEI_API_URL/)
      assert.doesNotMatch(error.message, /private connection/)
      assert.equal(error.cause, cause)
      return true
    },
  )
})

await test("non-JSON gateway responses become actionable gacha errors", async () => {
  const client = new GachaClient(
    "http://test",
    async () => new Response("<html>Bad Gateway</html>", { status: 502 }),
  )
  await assert.rejects(
    client.run("until", { mode: "premium" }),
    (error: unknown) => {
      assert.ok(error instanceof GachaApiError)
      assert.match(error.message, /invalid response \(HTTP 502\)/)
      return true
    },
  )
})

await test("API validation and retry guidance survive error handling", async () => {
  const client = new GachaClient("http://test", async () =>
    Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "12" } },
    ),
  )
  await assert.rejects(
    client.run("until", { mode: "premium" }),
    /Too many requests \(retry after 12 seconds\)/,
  )
})
