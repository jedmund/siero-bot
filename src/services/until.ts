import { setImmediate as yieldTurn } from "node:timers/promises"
import { runtime } from "./lifecycle.js"
import { ComponentType, StringSelectMenuInteraction } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"

import Api from "./api.js"
import Gacha, { SimulationValidationError } from "./gacha.js"

import { DrawableItemType, Promotion, Season } from "../utils/enums.js"
import { generateConflictSelect } from "../utils/selectMenu.js"

import type DrawableItem from "../interfaces/DrawableItem.js"
import isGranblueID from "../utils/isGranblueID.js"
import fetchRateups from "../utils/fetchRateups.js"
import { RenderingUtils } from "../utils/rendering.js"

export async function rollUntilTarget(gacha: Pick<Gacha, "canDraw" | "tenPartRoll">, target: DrawableItem, maximumDraws = 100000) {
  if (!Number.isInteger(maximumDraws) || maximumDraws < 10 || maximumDraws > 100000 || maximumDraws % 10 !== 0) throw new SimulationValidationError("Draw limit must be a multiple of ten between 10 and 100000")
  if (!gacha.canDraw(target)) throw new SimulationValidationError("The target is unavailable in the selected pool or has zero effective probability")
  for (let count = 10; count <= maximumDraws; count += 10) {
    runtime.assertAccepting()
    if (count % 1000 === 0) await yieldTurn()
    runtime.assertAccepting()
    if (gacha.tenPartRoll().items.some(item => item.type === target.type && item.item_id === target.item_id)) return count
  }
  throw new SimulationValidationError(`Stopped after ${maximumDraws} draws without finding the target`)
}

class Until {
  identifier: string
  currency: string
  promotion: Promotion
  season?: Season

  item?: DrawableItem

  interaction: Subcommand.ChatInputCommandInteraction

  constructor(
    interaction: Subcommand.ChatInputCommandInteraction,
    identifier: string,
    currency: string,
    promotion: Promotion,
    season?: Season
  ) {
    this.interaction = interaction
    this.identifier = identifier
    this.promotion = promotion
    this.season = season
    this.currency = currency
  }

  public async execute() {
    if (isGranblueID(this.identifier)) {
      // Fetch the item's info via Granblue ID
      await this.fetchItemAndSimulate()
    } else {
      // Find possible items via provided string
      const options = await Api.findItem(this.identifier)

      if (options.length > 1) {
        // Present options to the user if there's more than one option
        await this.presentOptions(this.interaction, options)
      } else if (options.length === 1) {
        // Proceed to simulate if there is only one option
        const found = options[0]
        this.item = found
        this.identifier = found.granblue_id
        await this.generateResponse(await this.simulate())
      } else {
        // Inform the user no options could be found
        await this.interaction.editReply(
          `No items were found for \`${this.identifier}\``
        )
      }
    }
  }

  private async fetchItemAndSimulate() {
    try {
      // Fetch the item's info via Granblue ID
      const fetchedItem = await Api.fetchItemInfoFromID(this.identifier)

      // Convert null to undefined for type compatibility
      this.item = fetchedItem || undefined

      if (!this.item) {
        await this.interaction.editReply(
          `No item found with ID \`${this.identifier}\``
        )
        return
      }

      const result = await this.simulate()
      await this.generateResponse(result)
    } catch (error) {
      console.error(`Error fetching item:`, error)
      await this.interaction.editReply(error instanceof SimulationValidationError ? error.message : "Error fetching item information")
    }
  }

