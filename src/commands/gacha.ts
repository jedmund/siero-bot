import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { acknowledge } from "../services/interaction.js"

import Gacha, { SimulationValidationError } from "../services/gacha.js"
import { GachaApiError } from "../services/gachaClient.js"
import Until from "../services/until.js"

import { Promotion, Season } from "../utils/enums.js"
import fetchRateups from "../utils/fetchRateups.js"
import { ItemRateMap } from "../utils/types.js"
import { RenderingUtils } from "../utils/rendering.js"
import { renderHtmlBlock } from "../utils/formatting.js"

const COMMAND_ID = process.env.GACHA_COMMAND_ID ?? ""
@ApplyOptions<Subcommand.Options>({
  description: "Simulate the gacha",
  subcommands: [
    {
      name: "yolo",
      chatInputRun: "chatInputSingle",
      default: true,
    },
    {
      name: "ten",
      chatInputRun: "chatInputTen",
    },
    {
      name: "spark",
      chatInputRun: "chatInputSpark",
    },
    { name: "odds", chatInputRun: "chatInputOdds" },
    {
      name: "until",
      chatInputRun: "chatInputUntil",
    },
  ],
})
export class GachaCommand extends Subcommand {
  // Methods: Register application commands

  public override registerApplicationCommands(
    registry: Subcommand.Registry,
  ): void {
    registry.registerChatInputCommand(
      (builder) => {
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((command) => {
            const description = "Simulate a single gacha draw."
            return this.gachaCommand(command, "yolo", description)
          })
          .addSubcommand((command) => {
            const description = "Simulate a ten-part gacha draw."
            return this.gachaCommand(command, "ten", description)
          })
          .addSubcommand((command) => {
            const description =
              "Simulate a full spark of 30 ten-part gacha draws."
            return this.gachaCommand(command, "spark", description)
          })
          .addSubcommand((command) => {
            const description =
              "Simulate the gacha until a specific item is drawn."
            return command
              .setName("until")
              .setDescription(description)
              .addStringOption((option) =>
                option
                  .setName("name")
                  .setDescription("The name of the item or its Granblue ID")
                  .setRequired(true),
              )
              .addIntegerOption((option) =>
                option
                  .setName("copies")
                  .setDescription("Requested copies (default 1)")
                  .setMinValue(1)
                  .setMaxValue(1000),
              )
              .addStringOption((option) => this.promotionOption(option))
              .addStringOption((option) => this.seasonOption(option))
              .addStringOption((option) =>
                option
                  .setName("currency")
                  .setDescription("The currency to see the damage in")
                  .addChoices(
                    { name: "USD", value: "usd" },
                    { name: "JPY", value: "jpy" },
                  ),
              )
          })
          .addSubcommand((command) =>
            command
              .setName("odds")
              .setDescription("Analytical odds for natural drops")
              .addStringOption((option) =>
                option
                  .setName("name")
                  .setDescription("Item name or Granblue ID")
                  .setRequired(true),
              )
              .addIntegerOption((option) =>
                option
                  .setName("copies")
                  .setDescription("Requested copies (default 1)")
                  .setMinValue(1)
                  .setMaxValue(1000),
              )
              .addIntegerOption((option) =>
                option
                  .setName("draws")
                  .setDescription("Draw count, multiple of ten")
                  .setMinValue(10)
                  .setMaxValue(1000000000000),
              )
              .addStringOption((option) =>
                option
                  .setName("comparison")
                  .setDescription("Comparison")
                  .addChoices(
                    { name: "At least", value: "at_least" },
                    { name: "Exactly", value: "exactly" },
                  ),
              )
              .addStringOption((option) => this.promotionOption(option))
              .addStringOption((option) => this.seasonOption(option)),
          )
      },
      {
        idHints: [COMMAND_ID],
      },
    )
  }

  // Methods: Subcommand and Option builders
  private gachaCommand(
    command: SlashCommandSubcommandBuilder,
    name: string,
    description: string,
  ): SlashCommandSubcommandBuilder {
    return command
      .setName(name)
      .setDescription(description)
      .addStringOption((option) => this.promotionOption(option))
      .addStringOption((option) => this.seasonOption(option))
  }

  private promotionOption(option: SlashCommandStringOption): SlashCommandStringOption {
    const optionBuilder: SlashCommandStringOption =
      option
        .setName("promotion")
        .setDescription(
          "The promotion to simulate (Premium, Classic I/II/III, Flash, Legend)",
        )
        .addChoices(
          {
            name: "Premium (Default)",
            value: "premium",
          },
          {
            name: "Classic I",
            value: "classic",
          },
          { name: "Classic II", value: "classic_ii" },
          { name: "Classic III", value: "classic_iii" },
          {
            name: "Flash Gala",
            value: "flash",
          },
          {
            name: "Legend Festival",
            value: "legend",
          },
        )

    return optionBuilder
  }

