import type { GachaResult } from "./gachaClient.js"
import { costMessage, currencyNote, formatDecimal } from "./gachaMessage.js"

export function untilMessage(
  result: GachaResult,
  name: string,
  currency: string,
): string {
  const copies = result.copies ?? "1"
  const target =
    copies === "1"
      ? `\`${name}\``
      : `**${formatDecimal(copies)} copies** of \`${name}\``
  const rate = ["flash", "legend"].includes(result.configuration.mode)
    ? "6%"
    : "3%"
  return [
    `You pulled ${target} in **${formatDecimal(result.draws)} rolls** on a ${rate} banner.`,
    costMessage(result, currency),
    "-# Simulated results · Estimated cost.",
    ...currencyNote(result, currency),
  ].join("\n")
}
