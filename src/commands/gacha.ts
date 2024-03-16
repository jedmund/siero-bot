import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { isMessageInstance } from "@sapphire/discord.js-utilities"

import Gacha from "../services/gacha"
import Until from "../services/until"

import { Promotion, Season } from "../utils/enums"
import fetchRateups from "../utils/fetchRateups"
import { ItemRateMap } from "../utils/types"
import { RenderingUtils } from "../utils/rendering"

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const COMMAND_ID =
  process.env.NODE_ENV === "production"
    ? "1110727170604679258"
    : "1102647266973581312"

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

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        builder //
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
  ) {
    return command
      .setName(name)
      .setDescription(description)
      .addStringOption(this.promotionOption())
      .addStringOption(this.seasonOption())
  }

  private promotionOption() {
    let optionBuilder: SlashCommandStringOption = new SlashCommandStringOption()
    optionBuilder.setName("promotion")
    optionBuilder.setDescription(
      "The promotion to simulate (Premium, Classic, Flash, Legend)"
    )
    optionBuilder.addChoices(
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

  private seasonOption() {
    let optionBuilder: SlashCommandStringOption = new SlashCommandStringOption()
    optionBuilder.setName("season")
    optionBuilder.setDescription(
      "The season to simulate (Normal, Valentines, Summer, Halloween, Holiday"
    )
    optionBuilder.addChoices(
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
  ) {
    // prettier-ignore
    const promotion = this.getPromotion(interaction.options.getString("promotion"))
    const season = this.getSeason(interaction.options.getString("season"))

    this.rateups = await fetchRateups(interaction.user.id)
    return new Gacha(this.rateups, promotion, season)
  }

  // Methods: Slash Commands

  public async chatInputSingle(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const msg = await interaction.reply({
      content: `Simulating a single draw...`,
      fetchReply: true,
    })

    const gacha = await this.createGacha(interaction)
    const item = gacha.singleRoll()

    if (isMessageInstance(msg)) {
      return interaction.editReply(RenderingUtils.renderItem(item))
    } else {
      return interaction.reply("There was an error")
    }
  }

  public async chatInputTen(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const msg = await interaction.reply({
      content: `Simulating a ten-part draw...`,
      fetchReply: true,
    })

    const gacha = await this.createGacha(interaction)
    const result = gacha.tenPartRoll()

    if (isMessageInstance(msg)) {
      return interaction.editReply(
        `\`\`\`html\n${RenderingUtils.renderItems(result.items)}\`\`\``
      )
    } else {
      return interaction.reply("There was an error")
    }
  }

  public async chatInputSpark(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const msg = await interaction.reply({
      content: `Simulating a spark...`,
      fetchReply: true,
    })

    const promotion =
      this.getPromotion(interaction.options.getString("promotion")) || "premium"
    const season = this.getSeason(interaction.options.getString("season")) || ""

    const gacha = await this.createGacha(interaction)
    const result = gacha.spark()

    const sparkButton = new ButtonBuilder()
      .setCustomId(`copySpark:${interaction.user.id}:${promotion}:${season}`)
      .setLabel("Spark with these rates")
      .setStyle(ButtonStyle.Primary)

    const components = [
      { type: ComponentType.ActionRow, components: [sparkButton] },
    ]

    if (isMessageInstance(msg)) {
      let embed = RenderingUtils.renderSpark(result, this.rateups)
      return interaction.editReply({
        content: `This is your spark`,
        embeds: [embed],
        components: components,
      })
    } else {
      return interaction.reply("There was an error")
    }
  }

  public async chatInputCopySpark() {
    console.log("Copy and spark")
  }

  public async chatInputUntil(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    // prettier-ignore
    const promotion = this.getPromotion(interaction.options.getString("promotion"))
    const season = this.getSeason(interaction.options.getString("season"))
    const identifier = interaction.options.getString("name")
    const currency = interaction.options.getString("currency") || "usd"

    await interaction.reply({
      content: `Simulating the gacha until \`${identifier}\` is drawn...`,
      fetchReply: true,
    })

    if (identifier) {
      const until = new Until(
        interaction,
        identifier,
        currency,
        promotion,
        season
      )
      await until.execute()
    }
  }

  // Methods: Transformers

  private getPromotion(input: string | null) {
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

  private getSeason(input: string | null) {
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
}
