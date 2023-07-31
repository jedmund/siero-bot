import { EmbedBuilder, SlashCommandSubcommandBuilder, User } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import pluralize from "pluralize"
import Api from "../services/api"
import Leaderboard from "../services/leaderboard"

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const COMMAND_ID =
  process.env.NODE_ENV === "production"
    ? "1110727196584202361"
    : "1103831182728232960"

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
            let builtCommand = this.sparkCommand(command, "add", description)
            return this.addSparkOptions(builtCommand, "to add")
          })
          .addSubcommand((command) => {
            const description = "Remove currency from your spark progress"
            let builtCommand = this.sparkCommand(command, "remove", description)
            return this.addSparkOptions(builtCommand, "to remove")
          })
          .addSubcommand((command) => {
            const description = "Update your spark progress"
            let builtCommand = this.sparkCommand(command, "update", description)
            return this.addSparkOptions(builtCommand, "you have")
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

  // Methods: Slash Commands

  public async chatInputAdd(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    return await this.chatInputArithmetic(interaction, "+")
  }

  public async chatInputRemove(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    await this.chatInputArithmetic(interaction, "-")
  }

  private async chatInputArithmetic(
    interaction: Subcommand.ChatInputCommandInteraction,
    operation: "+" | "-"
  ) {
    const currentProgress = await Api.fetchSpark(interaction.user.id)
    const inputCurrencies = this.getCurrencies(interaction)

    let progress: { [key: string]: number } = {}
    for (const currency in inputCurrencies) {
      const inputValue = inputCurrencies[currency]
      const currentValue = currentProgress ? currentProgress.spark[currency] : 0
      progress[currency] =
        operation === "+"
          ? currentValue + inputValue
          : Math.max(currentValue - inputValue, 0)
    }

    const progressResponse = await Api.updateSpark({
      userId: interaction.user.id,
      guildIds: this.updateGuilds(
        currentProgress ? currentProgress.guildIds : [],
        interaction.guild?.id
      ),
      ...progress,
    })

    if (progressResponse) {
      const difference: Spark = this.calculateDifference(
        currentProgress
          ? currentProgress.spark
          : { crystals: 0, tickets: 0, ten_tickets: 0 },
        progressResponse
      )
      const differenceString = this.formatDifference(difference)
      interaction.reply(
        this.generateResponseBlock(
          interaction.user,
          progressResponse,
          differenceString
        )
      )
    }
  }

  public async chatInputUpdate(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    const currentProgress = await Api.fetchSpark(interaction.user.id)
    const updatedProgress = this.getCurrencies(interaction)

    const progressResponse = await Api.updateSpark({
      userId: interaction.user.id,
      guildIds: this.updateGuilds(
        currentProgress ? currentProgress.guildIds : [],
        interaction.guild?.id
      ),
      ...updatedProgress,
    })

    if (progressResponse) {
      const difference: Spark = this.calculateDifference(
        currentProgress
          ? currentProgress.spark
          : { crystals: 0, tickets: 0, ten_tickets: 0 },
        progressResponse
      )
      const differenceString = this.formatDifference(difference)
      interaction.reply(
        this.generateResponseBlock(
          interaction.user,
          progressResponse,
          differenceString
        )
      )
    }
  }

  public async chatInputProgress(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    // Extract the user from the interaction and store
    // whether we are fetching rateups for the sender or someone else
    const providedUser = interaction.options.getUser("user")
    let user = providedUser === null ? interaction.user : providedUser

    // Fetch the appropriate rates and render them to the user
    const progress = await Api.fetchSpark(user.id)
    await interaction.reply({
      content: this.formatDescription(
        user,
        providedUser === null,
        progress !== undefined
      ),
      embeds: progress ? [this.generateEmbed(user, progress.spark)] : [],
      fetchReply: true,
    })
  }

  public async chatInputLeaderboard(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    if (!interaction.channel) {
      interaction.reply({
        content:
          "Sorry, I can't show leaderboards in direct messages. Please send the command from a server that we're both in!",
      })
    }

    const guild = interaction.guild

    if (guild) {
      const order = "desc"
      let leaderboard = new Leaderboard(guild?.id, order)
      const embed = await leaderboard.execute()

      interaction.reply({
        content: `Here is the current leaderboard for ${guild.name}:`,
        embeds: [embed],
      })
    }
  }

  public async chatInputReset(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    Api.resetSpark(interaction.user.id)

    await interaction.reply({
      content: `Your spark was successfully reset`,
      ephemeral: true,
      fetchReply: true,
    })
  }

  // Methods: Rendering methods

  private formatDescription(
    user: User,
    isSender: boolean,
    hasSpark: boolean = true
  ) {
    let possessive: string
    let pronoun: string
    if (isSender) {
      possessive = "Your"
      pronoun = "you haven't"
    } else {
      possessive = `<@${user.id}>'s`
      pronoun = `<@${user.id}> hasn't`
    }

    // Create description strings based on the result of the query
    const description = hasSpark
      ? `${possessive} spark progress`
      : `It looks like ${pronoun} saved a spark yet.`

    return description
  }

  private formatDifference(difference: Spark) {
    let increasedCurrencies: string[] = []
    let decreasedCurrencies: string[] = []

    Object.keys(difference).forEach((key) => {
      const currency = difference[key]
      const value = Math.abs(currency)
      const string = `${value} ${pluralize(this.keyToString(key), value)}`
      if (currency > 0) increasedCurrencies.push(string)
      if (currency < 0) decreasedCurrencies.push(string)
    })

    const increasedString = this.formatCurrency(
      increasedCurrencies,
      "You saved"
    )
    const decreasedString = this.formatCurrency(
      decreasedCurrencies,
      "You spent"
    )

    return [increasedString, decreasedString].filter(Boolean).join(" ")
  }

  private formatCurrency(currencies: string[], prefix: string) {
    if (currencies.length === 0) {
      return ""
    }
    const formattedCurrencies = currencies.map((currency) => `**${currency}**`)
    const joinedCurrencies =
      formattedCurrencies.length > 1
        ? formattedCurrencies.slice(0, -1).join(", ") +
          ", and " +
          formattedCurrencies.slice(-1)
        : formattedCurrencies[0]
    return `${prefix} ${joinedCurrencies}.`
  }

  private generateResponseBlock(
    user: User,
    spark: Spark,
    differenceString?: string
  ) {
    return {
      content: `Your spark has been updated! ${differenceString}`,
      embeds: [this.generateEmbed(user, spark)],
      ephemeral: false,
      fetchReply: true,
    }
  }

  private generateEmbed(user: User, spark: Spark) {
    const draws = this.calculateDraws(
      spark.crystals,
      spark.tickets,
      spark.ten_tickets
    )
    const numSparks = Math.floor(draws / 300)

    const remainder = draws - numSparks * 300
    const drawPercentage =
      numSparks > 0
        ? Math.floor((remainder / 300) * 100)
        : Math.floor((draws / 300) * 100)

    let embed = new EmbedBuilder({
      title: user.username,
      color: 0xdc322f,
      thumbnail: {
        url: user.displayAvatarURL(),
      },
      fields: [
        {
          name: "Crystals",
          value: `${spark.crystals}`,
          inline: true,
        },
        {
          name: "Tickets",
          value: `${spark.tickets}`,
          inline: true,
        },
        {
          name: "10-Part Tickets",
          value: `${spark.ten_tickets}`,
          inline: true,
        },
        {
          name: "Progress",
          value: this.drawProgressBar(drawPercentage, numSparks),
        },
      ],
    })

    if (numSparks > 0) {
      embed.addFields([
        {
          name: "Sparks",
          value: `${numSparks}`,
        },
      ])
    }

    if (draws > 0) {
      embed.addFields([
        {
          name: "Draws",
          value: `${draws}`,
        },
      ])
    }

    return embed
  }

  // Methods: Convenience methods

  private calculateDifference(previous: Spark, current: Spark) {
    return {
      crystals: current.crystals - previous.crystals,
      tickets: current.tickets - previous.tickets,
      ten_tickets: current.ten_tickets - previous.ten_tickets,
    }
  }

  private calculateDraws(
    crystals: number,
    tickets: number,
    tenTickets: number
  ) {
    let ticketValue = tickets * 300
    let tenTicketValue = tenTickets * 3000
    let totalCrystalValue = crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / 300)
  }

  private drawProgressBar(percentage: number, numSparks: number) {
    const character = "="
    const length = 15
    const ticks = Math.floor(length / (100 / percentage))
    const spaces = length - ticks

    return [
      `\`\`\`Spark \#${numSparks + 1} `,
      "[",
      Array(ticks).fill(character).join(""),
      ">",
      Array(spaces).fill(" ").join(""),
      "]",
      ` ${percentage}%\`\`\``,
    ].join("")
  }

  private keyToString(key: string) {
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

  private getCurrencies(interaction: Subcommand.ChatInputCommandInteraction) {
    let progress: { [key: string]: number } = {}

    let crystals = interaction.options.getString("crystals")
    if (crystals) progress.crystals = parseInt(crystals)

    let tickets = interaction.options.getString("tickets")
    if (tickets) progress.tickets = parseInt(tickets)

    let tenTickets = interaction.options.getString("ten_tickets")
    if (tenTickets) progress.ten_tickets = parseInt(tenTickets)

    return progress
  }

  private updateGuilds(currentGuildIds: string[], guildId?: string) {
    if (!guildId || currentGuildIds.includes(guildId)) {
      return currentGuildIds
    }

    // If guildId is provided and does not exist in currentGuildIds,
    // add it to the beginning of the array.
    return [guildId, ...currentGuildIds]
  }
}
