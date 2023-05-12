import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageComponentInteraction,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import type { ItemRateMap, RateMap } from "../utils/types"
import Rateup from "../services/rateup"
import Api from "../services/api"

const NUM_MAX_RATEUPS = 10

@ApplyOptions<Subcommand.Options>({
  description: "Manipulate gacha rates",
  subcommands: [
    {
      name: "set",
      chatInputRun: "chatInputSet",
      default: true,
    },
    {
      name: "show",
      chatInputRun: "chatInputShow",
      default: true,
    },
    {
      name: "copy",
      chatInputRun: "chatInputCopy",
    },
    {
      name: "reset",
      chatInputRun: "chatInputReset",
    },
  ],
})
export class RateupCommand extends Subcommand {
  // Methods: Register application commands

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((command) => {
            const description = "Set the rates for your gacha simulations"
            const generated = this.rateupCommand(command, "set", description)

            for (let i = 0; i < NUM_MAX_RATEUPS; i++) {
              let required = i === 0 ? true : false
              generated.addStringOption(this.rateupItemOption(i + 1, required))
              generated.addStringOption(this.rateupRateOption(i + 1, required))
            }

            return generated
          })
          .addSubcommand((command) => {
            const description = "Show your current rate or someone else's"
            return this.rateupCommand(
              command,
              "show",
              description
            ).addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user whose rateup you want to see")
            )
          })
          .addSubcommand((command) => {
            const description = "Copy someone else's gacha rates"
            return this.rateupCommand(
              command,
              "copy",
              description
            ).addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user whose rateup you want to see")
                .setRequired(true)
            )
          })
          .addSubcommand((command) => {
            const description =
              "Reset your gacha rates to mirror the current banner"
            return this.rateupCommand(command, "reset", description)
          })
      },
      {
        idHints: ["1099571255344103433"],
      }
    )
  }

  // Methods: Subcommand and Option builders

  private rateupCommand(
    command: SlashCommandSubcommandBuilder,
    name: string,
    description: string
  ) {
    return command.setName(name).setDescription(description)
  }

  private rateupItemOption(number: number, required: boolean = false) {
    let optionBuilder: SlashCommandStringOption = new SlashCommandStringOption()

    optionBuilder.setName(`item${number}`)
    optionBuilder.setDescription(
      "The name or Granblue ID of the item to rateup"
    )
    optionBuilder.setRequired(required)

    return optionBuilder
  }

  private rateupRateOption(number: number, required: boolean = false) {
    let optionBuilder: SlashCommandStringOption = new SlashCommandStringOption()

    optionBuilder.setName(`rate${number}`)
    optionBuilder.setDescription(
      "The appearance rate of the item (in decimals)"
    )
    optionBuilder.setRequired(required)

    return optionBuilder
  }

  // Methods: Slash Commands

  public async chatInputSet(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const rates = this.getRates(interaction)
    const rateup = new Rateup(interaction, rates)
    rateup.execute()
  }

  public async chatInputShow(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    // Extract the user from the interaction and store
    // whether we are fetching rateups for the sender or someone else
    const providedUser = interaction.options.getUser("user")
    let userId = providedUser === null ? interaction.user.id : providedUser.id

    // Fetch the appropriate rates and render them to the user
    const rates = await Api.fetchRateups(userId)
    const message = await interaction.reply(
      this.renderShow(rates, userId, providedUser === null)
    )

    // If we rendered a button, wait for the message component
    // and handle the result
    if (providedUser !== null && rates.length > 0) {
      const response = await message.awaitMessageComponent({
        filter: (i) => this.collectorFilter(i, interaction),
        componentType: ComponentType.Button,
        time: 300000,
      })

      if (response.isButton()) {
        await Api.removeRateups(interaction.user.id)
        await Api.addRateups(interaction.user.id, rates)

        message.edit({
          content: `Your simulation rates have been updated to match <@${providedUser.id}>'s.`,
          embeds: [this.renderEmbed("", rates, true)],
        })
      }
    }
  }

  public async chatInputCopy(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const user = interaction.options.getUser("user")

    if (user) {
      const rateups = await Api.copyRateups(user.id, interaction.user.id)
      interaction.reply(this.renderCopy(rateups, user.id))
    } else {
      // Error
    }
  }

  public async chatInputReset(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    Api.removeRateups(interaction.user.id)

    await interaction.reply({
      content: `Your rateups were successfully reset`,
      ephemeral: true,
      fetchReply: true,
    })
  }

  // Methods: Rendering methods

  private renderShow(rates: ItemRateMap, userId: string, isSender: boolean) {
    let possessive: string
    let pronoun: string
    if (isSender) {
      possessive = "your"
      pronoun = "you don't"
    } else {
      possessive = `<@${userId}>'s`
      pronoun = `<@${userId}> doesn't`
    }

    // Create description strings based on the result of the query
    const description =
      rates.length === 0
        ? `It looks like ${pronoun} have any rateups right now.`
        : `These are ${possessive} current rates:`

    // Create components based on the result of the query
    const confirmButton = new ButtonBuilder()
      .setCustomId("copy")
      .setLabel("Copy rates")
      .setStyle(ButtonStyle.Primary)

    const components =
      rates.length > 0 && !isSender
        ? [{ type: ComponentType.ActionRow, components: [confirmButton] }]
        : []

    // Create embeds based on the result of the query
    const embeds = rates.length > 0 ? [this.renderEmbed(possessive, rates)] : []

    // Respond to the original request
    return {
      content: description,
      ephemeral: true,
      embeds: embeds,
      components: components,
    }
  }

  private renderCopy(rates: ItemRateMap, userId: string) {
    let possessive = `<@${userId}>'s`
    let pronoun: string = `<@${userId}> doesn't`

    // Create description strings based on the result of the query
    const description =
      rates.length === 0
        ? `It looks like ${pronoun} have any rateups right now.`
        : `Your simulation rates have been updated to match ${possessive}.`

    // Create embeds based on the result of the query
    const embeds = rates.length > 0 ? [this.renderEmbed("your", rates)] : []

    // Respond to the original request
    return {
      content: description,
      ephemeral: true,
      embeds: embeds,
    }
  }

  private renderEmbed(
    person: string,
    rates: ItemRateMap,
    updated: boolean = false
  ) {
    let details = "```html\n"
    rates.forEach((rate) => {
      details += `(${rate.rate}%) ${rate.item.name.en}\n`
    })
    details += "\n```"

    let description = updated
      ? `These rates only apply to your simulations:`
      : `These rates only apply to ${person} simulations:`
    return new EmbedBuilder()
      .setDescription(description)
      .addFields({ name: "Rates", value: details })
  }

  // Methods: Convenience methods

  collectorFilter = (
    i: MessageComponentInteraction,
    interaction: Subcommand.ChatInputCommandInteraction
  ) => {
    i.deferUpdate()
    return i.user.id === interaction.user.id
  }

  private getRates(interaction: Subcommand.ChatInputCommandInteraction) {
    let rates: RateMap = []

    for (let i = 0; i < NUM_MAX_RATEUPS; i++) {
      const identifier = interaction.options.getString(`item${i + 1}`)
      const rate = interaction.options.getString(`rate${i + 1}`)

      if (identifier && rate)
        rates.push({
          identifier: identifier,
          rate: parseFloat(rate),
        })
    }
    return rates
  }
}
