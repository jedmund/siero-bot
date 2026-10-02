import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { parseOptions, runSimulation } from "../src/scripts/simulate.js"
import {
  GachaClient,
  resolveTarget,
  type CatalogueItem,
} from "../src/services/gachaClient.js"

const item: CatalogueItem = {
  identity: "Weapon:00000000-0000-0000-0000-000000000001",
  drawable_type: "Weapon",
  drawable_id: "00000000-0000-0000-0000-000000000001",
  granblue_id: "123",
  name: { en: "Target", ja: "" },
  rarity: 3,
  element: 1,
  promotions: [1],
}
await test("CLI validates operations, copies, counts and percentages before networking", () => {
  for (const count of ["0", "-1", "1.5", "10oops", "1000010", "11"])
    assert.throws(() => parseOptions(["--draws", count]))
  assert.equal(parseOptions(["--singles", "--draws", "11"]).draws, 11)
  assert.throws(() => parseOptions(["--operation", "until"]))
  assert.throws(() => parseOptions(["--copies", "1001"]))
  assert.throws(() => parseOptions(["--mode", "unknown"]))
  assert.throws(() => parseOptions(["--rateup", "30=0.3junk"]))
  assert.equal(
    parseOptions([
      "--operation",
      "odds",
      "--target",
      "123",
      "--draws",
      "1000000000000",
    ]).draws,
    1e12,
  )
})
await test("CLI submits typed percentages and leaves fresh seeds to the API", async () => {
  let body: Record<string, unknown> = {}
  const client = new GachaClient("http://test/api/v1", async (url, init) => {
    if (String(url).includes("catalogue"))
      return Response.json({ items: [item] })
    body = JSON.parse(String(init?.body)) as Record<string, unknown>
    return Response.json({ draws: "9007199254741000" })
  })
  const result = await runSimulation(
    parseOptions([
      "--operation",
      "until",
      "--target",
      "Weapon:123",
      "--copies",
      "4",
      "--rateup",
      "123=0.3",
    ]),
    client,
  )
  assert.equal(result.draws, "9007199254741000")
  assert.equal(body.target, item.identity)
  assert.equal(body.seed, undefined)
  assert.deepEqual(body.rateups, [{ identity: item.identity, percent: 0.3 }])
  assert.throws(
    () => resolveTarget([item, { ...item, drawable_type: "Summon" }], "123"),
    /matched 2/,
  )
})
await test("API client polls jobs and exposes rate limit guidance", async () => {
  let calls = 0
  const client = new GachaClient("http://test", async () => {
    calls++
    return Response.json(
      calls === 1
        ? { token: "token", status: "queued" }
        : { status: "complete", result: { draws: "10010" } },
    )
  })
  assert.equal(
    (await client.run("draw", { mode: "premium", draws: "10010" })).draws,
    "10010",
  )
  const limited = new GachaClient("http://test", async () =>
    Response.json(
      { error: "Limited" },
      { status: 429, headers: { "Retry-After": "30" } },
    ),
  )
  await assert.rejects(
    limited.run("draw", { mode: "premium" }),
    /retry after 30/,
  )
})
await test("CLI help works without database or Discord configuration", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/scripts/simulate.ts", "--help"],
    { encoding: "utf8" },
  )
  assert.match(output, /Usage: pnpm simulate/)
  assert.match(output, /No simulation database connection/)
})
