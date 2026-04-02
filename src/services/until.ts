import { ComponentType, StringSelectMenuInteraction } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"

import Api from "./api.js"
import Gacha from "./gacha.js"

import { DrawableItemType, Promotion, Season } from "../utils/enums.js"
import { generateConflictSelect } from "../utils/selectMenu.js"

import type DrawableItem from "../interfaces/DrawableItem.js"
import isGranblueID from "../utils/isGranblueID.js"
import fetchRateups from "../utils/fetchRateups.js"

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
      this.fetchItemAndSimulate()
    } else {
      // Find possible items via provided string
      const options = await Api.findItem(this.identifier)

      if (options.length > 1) {
        // Present options to the user if there's more than one option
        this.presentOptions(this.interaction, options)
      } else if (options.length === 1) {
        // Proceed to simulate if there is only one option
        const found = options[0]
        this.identifier = found.granblue_id
        this.fetchItemAndSimulate()
      } else {
        // Inform the user no options could be found
        this.interaction.editReply(
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
      this.generateResponse(result)
    } catch (error) {
      console.error(`Error fetching item:`, error)
      await this.interaction.editReply("Error fetching item information")
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

    // Create a collector and listen for responses
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 3_600_000,
    })

    await collector.on("collect", async (i) => {
      this.collectOption(i, this)
    })
  }

  private async collectOption(input: StringSelectMenuInteraction, that: Until) {
    try {
      const selection = input.values[0]
      const fetchedItem = await Api.fetchItemInfoFromID(selection)

      // Convert null to undefined for type compatibility
      that.item = fetchedItem || undefined

      if (!that.item) {
        await input.update({
          content: `No item found with ID \`${selection}\``,
          components: [],
        })
        return
      }

      // Safe access now that we checked
      that.identifier = that.item.granblue_id

      const result = await that.simulate()
      that.generateResponse(result)
    } catch (error) {
      console.error(`Error processing selection:`, error)
      await input.update({
        content: "Error processing your selection",
        components: [],
      })
    }
  }

  public async simulate() {
    if (!this.simulationValid()) {
      // Update the object to use the correct promotion and season
      this.validateSimulation()
    }

    const rateups = await fetchRateups(this.interaction.user.id)

    // Proceed with simulation if it is valid
    // At this point, we should only be searching by Granblue ID, which is unique
    // so we no longer need to COUNT(*) the database for possibilities
    const gacha = new Gacha(rateups, this.promotion, this.season)
    const count = this.roll(gacha)

    return {
      count: count,
      cost: this.calculateCost(count),
    }
  }

  private roll(gacha: Gacha) {
    let count = 0
    let found = false

    while (!found && this.item) {
      const roll = gacha.tenPartRoll()
      count = count + 10

      for (const i in roll.items) {
        const item = roll.items[i]
        if (
          item.name.en == this.item.name.en ||
          item.name.en == this.item.recruits?.name.en
        ) {
          found = true
        }
      }
    }

    return count
  }

  // Methods: Rendering methods


  private generateResponse(result: { count: number; cost: { crystals: number; jpy: number; usd: number } }) {
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

    this.interaction.editReply({
      content: `${pullString} ${rateString} \n${costString}`,
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

  private simulationValid() {
    let promotionMatch = false
    let seasonMatch = this.season ? false : true

    if (this.item && this.item.promotions[this.promotion]) promotionMatch = true
    if (this.item && this.season && this.item.seasons[this.season])
      seasonMatch = true

    return promotionMatch && seasonMatch
  }

  private validateSimulation() {
    if (this.item) {
      const { promotions, seasons } = this.item

      this.promotion =
        promotions.flash && this.promotion !== Promotion.FLASH
          ? Promotion.FLASH
          : promotions.legend && this.promotion !== Promotion.LEGEND
            ? Promotion.LEGEND
            : promotions.classic && this.promotion !== Promotion.CLASSIC
              ? Promotion.CLASSIC
              : this.promotion

      this.season =
        seasons.valentines && this.season !== Season.VALENTINES
          ? Season.VALENTINES
          : seasons.summer && this.season !== Season.SUMMER
            ? Season.SUMMER
            : seasons.halloween && this.season !== Season.HALLOWEEN
              ? Season.HALLOWEEN
              : seasons.holiday && this.season !== Season.HOLIDAY
                ? Season.HOLIDAY
                : this.season
    }
  }
}

export default Until
