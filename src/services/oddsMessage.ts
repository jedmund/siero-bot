import type { GachaResult } from "./gachaClient.js"
import { costMessage, currencyNote, formatDecimal } from "./gachaMessage.js"

function rounded(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 })
}

function percent(probability: number): string {
  const value = probability * 100
  if (value > 0 && value < 0.0001) return "<0.0001%"
  if (value < 100 && value > 99.9999) return ">99.9999%"
  return `${rounded(value)}%`
}

export function oddsMessage(
  result: GachaResult,
  name: string,
  currency: string,
): string {
  const copies = result.requested_copies ?? "1"
  const target = `${formatDecimal(copies)} ${copies === "1" ? "copy" : "copies"}`
  const comparison = result.comparison === "exactly" ? "exactly" : "at least"
  const probability =
    result.probability === undefined
      ? "Unavailable"
      : percent(result.probability)
  const expected = result.expected_copies
  const expectation =
    expected === undefined
      ? "unavailable"
      : expected > 0 && expected < 0.0001
        ? "<0.0001"
        : rounded(expected)
  const thresholds = ["50", "90", "95"].map((level) => {
    const draws = result.thresholds?.[level]
    return `**${level}%:** ${draws === null ? ">1 trillion rolls" : draws === undefined ? "unavailable" : `${formatDecimal(draws)} rolls`}`
  })
  return [
    `🎯 **${probability} chance** of pulling **${comparison} ${target}** of \`${name}\` in **${formatDecimal(result.draws)} rolls**.`,
    `Expected copies: **${expectation}**.`,
    `Rolls for at least ${target}: ${thresholds.join(" · ")}.`,
    costMessage(result, currency),
    "-# Catalogue odds · Estimated cost.",
    ...currencyNote(result, currency),
  ].join("\n")
}
