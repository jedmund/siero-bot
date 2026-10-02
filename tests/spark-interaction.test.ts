import assert from "node:assert/strict"
import { test } from "node:test"
import { replyAfterSparkMutation } from "../src/services/spark-interaction.js"
import { SparkInputError } from "../src/services/sparks.js"

test("no-input validation replies without claiming success", async () => {
  const errors: string[] = []
  await replyAfterSparkMutation(
    async () => {
      throw new SparkInputError("Provide at least one currency amount.")
    },
    async () => {
      assert.fail("No success reply for invalid input")
    },
    async (message) => {
      errors.push(message)
    },
  )
  assert.deepEqual(errors, ["Provide at least one currency amount."])
})

test("success reply uses only committed previous/current values", async () => {
  const committed = { previous: { crystals: 100 }, current: { crystals: 105 } }
  await replyAfterSparkMutation(
    async () => committed,
    async (result) => {
      assert.equal(result, committed)
      assert.equal(result.current.crystals - result.previous.crystals, 5)
    },
    async () => {
      assert.fail("No error reply after commit")
    },
  )
})

test("Discord response failure after commit never claims the save failed", async () => {
  const replyFailure = new Error("Discord unavailable")
  await assert.rejects(
    replyAfterSparkMutation(
      async () => ({ committed: true }),
      async () => {
        throw replyFailure
      },
      async () => {
        assert.fail("A committed save must not be described as failed")
      },
    ),
    replyFailure,
  )
})
