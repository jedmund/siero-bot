import assert from "node:assert/strict"
import { test } from "node:test"
import { parseRateupPair } from "../src/services/rateupInput.js"

void test("rate-up percentage parsing rejects partial and nonfinite numbers", () => {
  for (const rate of [
    "0.3%",
    "0.3junk",
    "Infinity",
    "NaN",
    "1e2",
    "",
    "-1",
    "0",
    "7",
  ])
    assert.throws(() => parseRateupPair("item", rate, 1))
  assert.throws(() => parseRateupPair("item", null, 2), /both/)
  assert.throws(() => parseRateupPair(null, "0.3", 2), /both/)
  assert.deepEqual(parseRateupPair("item", " .3 ", 1), {
    identifier: "item",
    rate: 0.3,
  })
  assert.equal(parseRateupPair(null, null, 2), null)
})
