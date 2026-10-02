import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { test } from "node:test"
import Rateup from "../src/services/rateup.js"
import Api from "../src/services/api.js"
import type { Subcommand } from "@sapphire/plugin-subcommands"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { DrawableItemType, Element, Rarity } from "../src/utils/enums.js"

const item: DrawableItem = {
  id: "uuid",
  item_id: "uuid",
  drawableType: "Weapon",
  granblue_id: "1",
  type: DrawableItemType.WEAPON,
  name: { en: "Item", jp: "" },
  rarity: Rarity.SSR,
  element: Element.FIRE,
  promotions: { premium: true, classic: false, flash: false, legend: false },
  seasons: {
    summer: false,
    halloween: false,
    holiday: false,
    valentines: false,
  },
}

void test("failed lookup and selection timeout preserve all prior rates", async () => {
  const originalFind = Api.findItem
  const originalSave = Api.addRateups
  let saved = 0
  const messages: string[] = []
  const interaction = {
    user: { id: "owner" },
    deferred: false,
    replied: false,
    async deferReply() {
      this.deferred = true
    },
    async editReply(payload: { content: string }) {
      messages.push(payload.content)
      return {
        createMessageComponentCollector(options: {
          filter: (value: { user: { id: string }; customId: string }) => boolean
        }) {
          assert.equal(
            options.filter({ user: { id: "intruder" }, customId: "conflict" }),
            false,
          )
          assert.equal(
            options.filter({ user: { id: "owner" }, customId: "wrong" }),
            false,
          )
          const collector = new EventEmitter()
          queueMicrotask(() => collector.emit("end", new Map()))
          return collector
        },
      }
    },
  }
  try {
    Api.addRateups = async () => {
      saved++
    }
    Api.findItem = async (query) => (query === "missing" ? [] : [item])
    await new Rateup(
      interaction as unknown as Subcommand.ChatInputCommandInteraction,
      [
        { identifier: "known", rate: 0.3 },
        { identifier: "missing", rate: 0.3 },
      ],
    ).execute()
    assert.equal(saved, 0)
    assert.match(messages.at(-1)!, /missing/)
    Api.findItem = async () => [item, { ...item, item_id: "other" }]
    await new Rateup(
      interaction as unknown as Subcommand.ChatInputCommandInteraction,
      [{ identifier: "ambiguous", rate: 0.3 }],
    ).execute()
    assert.equal(saved, 0)
    assert.match(messages.at(-1)!, /preserved/)
  } finally {
    Api.findItem = originalFind
    Api.addRateups = originalSave
  }
})

void test("public rerun reads current source rates without altering the clicker's settings", async () => {
  const { HandleSparkButtonInteractionListener } =
    await import("../src/listeners/handleSparkButtonInteraction.js")
  const { default: Gacha } = await import("../src/services/gacha.js")
  const { RenderingUtils } = await import("../src/utils/rendering.js")
  const originalRead = Api.fetchRateups
  const originalCopy = Api.copyRateups
  const originalCreate = Gacha.create
  const originalRender = RenderingUtils.renderSpark
  const users: string[] = []
  const messages: string[] = []
  try {
    Api.fetchRateups = async (user) => {
      users.push(user)
      return [{ item, rate: 0.3 }]
    }
    Api.copyRateups = async () => {
      assert.fail("A rerun cannot copy rates")
    }
    Gacha.create = async () =>
      ({ spark: () => ({}) }) as unknown as InstanceType<typeof Gacha>
    RenderingUtils.renderSpark = () =>
      ({}) as ReturnType<typeof RenderingUtils.renderSpark>
    const interaction = {
      isButton: () => true,
      customId: "copySpark:source:premium:undefined",
      user: { id: "clicker" },
      deferred: false,
      async deferReply() {
        this.deferred = true
      },
      async editReply(payload: { content: string }) {
        messages.push(payload.content)
      },
    }
    const listener = Object.create(
      HandleSparkButtonInteractionListener.prototype,
    ) as InstanceType<typeof HandleSparkButtonInteractionListener>
    await listener.run(
      interaction as unknown as Parameters<typeof listener.run>[0],
    )
    assert.deepEqual(users, ["source"])
    assert.match(messages[0], /current settings/)
  } finally {
    Api.fetchRateups = originalRead
    Api.copyRateups = originalCopy
    Gacha.create = originalCreate
    RenderingUtils.renderSpark = originalRender
  }
})
