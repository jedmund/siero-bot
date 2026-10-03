import { rollUntilTarget } from "./reference/until.js"
import assert from "node:assert/strict"
import test from "node:test"
import Cache from "../src/services/cache.js"
import { RuntimeLifecycle } from "../src/services/lifecycle.js"
import { validateConfiguration } from "../src/services/config.js"
import { acknowledge, respond } from "../src/services/interaction.js"
import type { ChatInputCommandInteraction } from "discord.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { DrawableItemType, Rarity } from "../src/utils/enums.js"
const item = {
  item_id: "one",
  type: DrawableItemType.WEAPON,
  rarity: Rarity.SSR,
  name: { en: "One", jp: "" },
} as DrawableItem
void test("cache publishes atomically, coalesces refresh and preserves last valid snapshot", async () => {
  let finish!: (items: DrawableItem[]) => void
  let reject!: (error: Error) => void
  let loads = 0
  let now = 1000
  const cache = new Cache(
    () => {
      loads++
      return new Promise((resolve, fail) => {
        finish = resolve
        reject = fail
      })
    },
    () => now,
    100,
  )
  const first = cache.load()
  assert.equal(cache.refresh(), first)
  assert.equal(loads, 1)
  assert.throws(() => cache.snapshot, /unavailable/)
  finish([item])
  await first
  const snapshot = cache.snapshot
  assert.ok(Object.isFrozen(snapshot.items[0].name))
  const refresh = cache.refresh()
  assert.equal(cache.snapshot, snapshot)
  reject(new Error("offline"))
  await assert.rejects(refresh, /offline/)
  assert.equal(cache.snapshot, snapshot)
  assert.ok(cache.lastError)
  now += 101
  assert.throws(() => cache.snapshot, /stale/)
  const retry = cache.refresh()
  finish([{ ...item, item_id: "two" }])
  await retry
  assert.notEqual(cache.snapshot.id, snapshot.id)
  assert.equal(snapshot.items[0].item_id, "one")
  await cache.close()
})
void test("shutdown aborts work, stops resources, drains handled rejections", async () => {
  const runtime = new RuntimeLifecycle()
  let stopped = false
  runtime.registerCleanup(() => {
    stopped = true
  })
  runtime.background(Promise.resolve(), "test")
  await runtime.shutdown()
  assert.equal(stopped, true)
  assert.equal(runtime.signal.aborted, true)
  assert.throws(() => runtime.assertAccepting(), /shutting down/)
})
void test("configuration errors name fields without exposing secrets", () => {
  assert.throws(
    () =>
      validateConfiguration({ DATABASE_URL: "secret", DISCORD_TOKEN: "token" }),
    (error) => error instanceof Error && !error.message.includes("secret"),
  )
  assert.throws(() => validateConfiguration({}), /DATABASE_URL/)
  validateConfiguration({
    DATABASE_URL: "postgresql://localhost/test",
    DISCORD_TOKEN: "token",
  })
})
void test("acknowledgement happens once before slow work and response edits it", async () => {
  const calls: string[] = []
  const interaction = {
    deferred: false,
    replied: false,
    deferReply: async () => {
      calls.push("defer")
      interaction.deferred = true
    },
    editReply: async () => {
      calls.push("edit")
    },
    reply: async () => {
      calls.push("reply")
    },
  }
  const input = interaction as unknown as ChatInputCommandInteraction
  await acknowledge(input)
  await acknowledge(input)
  await respond(input, "done")
  assert.deepEqual(calls, ["defer", "edit"])
})

void test("bounded until yields to other work and returns actual draw count", async () => {
  let batches = 0
  let otherWorkRan = false
  const otherWork = new Promise<void>((resolve) => {
    setImmediate(() => {
      otherWorkRan = true
      resolve()
    })
  })
  const count = await rollUntilTarget(
    {
      canDraw: () => true,
      tenPartRoll: () => {
        batches++
        return {
          items: batches === 100 ? [item] : [],
          count: { R: 0, SR: 0, SSR: 0 },
        }
      },
    },
    item,
    1000,
  )
  assert.equal(count, 1000)
  assert.equal(batches, 100)
  assert.equal(otherWorkRan, true)
  await otherWork
})
