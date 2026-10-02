import assert from "node:assert/strict"
import test from "node:test"
import type { Kysely } from "kysely"
import type { Database } from "../src/services/connection.js"
import { checkRateupSchema } from "../src/services/readiness.js"
import Until from "../src/services/until.js"
import Api from "../src/services/api.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { DrawableItemType, Promotion } from "../src/utils/enums.js"
import type { Subcommand } from "@sapphire/plugin-subcommands"

void test("readiness checks typed columns with a read-only zero-row query", async () => {
  const calls: unknown[] = []
  const query = {
    select: (columns: unknown) => {
      calls.push(columns)
      return query
    },
    limit: (limit: number) => {
      calls.push(limit)
      return query
    },
    execute: async () => [],
  }
  const db = {
    selectFrom: (table: string) => {
      calls.push(table)
      return query
    },
  } as unknown as Kysely<Database>
  await checkRateupSchema(db)
  assert.deepEqual(calls, [
    "gacha_rateups",
    ["drawable_type", "drawable_id"],
    0,
  ])
})
void test("missing migration fails readiness with actionable context and retains cause", async () => {
  const cause = { code: "42703" }
  const query = {
    select: () => query,
    limit: () => query,
    execute: async () => {
      throw cause
    },
  }
  const db = { selectFrom: () => query } as unknown as Kysely<Database>
  await assert.rejects(
    checkRateupSchema(db),
    (error) =>
      error instanceof Error &&
      error.message.includes("Missing typed rate-up migration") &&
      error.cause === cause,
  )
})
void test("unique name selection retains its typed identity even with a shared Granblue ID", async () => {
  const originalFind = Api.findItem
  const originalFetch = Api.fetchItemInfoFromID
  const selected = {
    item_id: "typed-weapon",
    granblue_id: "123",
    type: DrawableItemType.WEAPON,
    name: { en: "Unique", jp: "" },
  } as DrawableItem
  const replies: unknown[] = []
  try {
    Api.findItem = async () => [selected]
    Api.fetchItemInfoFromID = async () => {
      throw new Error("Shared Granblue ID must not be queried")
    }
    const interaction = {
      editReply: async (payload: unknown) => {
        replies.push(payload)
      },
    } as unknown as Subcommand.ChatInputCommandInteraction
    const until = new Until(interaction, "Unique", "usd", Promotion.PREMIUM)
    until.simulate = async () => {
      assert.equal(until.item, selected)
      return {
        count: 10,
        cost: { crystals: 3000, jpy: 3150, usd: 21 },
        assumptions: [],
      }
    }
    await until.execute()
    assert.equal(replies.length, 1)
    assert.equal(until.item?.item_id, "typed-weapon")
  } finally {
    Api.findItem = originalFind
    Api.fetchItemInfoFromID = originalFetch
  }
})
