import { runtime } from "./lifecycle.js"
import { ComponentType, StringSelectMenuInteraction } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"

import Api from "./api.js"
import { CatalogueUnavailableError } from "./cache.js"
import Gacha, { SimulationValidationError } from "./gacha.js"

import { Promotion, Season } from "../utils/enums.js"
import { generateConflictSelect } from "../utils/selectMenu.js"

import type DrawableItem from "../interfaces/DrawableItem.js"
import isGranblueID from "../utils/isGranblueID.js"
import fetchRateups from "../utils/fetchRateups.js"
import { GachaClient, GachaApiError, type GachaResult } from "./gachaClient.js"
import { oddsMessage } from "./oddsMessage.js"
import { untilMessage } from "./untilMessage.js"
import { drawableIdentity } from "./simulation.js"

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
    season?: Season,
    public copies = 1,
    public operation: "until" | "odds" = "until",
    public draws = 300,
    public comparison = "at_least",
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
      const options = await Api.findItem(this.identifier, 10, 0, this)

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
          `No items were found in the selected pool for \`${this.identifier}\``,
        )
      }
    }
  }

  private async fetchItemAndSimulate() {
    try {
      // Fetch the item's info via Granblue ID
      const fetchedItem = await Api.fetchItemInfoFromID(this.identifier, this)

      // Convert null to undefined for type compatibility
      this.item = fetchedItem || undefined

      if (!this.item) {
        await this.interaction.editReply(
          `No item found in the selected pool with ID \`${this.identifier}\``,
        )
        return
      }

      const result = await this.simulate()
      await this.generateResponse(result)
    } catch (error) {
      console.error(`Error fetching item:`, error)
      await this.interaction.editReply(
        error instanceof CatalogueUnavailableError ||
          error instanceof SimulationValidationError ||
          error instanceof GachaApiError
          ? error.message
          : "Error fetching item information",
      )
    }
  }

  private async presentOptions(
    interaction: Subcommand.ChatInputCommandInteraction,
    options: DrawableItem[],
  ) {
    // Send the user a select to select the correct item from the options found
    const response = await interaction.editReply({
      content: `Multiple items named \`${this.identifier}\` were found. Which item would you like to simulate draws for?`,
      components: [generateConflictSelect(options)],
    })

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (input) =>
        input.user.id === interaction.user.id && input.customId === "conflict",
      time: 120_000,
      max: 1,
    })
    const unregister = runtime.registerCleanup(() => {
      collector.stop("shutdown")
    })
    collector.on("collect", (input) => {
      runtime.background(
        this.collectOption(input, this),
        "Until selection failed",
      )
    })
    collector.on("end", (_collected, reason) => {
      unregister()
      if (reason !== "limit")
        runtime.background(
          interaction.editReply({
            components: [],
            content: "Item selection expired. Run the command again.",
          }),
          "Until selector cleanup failed",
        )
    })
  }

  private async collectOption(input: StringSelectMenuInteraction, that: Until) {
    try {
      await input.deferUpdate()
      const selection = input.values[0]
      const fetchedItem = await Api.fetchItemInfoFromReference(selection, that)

      // Convert null to undefined for type compatibility
      that.item = fetchedItem || undefined

      if (!that.item) {
        await input.editReply({
          content: `No item found in the selected pool with ID \`${selection}\``,
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
        content:
          error instanceof CatalogueUnavailableError ||
          error instanceof SimulationValidationError ||
          error instanceof GachaApiError
            ? error.message
            : "Error processing your selection",
        components: [],
      })
    }
  }

  public async simulate() {
    const rateups = await fetchRateups(this.interaction.user.id)
    if (!this.item) throw new SimulationValidationError("No target selected")
    const gacha = await Gacha.create(rateups, this.promotion, this.season)
    return new GachaClient(undefined, undefined, runtime.signal).run(this.operation, {
      ...gacha.configuration(),
      purchase: "ten",
      target: drawableIdentity(this.item),
      copies: this.copies,
      draws: String(this.draws),
      comparison: this.comparison,
    })
  }

  private async generateResponse(result: GachaResult) {
    const name = this.item?.name.en || this.item?.name.jp || this.identifier
    await this.interaction.editReply({
      content: this.operation === "until"
        ? untilMessage(result, name, this.currency)
        : oddsMessage(result, name, this.currency),
      components: [],
    })
  }
}
export default Until
