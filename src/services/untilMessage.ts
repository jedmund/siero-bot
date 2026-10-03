import type { GachaResult } from "./gachaClient.js"

// Keep the API's decimal strings exact, including amounts beyond Number.MAX_SAFE_INTEGER.
function number(value: string, minimumDecimals = 0): string {
  const [integer, fraction = ""] = value.split(".")
  const decimals = fraction.replace(/0+$/, "").padEnd(minimumDecimals, "0")
  return `${BigInt(integer).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`
}

export function untilMessage(
  result: GachaResult,
  name: string,
  currency: string,
): string {
  const copies = result.copies ?? "1"
  const target =
    copies === "1"
      ? `\`${name}\``
      : `**${number(copies)} copies** of \`${name}\``
  const rate = ["flash", "legend"].includes(result.configuration.mode)
    ? "6%"
    : "3%"
  const quote = result.cost.exchange_rate
  const showUsd =
    currency === "usd" && result.cost.usd !== null && quote !== null
  const cash = showUsd
    ? `💵 **$${number(result.cost.usd!, 2)} USD**`
    : `💴 **¥${number(result.cost.jpy)}**`
  const lines = [
    `You pulled ${target} in **${number(result.draws)} rolls** on a ${rate} banner.`,
    `That's <:ssr:479609697930969089> **${number(result.cost.crystals)} crystals** or ${cash}.`,
    "-# Simulated results · Estimated cost.",
  ]
  if (showUsd) {
    lines.push(
      `-# USD reference estimate: ${quote!.provider}, ${quote!.date}${quote!.stale ? " (stale)" : ""} · Conversion charges excluded.`,
    )
  } else if (currency === "usd") {
    lines.push("-# USD estimate unavailable; showing JPY.")
  }
  return lines.join("\n")
}
