import { EmbedBuilder, SlashCommandSubcommandBuilder, User } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { config } from "dotenv"
import pluralize from "pluralize"

import Api from "../services/api"
import Leaderboard from "../services/leaderboard"

if (process.env.NODE_ENV !== "production") {
  config()
}

const COMMAND_ID =
  process.env.NODE_ENV === "production"
    ? "1110727196584202361"
    : "1103831182728232960"

const DRAWS_PER_SPARK = 300
const CRYSTALS_PER_TICKET = 300
const CRYSTALS_PER_TEN_TICKET = 3000

type SparkCurrencies = {
  crystals?: number
  tickets?: number
  ten_tickets?: number
}

type SparkType = {
  crystals: number
  tickets: number
  ten_tickets: number
}

@ApplyOptions<Subcommand.Options>({
  description: "Keep track of your spark progress",
  subcommands: [
    { name: "add", chatInputRun: "chatInputAdd" },
    { name: "remove", chatInputRun: "chatInputRemove" },
    {
      name: "update",
      chatInputRun: "chatInputUpdate",
    },
    {
      name: "progress",
      chatInputRun: "chatInputProgress",
      default: true,
    },
    { name: "leaderboard", chatInputRun: "chatInputLeaderboard" },
    {
      name: "reset",
      chatInputRun: "chatInputReset",
    },
  ],
})
export class SparkCommand extends Subcommand {
  // Methods: Register application commands

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((command) => {
            const description = "Add currency to your spark progress"
            return this.addSparkOptions(
              this.sparkCommand(command, "add", description),
              "to add"
            )
          })
          .addSubcommand((command) => {
            const description = "Remove currency from your spark progress"
            return this.addSparkOptions(
              this.sparkCommand(command, "remove", description),
              "to remove"
            )
          })
          .addSubcommand((command) => {
            const description = "Update your spark progress"
            return this.addSparkOptions(
              this.sparkCommand(command, "update", description),
              "you have"
            )
          })
          .addSubcommand((command) => {
            const description =
              "Show your current spark progress or someone else's"
            return this.sparkCommand(
              command,
              "progress",
              description
            ).addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user whose spark progress you want to see")
            )
          })
          .addSubcommand((command) => {
            const description = "Reset your spark progress"
            return this.sparkCommand(command, "reset", description)
          })
          .addSubcommand((command) => {
            const description = "Show the spark leaderboard"
            return this.sparkCommand(command, "leaderboard", description)
          })
      },
      {
        idHints: [COMMAND_ID],
      }
    )
  }

  // Methods: Subcommand and Option builders

  private sparkCommand(
    command: SlashCommandSubcommandBuilder,
    name: string,
    description: string
  ) {
    return command.setName(name).setDescription(description)
  }

  private addSparkOptions(
    command: SlashCommandSubcommandBuilder,
    actionString: string
  ) {
    return command
      .addStringOption((option) =>
        option
          .setName("crystals")
          .setDescription(`The amount of crystals ${actionString}`)
      )
      .addStringOption((option) =>
        option
          .setName("tickets")
          .setDescription(`The amount of single draw tickets ${actionString}`)
      )
      .addStringOption((option) =>
        option
          .setName("ten_tickets")
          .setDescription(`The amount of ten-part draw tickets ${actionString}`)
      )
  }

  // Methods: Command Handlers

  public async chatInputAdd(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await this.chatInputArithmetic(interaction, "+")
  }

  public async chatInputRemove(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await this.chatInputArithmetic(interaction, "-")
  }

  private async chatInputArithmetic(
    interaction: Subcommand.ChatInputCommandInteraction,
    operation: "+" | "-"
  ): Promise<void> {
    const currentProgress = await Api.fetchSpark(interaction.user.id)
    const inputCurrencies = this.getCurrencies(interaction)

    // Calculate new values
    const progress = this.calculateNewValues(
      currentProgress?.spark,
      inputCurrencies,
      operation
    )

    // Update spark data
    const progressResponse = await this.updateSparkData(
      interaction.user.id,
      progress,
      currentProgress?.guildIds,
      interaction.guild?.id
    )

    if (progressResponse) {
      await this.replyWithSparkUpdate(
        interaction,
        currentProgress?.spark,
        progressResponse
      )
    }
  }

  public async chatInputUpdate(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    const currentProgress = await Api.fetchSpark(interaction.user.id)
    const updatedProgress = this.getCurrencies(interaction)

    // Update spark data (direct replacement, not arithmetic)
    const progressResponse = await this.updateSparkData(
      interaction.user.id,
      updatedProgress,
      currentProgress?.guildIds,
      interaction.guild?.id
    )

    if (progressResponse) {
      await this.replyWithSparkUpdate(
        interaction,
        currentProgress?.spark,
        progressResponse
      )
    }
  }

  public async chatInputProgress(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    const providedUser = interaction.options.getUser("user")
    const user = providedUser ?? interaction.user
    const isSelf = providedUser === null

    const progress = await Api.fetchSpark(user.id)

    await interaction.reply({
      content: this.formatDescription(user, isSelf, progress !== undefined),
      embeds: progress ? [this.generateEmbed(user, progress.spark)] : [],
      fetchReply: true,
    })
  }

  public async chatInputLeaderboard(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    if (!interaction.channel) {
      await interaction.reply({
        content:
          "Sorry, I can't show leaderboards in direct messages. Please send the command from a server that we're both in!",
        ephemeral: true,
      })
      return
    }

    const guild = interaction.guild
    if (!guild) return

    const leaderboard = new Leaderboard(guild.id, "desc")
    const embed = await leaderboard.execute()

    await interaction.reply({
      content: `Here is the current leaderboard for ${guild.name}:`,
      embeds: [embed],
    })
  }

  public async chatInputReset(
    interaction: Subcommand.ChatInputCommandInteraction
  ): Promise<void> {
    await Api.resetSpark(interaction.user.id)

    await interaction.reply({
      content: "Your spark was successfully reset",
      ephemeral: true,
    })
  }

  // Methods: Data Processing

  private calculateNewValues(
    current: Spark | undefined,
    input: SparkCurrencies,
    operation: "+" | "-"
  ): SparkCurrencies {
    const progress: SparkCurrencies = {}
    const defaultSpark: SparkType = { crystals: 0, tickets: 0, ten_tickets: 0 }
    const currentValues = current ?? defaultSpark

    // Process each currency with type-safe approach
    if ("crystals" in input && input.crystals !== undefined) {
      progress.crystals =
        operation === "+"
          ? currentValues.crystals + input.crystals
          : Math.max(currentValues.crystals - input.crystals, 0)
    }

    if ("tickets" in input && input.tickets !== undefined) {
      progress.tickets =
        operation === "+"
          ? currentValues.tickets + input.tickets
          : Math.max(currentValues.tickets - input.tickets, 0)
    }

    if ("ten_tickets" in input && input.ten_tickets !== undefined) {
      progress.ten_tickets =
        operation === "+"
          ? currentValues.ten_tickets + input.ten_tickets
          : Math.max(currentValues.ten_tickets - input.ten_tickets, 0)
    }

    return progress
  }

  private async updateSparkData(
    userId: string,
    progress: SparkCurrencies,
    currentGuildIds: string[] = [],
    guildId?: string
  ): Promise<Spark | undefined> {
    return await Api.updateSpark({
      userId,
      guildIds: this.updateGuildIds(currentGuildIds, guildId),
      ...progress,
    })
  }

  private calculateDifference(previous: Spark, current: Spark): Spark {
    return {
      crystals: current.crystals - previous.crystals,
      tickets: current.tickets - previous.tickets,
      ten_tickets: current.ten_tickets - previous.ten_tickets,
    }
  }

  private calculateDraws(spark: Spark): number {
    const ticketValue = spark.tickets * CRYSTALS_PER_TICKET
    const tenTicketValue = spark.ten_tickets * CRYSTALS_PER_TEN_TICKET
    const totalCrystalValue = spark.crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / CRYSTALS_PER_TICKET)
  }

  private getCurrencies(
    interaction: Subcommand.ChatInputCommandInteraction
  ): SparkCurrencies {
    const progress: SparkCurrencies = {}

    const crystals = interaction.options.getString("crystals")
    if (crystals) progress.crystals = parseInt(crystals)

    const tickets = interaction.options.getString("tickets")
    if (tickets) progress.tickets = parseInt(tickets)

    const tenTickets = interaction.options.getString("ten_tickets")
    if (tenTickets) progress.ten_tickets = parseInt(tenTickets)

    return progress
  }

  private updateGuildIds(
    currentGuildIds: string[],
    guildId?: string
  ): string[] {
    if (!guildId || currentGuildIds.includes(guildId)) {
      return currentGuildIds
    }

    return [guildId, ...currentGuildIds]
  }

  // Methods: Response Generation

  private async replyWithSparkUpdate(
    interaction: Subcommand.ChatInputCommandInteraction,
    previousSpark: Spark | undefined,
    currentSpark: Spark
  ): Promise<void> {
    const defaultSpark = { crystals: 0, tickets: 0, ten_tickets: 0 }
    const previousValues = previousSpark ?? defaultSpark

    const difference = this.calculateDifference(previousValues, currentSpark)
    const differenceString = this.formatDifference(difference)

    await interaction.reply(
      this.generateResponseBlock(
        interaction.user,
        currentSpark,
        differenceString
      )
    )
  }

  private generateResponseBlock(
    user: User,
    spark: Spark,
    differenceString?: string
  ) {
    return {
      content: `Your spark has been updated! ${differenceString ?? ""}`,
      embeds: [this.generateEmbed(user, spark)],
      ephemeral: false,
      fetchReply: true,
    }
  }

  private generateEmbed(user: User, spark: Spark): EmbedBuilder {
    const draws = this.calculateDraws(spark)
    const numSparks = Math.floor(draws / DRAWS_PER_SPARK)
    const remainder = draws - numSparks * DRAWS_PER_SPARK

    // Calculate percentage of next spark
    const drawPercentage =
      numSparks > 0
        ? Math.floor((remainder / DRAWS_PER_SPARK) * 100)
        : Math.floor((draws / DRAWS_PER_SPARK) * 100)

    // Create base embed
    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setColor(0xdc322f)
      .setThumbnail(user.displayAvatarURL())
      .addFields([
        { name: "Crystals", value: `${spark.crystals}`, inline: true },
        { name: "Tickets", value: `${spark.tickets}`, inline: true },
        {
          name: "10-Part Tickets",
          value: `${spark.ten_tickets}`,
          inline: true,
        },
        {
          name: "Progress",
          value: this.drawProgressBar(drawPercentage, numSparks),
        },
      ])

    // Conditionally add fields
    if (numSparks > 0) {
      embed.addFields({ name: "Sparks", value: `${numSparks}` })
    }

    if (draws > 0) {
      embed.addFields({ name: "Draws", value: `${draws}` })
    }

    return embed
  }

  // Methods: Formatting and Display

  private formatDescription(
    user: User,
    isSelf: boolean,
    hasSpark: boolean = true
  ): string {
    const possessive = isSelf ? "Your" : `<@${user.id}>'s`
    const pronoun = isSelf ? "you haven't" : `<@${user.id}> hasn't`

    return hasSpark
      ? `${possessive} spark progress`
      : `It looks like ${pronoun} saved a spark yet.`
  }

  private formatDifference(difference: Spark): string {
    const increasedCurrencies: string[] = []
    const decreasedCurrencies: string[] = []

    // Sort differences into increased and decreased categories
    Object.entries(difference).forEach(([key, value]) => {
      if (value === 0) return

      const absValue = Math.abs(value)
      const formatted = `${absValue} ${pluralize(this.keyToString(key), absValue)}`

      if (value > 0) {
        increasedCurrencies.push(formatted)
      } else {
        decreasedCurrencies.push(formatted)
      }
    })

    // Format the currency strings
    const increased = this.formatCurrencyList(increasedCurrencies, "You saved")
    const decreased = this.formatCurrencyList(decreasedCurrencies, "You spent")

    return [increased, decreased].filter(Boolean).join(" ")
  }

  private formatCurrencyList(currencies: string[], prefix: string): string {
    if (currencies.length === 0) return ""

    const formatted = currencies.map((currency) => `**${currency}**`)

    // Join with commas and "and" for the last item
    const joined =
      formatted.length > 1
        ? `${formatted.slice(0, -1).join(", ")}, and ${formatted.slice(-1)}`
        : formatted[0]

    return `${prefix} ${joined}.`
  }

  private keyToString(key: string): string {
    switch (key) {
      case "crystals":
        return "crystal"
      case "tickets":
        return "draw ticket"
      case "ten_tickets":
        return "ten-part draw ticket"
      default:
        return ""
    }
  }

  private drawProgressBar(percentage: number, numSparks: number): string {
    const character = "="
    const length = 15
    const ticks = Math.floor(length / (100 / percentage))
    const spaces = length - ticks

    return [
      `\`\`\`Spark #${numSparks + 1} `,
      "[",
      Array(ticks).fill(character).join(""),
      ">",
      Array(spaces).fill(" ").join(""),
      "]",
      ` ${percentage}%\`\`\``,
    ].join("")
  }
}
