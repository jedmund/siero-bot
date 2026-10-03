import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { Promotion, Season } from "../utils/enums.js"
import { GachaClient, resolveTarget } from "../services/gachaClient.js"

const HELP = `Usage: pnpm simulate [options]
  --operation draw|until|odds  (default: draw)
  --mode premium|legend|flash|classic|classic_ii|classic_iii
  --season valentines|summer|halloween|holiday|formal
  --draws <count>     Default 300; fixed draws up to 1,000,000, odds up to 1 trillion
  --singles           Ordinary slots; otherwise complete ten-draw purchases
  --target <id>       Typed UUID or game ID (Until/Odds)
  --copies <count>    1–1000 (default 1)
  --comparison exactly|at_least  (default at_least)
  --rateup <id=pct>   Repeatable custom SSR percentage; 0.3 means 0.3%
  --seed <text>       Replay seed; omitted means fresh randomness
  --json             Full JSON output, preserving decimal strings
  --help             Show help
Uses HENSEI_API_URL (default http://localhost:3000/api/v1).
No simulation database connection; saved settings remain read-only.
Hypothetical catalogue simulations; no spark exchange.
`

export function parseOptions(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      operation: { type: "string", default: "draw" },
      target: { type: "string" },
      copies: { type: "string", default: "1" },
      comparison: { type: "string", default: "at_least" },
      mode: { type: "string", default: "premium" },
      draws: { type: "string", default: "300" },
      seed: { type: "string" },
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
  if (!["draw", "until", "odds"].includes(values.operation))
    throw new Error("Invalid --operation")
  if (!["exactly", "at_least"].includes(values.comparison))
    throw new Error("Invalid --comparison")
  const copies = Number(values.copies)
  if (!Number.isInteger(copies) || copies < 1 || copies > 1000)
    throw new Error("--copies must be 1–1000")
  if (values.operation !== "draw" && !values.target && !values.help)
    throw new Error("--target is required")
  const draws = Number(values.draws)
  if (
    !/^\d+$/.test(values.draws) ||
    !Number.isSafeInteger(draws) ||
    draws < 1 ||
    draws > (values.operation === "odds" ? 1_000_000_000_000 : 1_000_000)
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
    copies,
    operation: values.operation as "draw" | "until" | "odds",
    mode: values.mode as Promotion,
    season: values.season as Season | undefined,
    draws,
    rateups,
  }
}

export async function runSimulation(
  options: ReturnType<typeof parseOptions>,
  client = new GachaClient(),
) {
  const configuration = {
    mode: options.mode,
    season: options.season,
    purchase: options.singles ? ("singles" as const) : ("ten" as const),
  }
  const items = await client.catalogue(configuration)
  return client.run(options.operation, {
    ...configuration,
    draws: String(options.draws),
    seed: options.seed,
    copies: options.copies,
    comparison: options.comparison,
    target: options.target
      ? resolveTarget(items, options.target).identity
      : undefined,
    rateups: options.rateups.map((rate) => ({
      identity: resolveTarget(
        items,
        `${rate.type ? `${rate.type}:` : ""}${rate.id}`,
      ).identity,
      percent: rate.rate,
    })),
  })
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }
  const result = await runSimulation(options)
  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(`${result.label} — ${result.draws} draws; seed ${result.seed}`)
  if (result.copies)
    console.log(`Sampled ${result.copies} copies in ${result.draws} draws`)
  if (result.probability !== undefined) {
    console.log(
      `Probability: ${(result.probability * 100).toPrecision(9)}%; expected copies: ${result.expected_copies}`,
    )
    console.table(result.thresholds)
  }
  if (result.totals) console.table(result.totals)
  if (result.items)
    console.table(
      result.items
        .filter((item) => item.rarity === 3)
        .map((item) => ({ name: item.name.en, count: item.count })),
    )
  console.log(result.cost)
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
