import assert from "node:assert/strict"
import test from "node:test"
import { untilMessage } from "../src/services/untilMessage.js"
import type { GachaResult } from "../src/services/gachaClient.js"

const result: GachaResult = {
  draws: "3770",
  copies: "1",
  seed: "replay",
  configuration: { mode: "flash" },
  catalogue_fingerprint: "catalogue",
  engine_version: "1",
  label: "Hypothetical catalogue simulation",
  cost: {
    crystals: "1131000.0",
    jpy: "1187550.0",
    usd: null,
    exchange_rate: null,
    label: "Purchase estimate",
  },
}

void test("Until restores readable rolls, crystal emoji and formatted JPY", () => {
  const message = untilMessage(result, "Silver Vine", "jpy")
  assert.equal(
    message.split("\n")[0],
    "You pulled `Silver Vine` in **3,770 rolls** on a 6% banner.",
  )
  assert.equal(
    message.split("\n")[1],
    "That's <:ssr:479609697930969089> **1,131,000 crystals** or 💴 **¥1,187,550**.",
  )
  assert.match(message, /-# Simulated results · Estimated cost/)
  assert.doesNotMatch(message, /seed|replay/i)
  assert.doesNotMatch(message, /1 copies|1131000\.0|USD/)
})

void test("Until preserves huge counts and final-purchase copy overshoot", () => {
  const message = untilMessage(
    {
      ...result,
      configuration: { mode: "classic_iii" },
      copies: "2",
      requested_copies: "1",
      draws: "90071992547409930",
      cost: {
        ...result.cost,
        crystals: "27021597764222979000.0",
        jpy: "28372677652434127950.0",
      },
    },
    "Yatima",
    "jpy",
  )
  assert.match(message, /\*\*2 copies\*\* of `Yatima`/)
  assert.match(message, /90,071,992,547,409,930 rolls/)
  assert.match(message, /27,021,597,764,222,979,000 crystals/)
  assert.match(message, /¥28,372,677,652,434,127,950/)
  assert.match(message, /3% banner/)
})

void test("USD uses two decimals and retains dated stale-quote context", () => {
  const message = untilMessage(
    {
      ...result,
      cost: {
        ...result.cost,
        usd: "12345.50",
        exchange_rate: {
          provider: "Frankfurter/ECB",
          date: "2026-10-02",
          jpy_per_usd: "157.67",
          stale: true,
        },
      },
    },
    "Yatima",
    "usd",
  )
  assert.match(message, /💵 \*\*\$12,345\.50 USD\*\*/)
  assert.match(message, /Frankfurter\/ECB, 2026-10-02 \(stale\)/)
  assert.match(message, /Conversion charges excluded/)
  assert.doesNotMatch(message, /💴/)
  assert.match(
    untilMessage(result, "Yatima", "usd"),
    /USD estimate unavailable; showing JPY/,
  )
})