  private seasonOption(option: SlashCommandStringOption): SlashCommandStringOption {
    const optionBuilder = option
      .setName("season")
      .setDescription(
        "The season to simulate (Normal, Valentines, Summer, Halloween, Holiday)",
      )
      .addChoices(
        { name: "Formal", value: "formal" },
        {
          name: "None (Default)",
          value: "none",
        },
        {
          name: "Valentines",
          value: "valentines",
        },
        {
          name: "Summer",
          value: "summer",
        },
        {
          name: "Halloween",
          value: "halloween",
        },
        {
          name: "Holiday",
          value: "holiday",
        },
      )

    return optionBuilder
  }

  // Methods: Instantiation

  private async createGacha(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<Gacha> {
    const promotion = this.getPromotion(
      interaction.options.getString("promotion"),
    )
    const season = this.getSeason(interaction.options.getString("season"))

    const rateups: ItemRateMap = await fetchRateups(interaction.user.id)
    return await Gacha.create(rateups, promotion, season)
  }

  // Methods: Slash Commands

  public async chatInputSingle(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    await this.safeReply(
      interaction,
      "Simulating a single draw...",
      async () => {
        const gacha = await this.createGacha(interaction)
        const item = await gacha.singleRoll()
        await interaction.editReply(
          `${RenderingUtils.renderItem(item)}\n${RenderingUtils.simulationNotice}`,
        )
      },
    )
  }

  public async chatInputTen(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    await this.safeReply(
      interaction,
      "Simulating a ten-part draw...",
      async () => {
        const gacha = await this.createGacha(interaction)
        const result = await gacha.tenPartRoll()
        await interaction.editReply(
          `${renderHtmlBlock(RenderingUtils.renderItems(result.items))}\n${RenderingUtils.simulationNotice}`,
        )
      },
    )
  }

  public async chatInputSpark(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    await this.safeReply(interaction, "Simulating a spark...", async () => {
      const promotion = this.getPromotion(
        interaction.options.getString("promotion"),
      )
      const season = this.getSeason(interaction.options.getString("season"))

      const gacha = await this.createGacha(interaction)
      const result = await gacha.spark()

      const sparkButton = new ButtonBuilder()
        .setCustomId(`copySpark:${interaction.user.id}:${promotion}:${season}`)
        .setLabel("Spark using current source rates")
        .setStyle(ButtonStyle.Primary)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        sparkButton,
      )
      const embed = RenderingUtils.renderSpark(result, gacha.rateups)

      await interaction.editReply({
        content: "This is your spark",
        embeds: [embed],
        components: [row],
      })
    })
  }

  public async chatInputUntil(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    const promotion = this.getPromotion(
      interaction.options.getString("promotion"),
    )
    const season = this.getSeason(interaction.options.getString("season"))
    const identifier = interaction.options.getString("name")
    const currency = interaction.options.getString("currency") ?? "usd"

    if (!identifier) {
      await interaction.reply({
        content: "Please provide an item name or ID",
        ephemeral: true,
      })
      return
    }

    await interaction.reply({
      content: `Simulating the gacha until \`${identifier}\` is drawn...`,
      fetchReply: true,
    })

    const until = new Until(
      interaction,
      identifier,
      currency,
      promotion,
      season,
      interaction.options.getInteger("copies") ?? 1,
      interaction.options.getSubcommand() === "odds" ? "odds" : "until",
      interaction.options.getInteger("draws") ?? 300,
      interaction.options.getString("comparison") ?? "at_least",
    )
    try {
      await until.execute()
    } catch (error) {
      console.error("Until command failed", error)
      await interaction.editReply(
        error instanceof GachaApiError
          ? error.message
          : "An error occurred while processing your request",
      )
    }
  }

  public async chatInputOdds(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await this.chatInputUntil(interaction)
  }

  // Methods: Transformers

  private getPromotion(input: string | null): Promotion {
    switch (input) {
      case "classic":
        return Promotion.CLASSIC
      case "classic_ii":
        return Promotion.CLASSIC_II
      case "classic_iii":
        return Promotion.CLASSIC_III
      case "flash":
        return Promotion.FLASH
      case "legend":
        return Promotion.LEGEND
      case null:
      case "premium":
        return Promotion.PREMIUM
      default:
        throw new Error(`Unsupported promotion: ${input}`)
    }
  }

  private getSeason(input: string | null): Season | undefined {
    switch (input) {
      case "formal":
        return Season.FORMAL
      case "valentines":
        return Season.VALENTINES
      case "summer":
        return Season.SUMMER
      case "halloween":
        return Season.HALLOWEEN
      case "holiday":
        return Season.HOLIDAY
      default:
        return undefined
    }
  }

  // Methods: Helpers

  private async safeReply(
    interaction: Subcommand.ChatInputCommandInteraction,
    initialMessage: string,
    callback: () => Promise<unknown>,
  ): Promise<void> {
    await acknowledge(interaction)
    await interaction.editReply(initialMessage)

    try {
      await callback()
    } catch (error) {
      console.error("Error in command execution:", error)
      await interaction.editReply(
        error instanceof SimulationValidationError ||
          error instanceof GachaApiError
          ? error.message
          : "An error occurred while processing your request",
      )
    }
  }
}
