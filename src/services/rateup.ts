import Api from "./api"
import type { ItemRateMap, RateMap } from "../utils/types"
import isGranblueID from "../utils/isGranblueID"
import { Subcommand } from "@sapphire/plugin-subcommands"
import {
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  MessageComponentInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js"
import {
  readableElement,
  readableRarity,
  readableType,
} from "../utils/readable"
import DrawableItem from "../interfaces/DrawableItem"

const INTERACTION_TIMEOUT = 60000 // 1 minute timeout for interactions

class Rateup {
  interaction: Subcommand.ChatInputCommandInteraction
  rawRates: RateMap

  rates: ItemRateMap = []
  conflicts: { results: DrawableItem[]; rate: number }[] = []

  constructor(
    interaction: Subcommand.ChatInputCommandInteraction,
    rates: RateMap
  ) {
    this.interaction = interaction
    this.rawRates = rates
  }

  public async execute() {
    try {
      // Detect if there are any duplicates, then present any conflicts
      await this.detectDuplicates()

      // If no rates were found, inform the user
      if (this.rates.length === 0 && this.conflicts.length === 0) {
        await this.interaction.reply({
          content:
            "No valid items were found. Please check your input and try again.",
          ephemeral: true,
        })
        return
      }

      // If there are conflicts, present them to the user
      if (this.conflicts.length > 0) {
        await this.presentConflicts()
      }

      // Once the conflicts have been resolved,
      // remove the user's current rateups and add the new ones
      await Api.removeRateups(this.interaction.user.id)
      await Api.addRateups(this.interaction.user.id, this.rates)

      const completed = {
        content: "Your simulation's rates have been updated.",
        ephemeral: false,
        components: [],
        embeds: [this.renderEmbed()],
      }

      if (this.conflicts.length > 0) {
        this.interaction.editReply(completed)
      } else {
        this.interaction.reply(completed)
      }
    } catch (error) {
      console.error("Error in Rateup.execute:", error)
      await this.handleExecuteError()
    }
  }

  private async detectDuplicates() {
    try {
      for (const rate of this.rawRates) {
        try {
          if (isGranblueID(rate.identifier)) {
            const item = await Api.fetchItemInfoFromID(rate.identifier)

            if (item) {
              // Add to actual rates list
              this.rates.push({ item: item, rate: rate.rate })
            } else {
              console.warn(`Item with ID ${rate.identifier} not found.`)
            }
          } else {
            const options = await Api.findItem(rate.identifier)

            if (options.length > 1) {
              this.conflicts.push({ results: options, rate: rate.rate })
            } else if (options.length === 1) {
              this.rates.push({
                item: options[0],
                rate: rate.rate,
              })
            } else {
              console.warn(`No items found for query: ${rate.identifier}`)
              // Could add to a "not found" list to inform user
            }
          }
        } catch (itemError) {
          console.error(
            `Error processing rate item ${rate.identifier}:`,
            itemError
          )
          // Continue with other items instead of failing completely
        }
      }
    } catch (error) {
      console.error("Error in detectDuplicates:", error)
      throw error // Re-throw to be caught by execute()
    }
  }

  private async presentConflicts() {
    try {
      await this.interaction.reply({
        content: `${this.conflicts.length} conflicts were found when setting your rateups`,
      })

      for (const [i, conflict] of this.conflicts.entries()) {
        const select = this.generateSelect(conflict.results)

        // Edit the reply and wait for the result
        const message = await this.interaction.editReply({
          content: `(${i + 1} of ${
            this.conflicts.length
          }) Which item would you like to rate up?`,
          components: [select],
        })

        try {
          // Wait for the message component and handle the result
          const collected = await message.awaitMessageComponent({
            filter: this.collectorFilter,
            componentType: ComponentType.StringSelect,
            time: INTERACTION_TIMEOUT,
          })

          const result = await Api.fetchItemInfoFromID(collected.values[0])
          if (result) {
            this.rates.push({ item: result, rate: conflict.rate })
          }
        } catch (timeoutError) {
          // Handle timeout - skip this conflict
          console.warn("Select menu interaction timed out", timeoutError)
          await this.interaction.editReply({
            content: `Selection timed out for conflict ${i + 1}. Skipping this item.`,
            components: [],
          })

          // Wait briefly before continuing to next item
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    } catch (error) {
      console.error("Error in presentConflicts:", error)
      throw error // Re-throw to be caught by execute()
    }
  }

  private collectorFilter = (i: MessageComponentInteraction) => {
    i.deferUpdate().catch(() => {
      // Ignore deferUpdate errors (interaction might have expired)
    })
    return i.user.id === this.interaction.user.id
  }

  private generateSelect(items: DrawableItem[]) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("conflict")
      .setPlaceholder("Pick an item")
      .addOptions(this.generateConflictOptions(items))
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    )

    return row
  }

  private generateConflictOptions(items: DrawableItem[]) {
    return items.map((item) => {
      let description = `${readableType(item.type)} · ${readableRarity(
        item.rarity
      )} · ${readableElement(item.element)}`

      if (item.recruits) {
        description += ` · Recruits ${item.recruits.name.en}`
      }

      return new StringSelectMenuOptionBuilder()
        .setLabel(item.name.en)
        .setDescription(description)
        .setValue(item.granblue_id)
    })
  }

  private renderEmbed() {
    let details = ""
    this.rates.forEach((rate) => {
      details += `(${rate.rate}%) ${rate.item.name.en}\n`
    })

    return new EmbedBuilder()
      .setDescription("These rates only apply to your simulations:")
      .addFields({ name: "Rates", value: this.renderHtmlBlock(details) })
  }

  // Methods: Helpers

  private renderHtmlBlock(content: string): string {
    return `\`\`\`html\n${content}\`\`\``
  }

  private async handleExecuteError() {
    const errorMessage =
      "There was an error processing your rate-up request. Please try again."

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
