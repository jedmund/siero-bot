import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { isMessageInstance } from "@sapphire/discord.js-utilities"
import { config } from "dotenv"

import Gacha from "../services/gacha"
import Until from "../services/until"

import { Promotion, Season } from "../utils/enums"
import fetchRateups from "../utils/fetchRateups"
import { ItemRateMap } from "../utils/types"
import { RenderingUtils } from "../utils/rendering"

if (process.env.NODE_ENV !== "production") {
  config()
}

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
    {
      name: "until",
      chatInputRun: "chatInputUntil",
    },
  ],
})
export class GachaCommand extends Subcommand {
  rateups: ItemRateMap = []

  // Methods: Register application commands

  public override registerApplicationCommands(
    registry: Subcommand.Registry
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
                  .setRequired(true)
              )
              .addStringOption(this.promotionOption())
              .addStringOption(this.seasonOption())
              .addStringOption((option) =>
                option
                  .setName("currency")
                  .setDescription("The currency to see the damage in")
                  .addChoices(
                    { name: "USD", value: "usd" },
                    { name: "JPY", value: "jpy" }
                  )
              )
          })
      },
      {
        idHints: [COMMAND_ID],
      }
    )
  }

  // Methods: Subcommand and Option builders
  private gachaCommand(
    command: SlashCommandSubcommandBuilder,
    name: string,
    description: string
  ): SlashCommandSubcommandBuilder {
    return command
      .setName(name)
      .setDescription(description)
      .addStringOption(this.promotionOption())
      .addStringOption(this.seasonOption())
  }

  private promotionOption(): SlashCommandStringOption {
    const optionBuilder: SlashCommandStringOption =
      new SlashCommandStringOption()
        .setName("promotion")
        .setDescription(
          "The promotion to simulate (Premium, Classic, Flash, Legend)"
        )
        .addChoices(
          {
            name: "Premium (Default)",
            value: "premium",
          },
          {
            name: "Classic",
            value: "classic",
          },
          {
            name: "Flash Gala",
            value: "flash",
          },
          {
            name: "Legend Festival",
            value: "legend",
          }
        )

    return optionBuilder
  }

  private seasonOption(): SlashCommandStringOption {
    const optionBuilder = new SlashCommandStringOption()
      .setName("season")
      .setDescription(
        "The season to simulate (Normal, Valentines, Summer, Halloween, Holiday)"
      )
      .addChoices(
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
        }
      )

    return optionBuilder
  }

  // Methods: Instantiation

  private async createGacha(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<Gacha> {
    const promotion = this.getPromotion(
      interaction.options.getString("promotion")
    )
    const season = this.getSeason(interaction.options.getString("season"))

    this.rateups = await fetchRateups(interaction.user.id)
    return new Gacha(this.rateups, promotion, season)
  }

  // Methods: Slash Commands

  public async chatInputSingle(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await this.safeReply(
      interaction,
      "Simulating a single draw...",
      async () => {
        const gacha = await this.createGacha(interaction)
        const item = gacha.singleRoll()
        await interaction.editReply(RenderingUtils.renderItem(item))
      }
    )
  }

  public async chatInputTen(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await this.safeReply(
      interaction,
      "Simulating a ten-part draw...",
      async () => {
        const gacha = await this.createGacha(interaction)
        const result = gacha.tenPartRoll()
        await interaction.editReply(
          this.renderHtmlBlock(RenderingUtils.renderItems(result.items))
        )
      }
    )
  }

  public async chatInputSpark(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await this.safeReply(interaction, "Simulating a spark...", async () => {
      const promotion = this.getPromotion(
        interaction.options.getString("promotion")
      )
      const season = this.getSeason(interaction.options.getString("season"))

      const gacha = await this.createGacha(interaction)
      const result = gacha.spark()

      const sparkButton = new ButtonBuilder()
        .setCustomId(`copySpark:${interaction.user.id}:${promotion}:${season}`)
        .setLabel("Spark with these rates")
        .setStyle(ButtonStyle.Primary)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        sparkButton
      )
      const embed = RenderingUtils.renderSpark(result, this.rateups)

      await interaction.editReply({
        content: "This is your spark",
        embeds: [embed],
        components: [row],
      })
    })
  }

  public async chatInputUntil(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    const promotion = this.getPromotion(
      interaction.options.getString("promotion")
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
      season
    )
    await until.execute()
  }

  public async chatInputCopySpark(): Promise<void> {
    console.log("Copy and spark")
  }

  // Methods: Transformers

  private getPromotion(input: string | null): Promotion {
    switch (input) {
      case "classic":
        return Promotion.CLASSIC
      case "flash":
        return Promotion.FLASH
      case "legend":
        return Promotion.LEGEND
      default:
        return Promotion.PREMIUM
    }
  }

  private getSeason(input: string | null): Season | undefined {
    switch (input) {
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
    callback: () => Promise<unknown>
  ): Promise<void> {
    const msg = await interaction.reply({
      content: initialMessage,
      fetchReply: true,
    })

    try {
      if (isMessageInstance(msg)) {
        await callback()
      } else {
        await interaction.reply("There was an error")
      }
    } catch (error) {
      console.error("Error in command execution:", error)
      await interaction.editReply(
        "An error occurred while processing your request"
      )
    }
  }

  private renderHtmlBlock(content: string): string {
    return `\`\`\`html\n${content}\`\`\``
  }
}
