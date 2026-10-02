import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { parseOptions, simulate } from "../src/scripts/simulate.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { DrawableItemType, Element, Rarity } from "../src/utils/enums.js"

const items: DrawableItem[] = [Rarity.R, Rarity.SR, Rarity.SSR].flatMap(
  (rarity) =>
    (["characterWeapon", "weapon", "summon"] as const).map(
      (category, index) => ({
        id: `${rarity}-${index}`,
        item_id: `${rarity}-${index}`,
        granblue_id: `${rarity}${index}`,
        drawableId: `${rarity}-${index}`,
        drawableType: category === "summon" ? "Summon" : "Weapon",
        type:
          category === "summon"
            ? DrawableItemType.SUMMON
            : DrawableItemType.WEAPON,
        drawCategory: category,
        name: { en: `${rarity}-${category}`, jp: "" },
        rarity,
        element: Element.FIRE,
        promotions: {
          premium: true,
          classic: false,
          classic_ii: false,
          classic_iii: false,
          legend: false,
          flash: false,
        },
        seasons: {
          valentines: false,
          summer: false,
          halloween: false,
          holiday: false,
        },
      }),
    ),
)

await test("CLI validates draw counts, modes and percentages before opening the database", () => {
  for (const count of ["0", "-1", "1.5", "10oops", "1000010", "11"]) {
    assert.throws(() => parseOptions(["--draws", count]))
  }
  assert.equal(parseOptions(["--singles", "--draws", "11"]).draws, 11)
  assert.throws(() => parseOptions(["--mode", "unknown"]))
  assert.throws(() => parseOptions(["--rateup", "30=0.3junk"]))
  assert.throws(
    () => simulate(items, parseOptions(["--rateup", "30=4"])),
    /SSR budget/,
  )
  assert.throws(
    () => simulate(items, parseOptions(["--rateup", "999=0.3"])),
    /matched 0/,
  )
})

await test("CLI seeds survive catalogue ordering and ten-draw runs retain guaranteed slots", () => {
  const options = parseOptions([
    "--draws",
    "300",
    "--seed",
    "regression",
    "--rateup",
    "Weapon:30=0",
  ])
  const result = simulate(items, options)
  assert.deepEqual(result, simulate([...items].reverse(), options))
  assert.equal(result.guaranteedSlots, 30)
  assert.ok(result.totals.SR + result.totals.SSR >= 30)
  assert.equal(
    result.items.reduce((sum, item) => sum + item.count, 0),
    300,
  )
  assert.ok(!result.items.some((item) => item.gameId === "30"))
  const singles = simulate(
    items,
    parseOptions(["--singles", "--seed", "regression"]),
  )
  assert.equal(singles.guaranteedSlots, 0)
  assert.notDeepEqual(result.totals, singles.totals)
})

await test("CLI help works without database or Discord configuration", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/scripts/simulate.ts", "--help"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://invalid.invalid/missing",
        DISCORD_TOKEN: "",
      },
    },
  )
  assert.match(output, /Usage: pnpm simulate/)
  assert.match(output, /read-only/)
})
