import { setTimeout as delay } from "node:timers/promises"

export interface CatalogueItem {
  identity: string
  drawable_type: "Weapon" | "Summon"
  drawable_id: string
  granblue_id: string
  name: { en: string; ja: string }
  rarity: number
  element: number
  promotions: number[]
  recruits?: { en: string; ja: string } | null
  count?: string
}
export interface GachaConfiguration {
  mode: string
  season?: string | null
  purchase?: "singles" | "ten"
  rateups?: { identity: string; percent: number | string }[]
}
export interface GachaResult {
  draws: string
  seed: string
  configuration: GachaConfiguration
  catalogue_fingerprint: string
  engine_version: string
  label: string
  ordered?: CatalogueItem[] | null
  items?: CatalogueItem[]
  totals?: { R: string; SR: string; SSR: string }
  copies?: string
  target?: string
  comparison?: string
  requested_copies?: string
  probability?: number
  expected_copies?: number
  thresholds?: Record<string, string | null>
  cost: {
    crystals: string
    jpy: string
    usd: string | null
    label: string
    exchange_rate: {
      provider: string
      date: string
      jpy_per_usd: string
      stale: boolean
    } | null
  }
}
export class GachaApiError extends Error {}
export class GachaClient {
  constructor(
    private base = process.env.HENSEI_API_URL ?? "http://localhost:3000/api/v1",
    private request: typeof fetch = fetch,
  ) {}

  private async json(
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const response = await this.request(
      `${this.base.replace(/\/$/, "")}/gacha/${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      },
    )
    const value = (await response.json()) as Record<string, unknown>
    if (!response.ok)
      throw new GachaApiError(
        `${String(value.error ?? "Gacha API request failed")}${response.status === 429 ? ` (retry after ${response.headers.get("Retry-After") ?? "60"} seconds)` : ""}`,
      )
    return value
  }

  async catalogue(
    config: GachaConfiguration,
    query?: string,
  ): Promise<CatalogueItem[]> {
    const params = new URLSearchParams({ mode: config.mode })
    if (config.season) params.set("season", config.season)
    if (query) params.set("q", query)
    const data = await this.json(`catalogue?${params}`)
    return data.items as CatalogueItem[]
  }

  async run(
    operation: "draw" | "until" | "odds",
    input: GachaConfiguration & {
      draws?: string | number
      seed?: string
      target?: string
      copies?: number
      comparison?: string
    },
  ): Promise<GachaResult> {
    let data = await this.json(
      operation === "draw" ? "simulations" : operation,
      input,
    )
    if (typeof data.token === "string") {
      const token = data.token
      const deadline = Date.now() + 10 * 60_000
      while (Date.now() < deadline) {
        await delay(1000)
        data = await this.json(`jobs/${encodeURIComponent(token)}`)
        if (data.status === "complete") return data.result as GachaResult
        if (data.status === "failed")
          throw new GachaApiError(String(data.error))
      }
      throw new GachaApiError(
        `Simulation is still queued. Retrieve it using GET /gacha/jobs/${token} within one hour.`,
      )
    }
    return data as unknown as GachaResult
  }
}

export function resolveTarget(
  items: CatalogueItem[],
  input: string,
): CatalogueItem {
  const typed = /^(Weapon|Summon):(.+)$/.exec(input)
  const matches = items.filter(
    (item) =>
      item.identity === input ||
      ((!typed || item.drawable_type === typed[1]) &&
        item.granblue_id === (typed?.[2] ?? input)),
  )
  if (matches.length !== 1)
    throw new GachaApiError(
      `Target ${input} matched ${matches.length} items; use a unique Weapon:UUID or Summon:UUID.`,
    )
  return matches[0]
}