  private async presentOptions(
    interaction: Subcommand.ChatInputCommandInteraction,
    options: DrawableItem[]
  ) {
    // Send the user a select to select the correct item from the options found
    const response = await interaction.editReply({
      content: `Multiple items named \`${this.identifier}\` were found. Which item would you like to simulate draws for?`,
      components: [generateConflictSelect(options)],
    })

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: input => input.user.id === interaction.user.id && input.customId === "conflict",
      time: 120_000,
      max: 1,
    })
    const unregister = runtime.registerCleanup(() => { collector.stop("shutdown") })
    collector.on("collect", input => { runtime.background(this.collectOption(input, this), "Until selection failed") })
    collector.on("end", (_collected, reason) => {
      unregister()
      if (reason !== "limit") runtime.background(interaction.editReply({ components: [], content: "Item selection expired. Run the command again." }), "Until selector cleanup failed")
    })
  }

  private async collectOption(input: StringSelectMenuInteraction, that: Until) {
    try {
      await input.deferUpdate()
      const selection = input.values[0]
      const fetchedItem = await Api.fetchItemInfoFromReference(selection)

      // Convert null to undefined for type compatibility
      that.item = fetchedItem || undefined

      if (!that.item) {
        await input.editReply({
          content: `No item found with ID \`${selection}\``,
          components: [],
        })
        return
      }

      // Safe access now that we checked
      that.identifier = that.item.granblue_id

      const result = await that.simulate()
      await that.generateResponse(result)
    } catch (error) {
      console.error(`Error processing selection:`, error)
      await input.editReply({
        content: error instanceof SimulationValidationError ? error.message : "Error processing your selection",
        components: [],
      })
    }
  }

  public async simulate() {
    const rateups = await fetchRateups(this.interaction.user.id)

    // Check the selected typed item identity against the actual draw pool.
    const gacha = await Gacha.create(rateups, this.promotion, this.season)
    if (!this.item || !gacha.canDraw(this.item)) throw new SimulationValidationError("The target is unavailable in the selected pool or has zero effective probability")
    const count = await this.roll(gacha)

    return {
      count: count,
      cost: this.calculateCost(count),
    }
  }

  private roll(gacha: Gacha) {
    if (!this.item) throw new SimulationValidationError("No target selected")
    return rollUntilTarget(gacha, this.item)
  }

  // Methods: Rendering methods


  private async generateResponse(result: { count: number; cost: { crystals: number; jpy: number; usd: number } }) {
    let name = ""
    if (this.item) {
      const item = this.item
      switch (item.type) {
        case DrawableItemType.WEAPON:
          if (item.recruits) name = `${item.name.en} (${item.recruits.name.en})`
          else name = item.name.en
          break
        case DrawableItemType.SUMMON:
          name = item.name.en
          break
      }
    }

    let currencyString = ""
    if (this.currency === "usd") {
      currencyString = `about :dollar: $${result.cost.usd.toLocaleString()}`
    } else if (this.currency === "jpy") {
      currencyString = `:yen: ¥${result.cost.jpy.toLocaleString()}`
    }

    const rateString =
      this.promotion === Promotion.FLASH || this.promotion === Promotion.LEGEND
        ? "on a 6% banner."
        : "on a 3% banner."
    const pullString = `You pulled \`${name}\` in ${result.count.toLocaleString()} rolls`
    const costString = this.currency
      ? `That's <:ssr:479609697930969089> **${result.cost.crystals.toLocaleString()} crystals** or **${currencyString}**.`
      : ""

    await this.interaction.editReply({
      content: `${pullString} ${rateString} \n${costString}\n${RenderingUtils.simulationNotice}`,
      components: [],
    })
  }

  // Methods: Utility methods

  private calculateCost(rolls: number) {
    const NUM_TEN_PULLS = rolls / 10
    const TEN_PULL_COST = 3000
    const MOBACOIN_COST = 3150
    const ESTIMATED_EXCHANGE_RATE = 0.00667

    return {
      crystals: NUM_TEN_PULLS * TEN_PULL_COST,
      jpy: NUM_TEN_PULLS * MOBACOIN_COST,
      usd: Math.ceil(NUM_TEN_PULLS * MOBACOIN_COST * ESTIMATED_EXCHANGE_RATE),
    }
  }

}

export default Until
