import Api, { CatalogueValidationError } from "./api.js"
import type { ItemRateMap, RateMap } from "../utils/types.js"
import isGranblueID from "../utils/isGranblueID.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ComponentType, EmbedBuilder } from "discord.js"
import DrawableItem from "../interfaces/DrawableItem.js"
import { renderHtmlBlock } from "../utils/formatting.js"
import { waitForOwnedComponent } from "./ownedComponent.js"
import { SimulationValidationError } from "./simulation.js"
import { generateConflictSelect } from "../utils/selectMenu.js"

const INTERACTION_TIMEOUT = 60000 // 1 minute timeout for interactions

class Rateup {
  interaction: Subcommand.ChatInputCommandInteraction
  rawRates: RateMap

  rates: ItemRateMap = []
  conflicts: { results: DrawableItem[]; rate: number }[] = []

  constructor(
    interaction: Subcommand.ChatInputCommandInteraction,
    rates: RateMap,
  ) {
    this.interaction = interaction
    this.rawRates = rates
  }

  public async execute() {
    let committed = false
    try {
      await this.interaction.deferReply()
      // Detect if there are any duplicates, then present any conflicts
      await this.detectDuplicates()

      // If there are conflicts, present them to the user
      if (this.conflicts.length > 0) {
        await this.presentConflicts()
      }

      // Once the conflicts have been resolved,
      // remove the user's current rateups and add the new ones
      await Api.validateRateups(this.rates)
      await Api.addRateups(this.interaction.user.id, this.rates)
      committed = true

      const completed = {
        content:
          "Your simulation rates have been updated. Settings are revalidated for each banner; totals above 3% require a Gala.",
        ephemeral: false,
        components: [],
        embeds: [this.renderEmbed()],
      }

      await this.interaction.editReply(completed)
    } catch (error) {
      console.error("Error in Rateup.execute:", error)
      if (!committed) await this.handleExecuteError(error)
    }
  }

  private async detectDuplicates() {
    for (const rate of this.rawRates) {
      const options = isGranblueID(rate.identifier)
        ? [await Api.fetchItemInfoFromID(rate.identifier)].filter(
            (item): item is DrawableItem => item !== null,
          )
        : await Api.findItem(rate.identifier)
      if (!options.length)
        throw new CatalogueValidationError(
          `No item found for "${rate.identifier}". Your settings were preserved.`,
        )
      if (options.length > 1)
        this.conflicts.push({ results: options, rate: rate.rate })
      else this.rates.push({ item: options[0], rate: rate.rate })
    }
  }

  private async presentConflicts() {
    try {
      await this.interaction.editReply({
        content: `${this.conflicts.length} conflicts were found when setting your rateups`,
      })

      for (const [i, conflict] of this.conflicts.entries()) {
        const select = generateConflictSelect(conflict.results)

        // Edit the reply and wait for the result
        const message = await this.interaction.editReply({
          content: `(${i + 1} of ${
            this.conflicts.length
          }) Which item would you like to rate up?`,
          components: [select],
        })

        try {
          // Wait for the message component and handle the result
          const collected = await waitForOwnedComponent(
            message,
            this.interaction.user.id,
            "conflict",
            ComponentType.StringSelect,
            INTERACTION_TIMEOUT,
          )
          if (!collected.isStringSelectMenu())
            throw new CatalogueValidationError("Invalid selection.")

          await collected.deferUpdate()
          const result = conflict.results.find(
            (item) =>
              `${item.drawableType}:${item.item_id}` === collected.values[0],
          )
          if (!result)
            throw new CatalogueValidationError(
              "Invalid selection. Your settings were preserved.",
            )
          this.rates.push({ item: result, rate: conflict.rate })
        } catch (error) {
          if (error instanceof CatalogueValidationError) throw error
          throw new CatalogueValidationError(
            "Selection expired or failed. Your settings were preserved; try again.",
          )
        }
      }
    } catch (error) {
      console.error("Error in presentConflicts:", error)
      throw error // Re-throw to be caught by execute()
    }
  }

  private renderEmbed() {
    let details = ""
    this.rates.forEach((rate) => {
      details += `(${rate.rate}%) ${rate.item.name.en}\n`
    })

    return new EmbedBuilder()
      .setDescription("These rates only apply to your simulations:")
      .addFields({ name: "Rates", value: renderHtmlBlock(details) })
  }

  // Methods: Helpers

  private async handleExecuteError(error: unknown) {
    const errorMessage =
      error instanceof CatalogueValidationError ||
      error instanceof SimulationValidationError
        ? error.message
        : "There was an error processing your rate-up request. Please try again."

    try {
      if (this.interaction.replied || this.interaction.deferred) {
        await this.interaction.editReply({
          content: errorMessage,
          components: [],
        })
      } else {
        await this.interaction.reply({
          content: errorMessage,
          ephemeral: true,
        })
      }
    } catch (replyError) {
      console.error("Failed to send error message:", replyError)
      // Nothing more we can do if this fails
    }
  }
}

export default Rateup
