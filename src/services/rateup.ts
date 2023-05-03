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
    // Detect if there are any duplicates, then
    // present the conflicts to the user
    await this.detectDuplicates()
    if (this.conflicts.length > 0) await this.presentConflicts()

    // Once the conflicts have been resolved,
    // remove the user's current rateups and add the new ones
    await Api.removeRateups(this.interaction.user.id)
    await Api.addRateups(this.interaction.user.id, this.rates)

    const completed = {
      content: "Your simulation's rates have been updated.",
      ephemeral: true,
      components: [],
      embeds: [this.renderEmbed()],
    }

    if (this.conflicts.length > 0) this.interaction.editReply(completed)
    else this.interaction.reply(completed)
  }

  private async detectDuplicates() {
    for (const rate of await Promise.all(this.rawRates)) {
      if (isGranblueID(rate.identifier)) {
        const item = await Api.fetchItemInfoFromID(rate.identifier)
        // Add to actual rates list
        this.rates.push({ item: item, rate: rate.rate })
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
          // Not found
        }
      }
    }
  }

  private async presentConflicts() {
    await this.interaction.reply({
      content: `${this.conflicts.length} conflicts were found when setting your rateups`,
    })

    const collectorFilter = (i: MessageComponentInteraction) => {
      i.deferUpdate()
      return i.user.id === this.interaction.user.id
    }

    for (const [i, conflict] of this.conflicts.entries()) {
      const select = this.generateSelect(conflict.results)

      // Edit the reply and wait for the result
      const message = await this.interaction.editReply({
        content: `(${i + 1} of ${
          this.conflicts.length
        }) Which item would you like to rate up?`,
        components: [select],
      })

      // Wait for the message component and handle the result
      const collected = await message.awaitMessageComponent({
        filter: collectorFilter,
        componentType: ComponentType.StringSelect,
        time: 60000,
      })

      const result = await Api.fetchItemInfoFromID(collected.values[0])
      this.rates.push({ item: result, rate: conflict.rate })

      // No need to use Promise.resolve() here, as we are inside an async function
    }
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
        description += ` · Recruits ${item.recruits.en}`
      }

      return new StringSelectMenuOptionBuilder()
        .setLabel(item.name.en)
        .setDescription(description)
        .setValue(item.granblue_id)
    })
  }

  private renderEmbed() {
    var details = "```html\n"
    this.rates.forEach((rate) => {
      details += `(${rate.rate}%) ${rate.item.name.en}\n`
    })
    details += "\n```"

    return new EmbedBuilder()
      .setDescription("These rates only apply to your simulations:")
      .addFields({ name: "Rates", value: details })
  }
}

export default Rateup
