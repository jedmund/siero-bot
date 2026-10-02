import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"
import type { Database } from "../services/connection.js"
import { loadCatalogue } from "../services/catalogue.js"
import {
  compileSimulation,
  drawableIdentity,
  drawDistribution,
} from "../services/simulation.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import { Promotion, Rarity, Season } from "../utils/enums.js"

const HELP = `Usage: pnpm simulate [options]

  --mode <mode>       premium (default), classic, classic_ii, classic_iii,
                      legend, flash
  --draws <number>    Individual draws, 10–1,000,000 (default: 300).
                      Multiples of 10; every tenth draw is SR-or-higher.
  --singles          All draws use ordinary odds; allows any positive count.
  --seed <text>      Reproducible random seed (default: 1).
  --season <season>  valentines, summer, halloween, holiday (not Classic).
  --rateup <id=pct>  Custom SSR percentage, e.g. 1040221700=0.3; repeatable.
                      Use Weapon:<game-id> or Summon:<game-id> if ambiguous.
  --json             Print full results as JSON.
  --help             Show this help without connecting to the database.

Reads DATABASE_URL, defaulting to postgres://localhost/hensei_dev.
The connection is read-only. No Discord login or saved-setting changes.
These are hypothetical catalogue simulations, not live banner odds.
`

export function parseOptions(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      mode: { type: "string", default: "premium" },
      draws: { type: "string", default: "300" },
      seed: { type: "string", default: "1" },
      season: { type: "string" },
      rateup: { type: "string", multiple: true, default: [] },
      singles: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })
  if (!Object.values(Promotion).includes(values.mode as Promotion))
    throw new Error("Invalid --mode; use --help for supported modes.")
  if (values.season && !Object.values(Season).includes(values.season as Season))
    throw new Error("Invalid --season; use --help for supported seasons.")
  const draws = Number(values.draws)
  if (
    !/^\d+$/.test(values.draws) ||
    !Number.isSafeInteger(draws) ||
    draws < 1 ||
    draws > 1_000_000
  )
    throw new Error("--draws must be an integer between 1 and 1000000.")
  if (!values.singles && draws % 10 !== 0)
    throw new Error(
      "Ten-draw simulations require a multiple of 10; use --singles otherwise.",
    )
  const rateups = values.rateup.map((input) => {
    const match = /^(?:(Weapon|Summon):)?(\d+)=(\d+(?:\.\d+)?)$/.exec(input)
    if (!match || !Number.isFinite(Number(match[3])))
      throw new Error("--rateup must be GAME_ID=PERCENT, e.g. 1040221700=0.3.")
    return { type: match[1], id: match[2], rate: Number(match[3]) }
  })
  return {
    ...values,
    mode: values.mode as Promotion,
    season: values.season as Season | undefined,
    draws,
    rateups,
  }
}

export function seededRandom(seed: string) {
  let state = 2166136261
  for (const character of seed)
    state = Math.imul(state ^ character.codePointAt(0)!, 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function simulate(
  items: DrawableItem[],
  options: ReturnType<typeof parseOptions>,
) {
  const sorted = [...items].sort((a, b) =>
    drawableIdentity(a).localeCompare(drawableIdentity(b)),
  )
  const rateups = options.rateups.map(({ type, id, rate }) => {
    const matches = sorted.filter(
      (item) =>
        item.granblue_id === id && (!type || item.drawableType === type),
    )
    if (matches.length !== 1)
      throw new Error(
        `Rate-up ${id} matched ${matches.length} items; supply a unique typed game ID.`,
      )
    return { item: matches[0], rate }
  })
  const compiled = compileSimulation(
    { id: "cli", loadedAt: new Date().toISOString(), items: sorted },
    {
      gala: options.mode,
      season: options.season,
      rateups,
    },
  )
  const random = seededRandom(options.seed)
  const counts = new Map<
    string,
    {
      identity: string
      gameId: string
      name: string
      rarity: string
      count: number
    }
  >()
  const totals = { R: 0, SR: 0, SSR: 0 }
  for (let i = 0; i < options.draws; i++) {
    const distribution =
      !options.singles && (i + 1) % 10 === 0
        ? compiled.guaranteed
        : compiled.ordinary
    const item = drawDistribution(distribution, random)
    const identity = drawableIdentity(item)
    const rarity = Rarity[item.rarity] as keyof typeof totals
    totals[rarity]++
    const entry = counts.get(identity) ?? {
      identity,
      gameId: item.granblue_id,
      name: item.name.en,
      rarity,
      count: 0,
    }
    entry.count++
    counts.set(identity, entry)
  }
  return {
    mode: options.mode,
    season: options.season ?? null,
    draws: options.draws,
    guaranteedSlots: options.singles ? 0 : options.draws / 10,
    seed: options.seed,
    poolSize: compiled.ordinary.length,
    rateups: rateups.map(({ item, rate }) => ({
      identity: drawableIdentity(item),
      name: item.name.en,
      percent: rate,
    })),
    assumptions: compiled.assumptions,
    totals,
    items: [...counts.values()].sort(
      (a, b) => b.count - a.count || a.identity.localeCompare(b.identity),
    ),
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString:
          process.env.DATABASE_URL ?? "postgres://localhost/hensei_dev",
        options: "-c default_transaction_read_only=on",
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 30_000,
      }),
    }),
  })
  let items: DrawableItem[]
  try {
    items = await loadCatalogue(db)
  } catch {
    throw new Error(
      "Could not read the catalogue. Check DATABASE_URL, PostgreSQL availability, and catalogue migrations.",
    )
  } finally {
    await db.destroy()
  }
  const result = simulate(items, options)
  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(
    `Hypothetical catalogue simulation — ${result.mode}${result.season ? ` / ${result.season}` : ""}`,
  )
  console.log(
    `${result.draws} draws; ${result.guaranteedSlots} SR-or-higher slots; seed ${result.seed}; pool ${result.poolSize}`,
  )
  console.table(
    Object.entries(result.totals).map(([rarity, count]) => ({
      rarity,
      count,
      percent: ((100 * count) / result.draws).toFixed(2),
    })),
  )
  if (result.rateups.length) console.table(result.rateups)
  console.log("SSR results:")
  console.table(result.items.filter((item) => item.rarity === "SSR"))
  console.log(
    "Inferred odds; catalogue membership is not a verified current banner. Use --json for all item counts and assumptions.",
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      `Simulation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
    process.exitCode = 1
  })
}
