import type { GachaResult } from "./gachaClient.js"

// Keep API decimal strings exact, including amounts beyond Number.MAX_SAFE_INTEGER.
export function formatDecimal(value: string, minimumDecimals = 0): string {
  const [integer, fraction = ""] = value.split(".")
  const decimals = fraction.replace(/0+$/, "").padEnd(minimumDecimals, "0")
  return `${BigInt(integer).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`
}

export function costMessage(result: GachaResult, currency: string): string {
  const quote = result.cost.exchange_rate
  const showUsd =
    currency === "usd" && result.cost.usd !== null && quote !== null
  const cash = showUsd
    ? `💵 **$${formatDecimal(result.cost.usd!, 2)} USD**`
    : `💴 **¥${formatDecimal(result.cost.jpy)}**`
  return `That's <:ssr:479609697930969089> **${formatDecimal(result.cost.crystals)} crystals** or ${cash}.`
}

export function currencyNote(result: GachaResult, currency: string): string[] {
  if (currency !== "usd") return []
  const quote = result.cost.exchange_rate
  if (result.cost.usd === null || quote === null)
    return ["-# USD estimate unavailable; showing JPY."]
  return [
    `-# USD reference estimate: ${quote.provider}, ${quote.date}${quote.stale ? " (stale)" : ""} · Conversion charges excluded.`,
  ]
}
