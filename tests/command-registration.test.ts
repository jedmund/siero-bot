import assert from "node:assert/strict"
import test from "node:test"
import { ApplicationCommandRegistry } from "@sapphire/framework"
import { GachaCommand } from "../src/commands/gacha.js"
import { ChooseCommand } from "../src/commands/choose.js"
import { RateupCommand } from "../src/commands/rateup.js"

void test("commands register with Sapphire's native ESM builders", () => {
  for (const [name, CommandClass] of [
    ["gacha", GachaCommand],
    ["choose", ChooseCommand],
    ["rateup", RateupCommand],
  ] as const) {
    const command = Object.create(CommandClass.prototype) as
      GachaCommand | RateupCommand | ChooseCommand
    Object.defineProperties(command, {
      name: { value: name },
      description: { value: "Gacha commands" },
    })
    const registry = new ApplicationCommandRegistry(name)
    command.registerApplicationCommands(registry)
    assert.ok(registry.chatInputCommands.has(name))
  }
})
