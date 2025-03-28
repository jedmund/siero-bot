import {
  ActionRowBuilder,
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
import { config } from "dotenv"

import type { ItemRateMap, RateMap } from "../utils/types"
import Rateup from "../services/rateup"
import Api from "../services/api"

if (process.env.NODE_ENV !== "production") {
  config()
}

const COMMAND_ID = process.env.RATEUP_COMMAND_ID ?? ""

const NUM_MAX_RATEUPS = 12
const COMPONENT_TIMEOUT = 300000 // 5 minutes in milliseconds
const MIN_RATE = 0.0001 // Minimum rate value (0.01%)
const MAX_RATE = 100.0 // Maximum rate value (100.0%)

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
              const required = i === 0 ? true : false
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
        idHints: [COMMAND_ID],
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

  private rateupItemOption(
    number: number,
    required: boolean = false
  ): SlashCommandStringOption {
    const optionBuilder = new SlashCommandStringOption()
      .setName(`item${number}`)
      .setDescription("The name or Granblue ID of the item to rateup")
      .setRequired(required)

    return optionBuilder
  }

  private rateupRateOption(
    number: number,
    required: boolean = false
  ): SlashCommandStringOption {
    const optionBuilder = new SlashCommandStringOption()
      .setName(`rate${number}`)
      .setDescription("The appearance rate of the item (in decimals)")
      .setRequired(required)

    return optionBuilder
  }

  // Methods: Slash Commands

  public async chatInputSet(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    try {
      const rates = this.getRates(interaction)

      // Validate rates
      const validationError = this.validateRates(rates)
      if (validationError) {
        await interaction.reply({
          content: validationError,
          ephemeral: true,
        })
        return
      }

      const rateup = new Rateup(interaction, rates)
      await rateup.execute()
    } catch (error) {
      console.error("Error in chatInputSet:", error)
      await this.handleCommandError(interaction, "setting rate-up values")
    }
  }

  public async chatInputShow(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    try {
      // Extract the user from the interaction and store
      // whether we are fetching rateups for the sender or someone else
      const providedUser = interaction.options.getUser("user")
      const userId = this.resolveUserId(interaction, providedUser)

      // Fetch the appropriate rates and render them to the user
      const rates = await Api.fetchRateups(userId)
      const message = await interaction.reply(
        this.renderShow(rates, userId, providedUser === null)
      )

      // If we rendered a button, wait for the message component
      // and handle the result
      if (providedUser !== null && rates.length > 0) {
        await this.handleRateCopyResponse(
          interaction,
          message,
          providedUser,
          rates
        )
      }
    } catch (error) {
      console.error("Error in chatInputShow:", error)
      await this.handleCommandError(interaction, "showing rate-up values")
    }
  }

  public async chatInputCopy(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    try {
      const user = interaction.options.getUser("user")

      if (!user) {
        await interaction.reply({
          content: "Please provide a valid user to copy rates from.",
          ephemeral: true,
        })
        return
      }

      const rateups = await Api.copyRateups(user.id, interaction.user.id)
      interaction.reply(this.renderCopy(rateups, user.id))
    } catch (error) {
      console.error("Error in chatInputCopy:", error)
      await this.handleCommandError(interaction, "copying rate-up values")
    }
  }

  public async chatInputReset(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    try {
      Api.removeRateups(interaction.user.id)

      await interaction.reply({
        content: `Your rateups were successfully reset`,
        ephemeral: true,
        fetchReply: true,
      })
    } catch (error) {
      console.error("Error in chatInputReset:", error)
      await this.handleCommandError(interaction, "resetting rate-up values")
    }
  }

  // Methods: Rendering methods

  private renderShow(rates: ItemRateMap, userId: string, isSender: boolean) {
    const { possessive, pronoun } = this.getPossessiveAndPronoun(
      userId,
      isSender
    )

    // Create description strings based on the result of the query
    const description =
      rates.length === 0
        ? `It looks like ${pronoun} have any rateups right now.`
        : `These are ${possessive} current rates:`

    // Create components based on the result of the query
    const components = this.getCopyComponents(rates, isSender)

    // Create embeds based on the result of the query
    const embeds = rates.length > 0 ? [this.renderEmbed(possessive, rates)] : []

    // Respond to the original request
    return {
      content: description,
      ephemeral: false,
      embeds: embeds,
      components: components,
    }
  }

  private renderCopy(rates: ItemRateMap, userId: string) {
    const possessive = `<@${userId}>'s`
    const pronoun: string = `<@${userId}> doesn't`

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
      ephemeral: false,
      embeds: embeds,
    }
  }

  private renderEmbed(person: string, rates: ItemRateMap, updated = false) {
    let details = ""
    rates.forEach((rate) => {
      details += `(${rate.rate}%) ${rate.item.name.en}\n`
    })

    const description = updated
      ? "These rates only apply to your simulations:"
      : `These rates only apply to ${person} simulations:`

    return new EmbedBuilder()
      .setDescription(description)
      .addFields({ name: "Rates", value: this.renderHtmlBlock(details) })
  }

  // Methods: UI Helpers

  private getPossessiveAndPronoun(userId: string, isSender: boolean) {
    if (isSender) {
      return { possessive: "your", pronoun: "you don't" }
    } else {
      return { possessive: `<@${userId}>'s`, pronoun: `<@${userId}> doesn't` }
    }
  }

  private getCopyComponents(rates: ItemRateMap, isSender: boolean) {
    if (rates.length > 0 && !isSender) {
      const confirmButton = new ButtonBuilder()
        .setCustomId("copy")
        .setLabel("Copy rates")
        .setStyle(ButtonStyle.Primary)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton
      )
      return [row]
    }
    return []
  }

  // Methods: Convenience methods

  private collectorFilter = (
    i: MessageComponentInteraction,
    interaction: Subcommand.ChatInputCommandInteraction
  ) => {
    i.deferUpdate()
    return i.user.id === interaction.user.id
  }

  private getRates(interaction: Subcommand.ChatInputCommandInteraction) {
    const rates: RateMap = []

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

  private renderHtmlBlock(content: string): string {
    return `\`\`\`html\n${content}\`\`\``
  }

  // Methods: Helper methods

  private async handleRateCopyResponse(
    interaction: Subcommand.ChatInputCommandInteraction,
    message: any,
    providedUser: any,
    rates: ItemRateMap
  ) {
    try {
      const response = await message.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) =>
          this.collectorFilter(i, interaction),
        componentType: ComponentType.Button,
        time: COMPONENT_TIMEOUT,
      })

      if (response.isButton()) {
        await Api.removeRateups(interaction.user.id)
        await Api.addRateups(interaction.user.id, rates)

        await message.edit({
          content: `Your simulation rates have been updated to match <@${providedUser.id}>'s.`,
          embeds: [this.renderEmbed("", rates, true)],
          components: [],
        })
      }
    } catch (error) {
      // Handle timeout or other errors with interaction
      if (error instanceof Error && error.message.includes("time")) {
        // Button timeout - remove components to indicate expiration
        await message
          .edit({
            components: [],
            content: message.content + "\n*Button has expired*",
          })
          .catch(() => {
            // Message may have been deleted, ignore errors
          })
      } else {
        console.error("Error in handleRateCopyResponse:", error)
      }
    }
  }

  private async handleCommandError(
    interaction: Subcommand.ChatInputCommandInteraction,
    action: string
  ) {
    if (interaction.replied || interaction.deferred) {
      await interaction
        .editReply({
          content: `There was an error while ${action}. Please try again later.`,
        })
        .catch(() => {
          // Interaction may have expired
        })
    } else {
      await interaction
        .reply({
          content: `There was an error while ${action}. Please try again later.`,
          ephemeral: true,
        })
        .catch(() => {
          // Interaction may have expired
        })
    }
  }

  private resolveUserId(
    interaction: Subcommand.ChatInputCommandInteraction,
    providedUser: any
  ): string {
    return providedUser === null ? interaction.user.id : providedUser.id
  }

  private validateRates(rates: RateMap): string | null {
    // Check if any rates are provided
    if (rates.length === 0) {
      return "You must provide at least one item and rate."
    }

    // Validate each rate
    let totalRate = 0
    for (const rate of rates) {
      if (isNaN(rate.rate)) {
        return `Invalid rate format for "${rate.identifier}". Must be a decimal number.`
      }

      if (rate.rate < MIN_RATE) {
        return `Rate for "${rate.identifier}" is too low. Minimum is ${MIN_RATE}%.`
      }

      if (rate.rate > MAX_RATE) {
        return `Rate for "${rate.identifier}" is too high. Maximum is ${MAX_RATE}%.`
      }

      totalRate += rate.rate
    }

    // Check total rate
    if (totalRate > MAX_RATE) {
      return `Total rate (${totalRate}%) exceeds maximum allowed (${MAX_RATE}%).`
    }

    return null // No validation errors
  }
}
