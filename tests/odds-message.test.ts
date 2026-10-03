import assert from "node:assert/strict"
import test from "node:test"
import { oddsMessage } from "../src/services/oddsMessage.js"
import type { GachaResult } from "../src/services/gachaClient.js"

const result: GachaResult = {
  draws: "300",
  requested_copies: "4",
  comparison: "at_least",
  probability: 0.013303125,
  expected_copies: 0.9,
  thresholds: { "50": "1230", "90": "2220", "95": "2590" },
  seed: "replay-secret",
  configuration: { mode: "flash" },
  catalogue_fingerprint: "catalogue",
  engine_version: "1",
  label: "Hypothetical catalogue simulation",
  cost: {
    crystals: "90000.0",
    jpy: "94500.0",
    usd: null,
    exchange_rate: null,
    label: "Purchase estimate",
  },
}

void test("Odds shows readable chance, expected copies, thresholds and cost", () => {
  const message = oddsMessage(result, "Silver Vine", "jpy")
  assert.equal(
    message.split("\n")[0],
    "🎯 **1.3303% chance** of pulling **at least 4 copies** of `Silver Vine` in **300 rolls**.",
  )
  assert.match(message, /Expected copies: \*\*0\.9\*\*/)
  assert.match(
    message,
    /Rolls for at least 4 copies: \*\*50%:\*\* 1,230 rolls · \*\*90%:\*\* 2,220 rolls · \*\*95%:\*\* 2,590 rolls/,
  )
  assert.match(
    message,
    /<:ssr:479609697930969089> \*\*90,000 crystals\*\* or 💴 \*\*¥94,500\*\*/,
  )
  assert.match(message, /-# Catalogue odds · Estimated cost/)
  assert.doesNotMatch(message, /seed|replay|90000\.0/i)
})

void test("Exactly queries retain at-least attainment thresholds and singular copy grammar", () => {
  const message = oddsMessage(
    {
      ...result,
      comparison: "exactly",
      requested_copies: "1",
      probability: 0.367,
    },
    "Yatima",
    "jpy",
  )
  assert.match(message, /\*\*exactly 1 copy\*\* of `Yatima`/)
  assert.match(message, /Rolls for at least 1 copy:/)
  assert.doesNotMatch(message, /1 copies/)
})

void test("Odds preserves large draw, cost and threshold decimal strings", () => {
  const message = oddsMessage(
    {
      ...result,
      draws: "90071992547409930",
      thresholds: { "50": "90071992547409931", "90": null },
      cost: {
        ...result.cost,
        crystals: "27021597764222979000.0",
        jpy: "28372677652434127950.0",
      },
    },
    "Yatima",
    "jpy",
  )
  assert.match(message, /90,071,992,547,409,930 rolls/)
  assert.match(message, /\*\*50%:\*\* 90,071,992,547,409,931 rolls/)
  assert.match(
    message,
    /\*\*90%:\*\* >1 trillion rolls · \*\*95%:\*\* unavailable/,
  )
  assert.match(message, /27,021,597,764,222,979,000 crystals/)
  assert.match(message, /¥28,372,677,652,434,127,950/)
})

void test("Odds does not round small positive values to zero or near-certainty to certainty", () => {
  assert.match(
    oddsMessage(
      { ...result, probability: 1e-12, expected_copies: 1e-10 },
      "Yatima",
      "jpy",
    ),
    /\*\*<0\.0001% chance\*\*/,
  )
  assert.match(
    oddsMessage({ ...result, expected_copies: 1e-10 }, "Yatima", "jpy"),
    /Expected copies: \*\*<0\.0001\*\*/,
  )
  assert.match(
    oddsMessage({ ...result, probability: 0.999999999 }, "Yatima", "jpy"),
    /\*\*>99\.9999% chance\*\*/,
  )
  for (const probability of [0, 1]) {
    assert.match(
      oddsMessage({ ...result, probability }, "Yatima", "jpy"),
      new RegExp(`\\*\\*${probability * 100}% chance\\*\\*`),
    )
  }
})

void test("Odds retains USD quote date, stale status and fallback", () => {
  const message = oddsMessage(
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
    oddsMessage(result, "Yatima", "usd"),
    /USD estimate unavailable; showing JPY/,
  )
})
