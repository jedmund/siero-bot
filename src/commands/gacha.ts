import {
  EmbedBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { isMessageInstance } from "@sapphire/discord.js-utilities"

import Gacha from "../services/gacha"
import Until from "../services/until"

import { readableRarity } from "../utils/readable"
import { DrawableItemType, Promotion, Rarity, Season } from "../utils/enums"

import type DrawableItem from "../interfaces/DrawableItem"
import type SparkResult from "../interfaces/SparkResult"
import fetchRateups from "../utils/fetchRateups"
import { ItemRateMap } from "../utils/types"

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
      return interaction.editReply(this.renderItem(item))
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
        `\`\`\`html\n${this.renderItems(result.items)}\`\`\``
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

    const gacha = await this.createGacha(interaction)
    const result = gacha.spark()

    if (isMessageInstance(msg)) {
      let embed = this.renderSpark(result)
      return interaction.editReply({
        content: `This is your spark`,
        embeds: [embed],
      })
    } else {
      return interaction.reply("There was an error")
    }
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

  // Methods: Rendering

  private renderItems(results: DrawableItem[]) {
    let characterWeapons = this.sortCharacterWeapons(results)
    var gachaItems = results
      .filter((x) => !characterWeapons.includes(x))
      .concat(characterWeapons.filter((x) => !results.includes(x)))

    let items = this.shuffle(gachaItems).concat(characterWeapons)

    var string = ""
    for (var item in items) {
      string += this.renderItem(items[item], true)
    }

    return string
  }

  private renderSpark(results: SparkResult) {
    let rate = Math.floor((results.count.SSR / 300) * 100)
    let summary = `\`\`\`${this.renderSummary(results)}\`\`\``

    var details = "```html\n"
    results.items.forEach((item: DrawableItem) => {
      details += this.renderItem(item, true)
    })
    details += "\n```"

    return new EmbedBuilder()
      .setDescription(details)
      .addFields(
        { name: "Summary", value: summary },
        { name: "Rate", value: `Your SSR rate is **${rate}%**` }
      )
  }

  private renderItem(result: DrawableItem, combined: boolean = false) {
    let rarity: string = readableRarity(result.rarity)

    if (result.name && result.recruits) {
      var response = `<${rarity}> ${
        result.name.en
      } – You recruited ${result.recruits.name.en.trim()}!`
    } else if (
      result.name &&
      !result.recruits &&
      result.item_type == DrawableItemType.SUMMON
    ) {
      var response = `<${rarity} Summon> ${result.name.en}`
    } else {
      var response = `<${rarity}> ${result.name.en}`
    }

    return !combined ? `\`\`\`html\n${response}\n\`\`\`` : `${response}\n`
  }

  private renderSummary(results: SparkResult) {
    let ssrWeapons = results.items.filter(this.filterSSRWeapons)
    let ssrSummons = results.items.filter(this.filterSSRSummons)
    let numRateupItems = this.filterRateUpItems(results)

    // TODO: Extract into helper method
    // let targetsAcquired = results.items.filter((item: Item) => {
    //   if (this.sparkTarget != null) {
    //     return (
    //       item.name == this.sparkTarget.name ||
    //       (item.recruits != null && item.recruits == this.sparkTarget.recruits)
    //     )
    //   } else {
    //     return null
    //   }
    // })

    // let targetAcquiredString = ""
    // if (targetsAcquired != null) {
    //   targetAcquiredString =
    //     targetsAcquired.length > 0
    //       ? `You got your spark target! (${targetsAcquired.length})`
    //       : ""
    // }

    return [
      // targetAcquiredString,
      this.rateups.length > 0 ? `Rate-up Items: ${numRateupItems}` : "",
      `SSR Weapons: ${ssrWeapons.length}`,
      `SSR Summons: ${ssrSummons.length}`,
      `SR: ${results.count.SR}`,
      `R: ${results.count.R}`,
    ].join("\n")
  }

  // Methods: Filtering and sorting

  private filterSSRWeapons(item: DrawableItem) {
    return item.rarity == Rarity.SSR && item.type === DrawableItemType.WEAPON
  }

  private filterSSRSummons(item: DrawableItem) {
    return item.rarity == Rarity.SSR && item.type === DrawableItemType.SUMMON
  }

  private filterRateUpItems(spark: SparkResult) {
    let totalCount = 0
    for (let i in this.rateups) {
      let rateupItem: DrawableItem = this.rateups[i].item
      totalCount += spark.items.reduce((n: number, item: DrawableItem) => {
        return n + (rateupItem.id == item.id ? 1 : 0)
      }, 0)
    }
    return totalCount
  }

  private sortCharacterWeapons(results: DrawableItem[]) {
    let weapons: DrawableItem[] = []

    results.forEach((item: DrawableItem) => {
      let hasPlacedSR = false
      let lastSRPos = 0
      let placedSSRCount = 0

      if (item.recruits) {
        // If an R is drawn, put it at the front of the list.
        if (item.rarity == Rarity.R) {
          weapons.unshift(item)
          lastSRPos = !hasPlacedSR ? weapons.length : lastSRPos
        }

        // If an SR is drawn, put it at the last SR position,
        // then record a new position.
        if (item.rarity == Rarity.SR) {
          weapons.splice(lastSRPos, 0, item)
          hasPlacedSR = !hasPlacedSR ? true : false
        }

        // If an SSR is drawn, put it at the end of the list.
        if (item.rarity == Rarity.SSR) {
          weapons.push(item)

          if (!hasPlacedSR) {
            placedSSRCount += 1
            lastSRPos = weapons.length - placedSSRCount
          }
        }
      }
    })

    return weapons
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

  // Methods: Convenience methods

  // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  private shuffle(array: DrawableItem[]) {
    var currentIndex = array.length,
      temporaryValue,
      randomIndex

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex -= 1

      // And swap it with the current element.
      temporaryValue = array[currentIndex]
      array[currentIndex] = array[randomIndex]
      array[randomIndex] = temporaryValue
    }

    return array
  }
}
