import {
  EmbedBuilder,
  ChatInputCommandInteraction,
  Message,
  TextBasedChannel,
  APIEmbedField,
  MessageReaction,
  User,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"

const COMMAND_ID =
  process.env.NODE_ENV === "production"
    ? "1354487670557904978"
    : "1354505875779489833"

type Element = {
  name: string
  emoji: string
  color: number
}

const ELEMENTS: Record<string, Element> = {
  FIRE: { name: "Fire", emoji: "🔴", color: 0xff0000 },
  WATER: { name: "Water", emoji: "🔵", color: 0x0000ff },
  EARTH: { name: "Earth", emoji: "🟠", color: 0xffa500 },
  WIND: { name: "Wind", emoji: "🟢", color: 0x00ff00 },
  LIGHT: { name: "Light", emoji: "🟡", color: 0xffff00 },
  DARK: { name: "Dark", emoji: "🟣", color: 0x800080 },
}

type Raid = {
  name: string
  role: string
}

const RAIDS: Record<string, Raid> = {
  HEXACHROMATIC: {
    name: "Hexachromatic Hierarch",
    role: "1216359309869580368",
  },
  DARK_RAPTURE: {
    name: "Dark Rapture Zero",
    role: "1216359321340739614",
  },
}

@ApplyOptions<Subcommand.Options>({
  description: "Create a raid ping for a specific raid",
  subcommands: [
    {
      name: "create",
      chatInputRun: "chatInputCreate",
    },
  ],
})
export class RaidCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        builder
          .setName("raid")
          .setDescription("Create a raid ping for a specific raid")
          .addSubcommand((subcommand) =>
            subcommand
              .setName("create")
              .setDescription("Create a new raid ping")
              .addStringOption((option) =>
                option
                  .setName("raid")
                  .setDescription("The raid to ping for")
                  .setRequired(true)
                  .addChoices(
                    { name: RAIDS.HEXACHROMATIC.name, value: "hexachromatic" },
                    { name: RAIDS.DARK_RAPTURE.name, value: "dark_rapture" }
                  )
              )
              .addIntegerOption((option) =>
                option
                  .setName("hours")
                  .setDescription("Hours from now (optional)")
                  .setRequired(false)
                  .setMinValue(0)
                  .setMaxValue(12)
              )
              .addIntegerOption((option) =>
                option
                  .setName("minutes")
                  .setDescription("Minutes from now (optional)")
                  .setRequired(false)
                  .setMinValue(0)
                  .setMaxValue(59)
                  .setChoices(
                    { name: "0", value: 0 },
                    { name: "3", value: 3 },
                    { name: "15", value: 15 },
                    { name: "30", value: 30 },
                    { name: "45", value: 45 }
                  )
              )
          )
      },
      {
        idHints: [COMMAND_ID],
      }
    )
  }

  public async chatInputCreate(interaction: ChatInputCommandInteraction) {
    // Get raid parameters
    const raidType = interaction.options.getString("raid", true)
    const hours = interaction.options.getInteger("hours") ?? 0
    const minutes = interaction.options.getInteger("minutes") ?? 0
    const raid =
      raidType === "hexachromatic" ? RAIDS.HEXACHROMATIC : RAIDS.DARK_RAPTURE

    // Get timing info
    const { isStartingNow, discordTimestamp, discordRelativeTime } =
      this.calculateTiming(hours, minutes)

    // Create embed
    const embed = this.createInitialEmbed(raid.name, discordTimestamp)

    // Create message
    const pingMessage = this.createPingMessage(
      raid,
      isStartingNow,
      discordRelativeTime
    )

    const message = await interaction.reply({
      content: pingMessage,
      embeds: [embed],
      fetchReply: true,
    })

    // Add reactions for each element
    await this.addElementReactions(message)

    // Setup collector
    this.setupReactionCollector(
      message as Message,
      raid,
      isStartingNow,
      discordRelativeTime,
      minutes + hours * 60
    )
  }

  private async handleReaction(
    message: Message,
    reaction: MessageReaction,
    user: User,
    isAdd: boolean
  ): Promise<void> {
    if (user.bot) return

    try {
      // Get element from emoji
      const emoji = reaction.emoji.name
      const element = this.getElementFromEmoji(emoji)
      if (!element) return

      // Get current embed and find field
      const embed = await this.getCurrentEmbed(message)
      if (!embed) return

      const fieldIndex = this.findElementFieldIndex(embed, element.emoji)
      if (fieldIndex === -1) return

      // Update user in field
      const currentValue = embed.data.fields?.[fieldIndex].value ?? "No one"
      const newValue = this.updateUserInFieldValue(currentValue, user.id, isAdd)

      // Update embed with new field
      const updatedEmbed = this.updateEmbedField(embed, fieldIndex, newValue)
      await message.edit({ embeds: [updatedEmbed] })
    } catch (error) {
      console.error(`Error handling reaction:`, error)
    }
  }

  // Methods: Collection event handlers

  private async handleRaidEnd(
    message: Message,
    raid: Raid,
    discordRelativeTime: string
  ): Promise<void> {
    try {
      const embed = await this.getCurrentEmbed(message)
      if (!embed) return

      // Update original message
      const finalEmbed = this.createFinalEmbed(embed, "Raid time has passed!")
      await message.edit({
        content: `Organized a run for ${raid.name} that started ${discordRelativeTime}`,
        embeds: [finalEmbed],
      })

      // Send follow-up message
      await this.sendStartingMessage(message, raid, embed)
    } catch (error) {
      console.error("Error in handling raid end:", error)
    }
  }

  // Methods: Message handlers

  private async sendStartingMessage(
    message: Message,
    raid: Raid,
    sourceEmbed: EmbedBuilder
  ): Promise<void> {
    const startEmbed = new EmbedBuilder()
      .setTitle(sourceEmbed.data.title ?? "")
      .setDescription(
        `**${raid.name} is starting now!**\n\nFinal signup sheet:`
      )
      .setColor(0x00ff00)

    // Copy fields
    if (sourceEmbed.data.fields) {
      startEmbed.setFields(sourceEmbed.data.fields)
    }

    const channel = message.channel as TextBasedChannel
    if (channel) {
      await channel.send({
        content: `<@&${raid.role}> ${raid.name} is starting! Here's the final signup sheet:`,
        embeds: [startEmbed],
      })
    }
  }

  // Methods: Reaction collector

  private async addElementReactions(message: Message): Promise<void> {
    if (!message || typeof message !== "object" || !("react" in message)) return

    for (const element of Object.values(ELEMENTS)) {
      await message.react(element.emoji)
    }
  }

  private setupReactionCollector(
    message: Message,
    raid: Raid,
    isStartingNow: boolean,
    discordRelativeTime: string,
    timeOffset: number
  ): void {
    const collector = message.createReactionCollector({
      filter: (reaction, user) =>
        !user.bot &&
        Object.values(ELEMENTS).some((e) => e.emoji === reaction.emoji.name),
      time: isStartingNow ? 10000 : timeOffset * 60 * 1000,
      dispose: true,
    })

    collector.on("collect", async (reaction, user) => {
      await this.handleReaction(message, reaction, user, true)
    })

    collector.on("remove", async (reaction, user) => {
      await this.handleReaction(message, reaction, user, false)
    })

    collector.on("end", async () => {
      await this.handleRaidEnd(message, raid, discordRelativeTime)
    })
  }

  // Methods: Embed builders

  private createInitialEmbed(
    raidName: string,
    timestamp: string
  ): EmbedBuilder {
    const elementFields = Object.values(ELEMENTS).map((element) => ({
      name: `${element.emoji} ${element.name}`,
      value: "No one",
      inline: true,
    }))

    return new EmbedBuilder()
      .setTitle(`${raidName} Signup Sheet`)
      .setDescription(`Raid starting at ${timestamp}`)
      .setColor(0x0099ff)
      .addFields(elementFields)
  }

  private createFinalEmbed(
    sourceEmbed: EmbedBuilder,
    additionalText: string
  ): EmbedBuilder {
    const embed = EmbedBuilder.from(sourceEmbed)
    const currentDesc = sourceEmbed.data.description ?? ""

    return embed.setDescription(`${currentDesc}\n\n**${additionalText}**`)
  }

  private async getCurrentEmbed(
    message: Message
  ): Promise<EmbedBuilder | null> {
    const freshMessage = await message.fetch()
    if (!freshMessage.embeds?.[0]) return null
    return EmbedBuilder.from(freshMessage.embeds[0])
  }

  // Methods: Helpers

  private calculateTiming(hours: number, minutes: number) {
    const timeOffset = hours * 60 + minutes
    const isStartingNow = hours === 0 && minutes === 0

    const now = new Date()
    const cleanTime = new Date(now)
    cleanTime.setSeconds(0)
    cleanTime.setMilliseconds(0)

    const startTime = isStartingNow
      ? now.getTime()
      : cleanTime.getTime() + timeOffset * 60 * 1000

    const unixTime = Math.floor(startTime / 1000)

    return {
      isStartingNow,
      startTime,
      discordTimestamp: `<t:${unixTime}:t>`,
      discordRelativeTime: `<t:${unixTime}:R>`,
    }
  }

  private createPingMessage(
    raid: Raid,
    isStartingNow: boolean,
    relativeTime: string
  ): string {
    return isStartingNow
      ? `<@&${raid.role}> Organizing a run for ${raid.name} starting now!`
      : `<@&${raid.role}> Organizing a run for ${raid.name} ${relativeTime}`
  }

  private findElementFieldIndex(
    embed: EmbedBuilder,
    emojiName: string
  ): number {
    return embed.data.fields?.findIndex((f) => f.name.includes(emojiName)) ?? -1
  }

  private getElementFromEmoji(emoji: string | null) {
    if (!emoji) return null
    const element = Object.values(ELEMENTS).find((e) => e.emoji === emoji)
    console.log(
      `Looking up emoji: ${emoji}, found element: ${element?.name || "none"}`
    )
    return element
  }

  private updateEmbedField(
    embed: EmbedBuilder,
    fieldIndex: number,
    newValue: string
  ): EmbedBuilder {
    const fields = embed.data.fields ?? []

    // Create a new array of fields with the updated value
    const updatedFields = fields.map((field: APIEmbedField, idx: number) =>
      idx === fieldIndex
        ? { name: field.name, value: newValue, inline: field.inline }
        : field
    )

    // Create a new embed with the updated fields
    return EmbedBuilder.from(embed).setFields(updatedFields)
  }

  private updateUserInFieldValue(
    currentValue: string,
    userId: string,
    isAdd: boolean
  ): string {
    const userMention = `<@${userId}>`

    // Adding user
    if (isAdd) {
      if (currentValue.includes(userMention)) return currentValue
      return currentValue === "No one"
        ? userMention
        : `${currentValue}\n${userMention}`
    }

    // Removing user
    const newValue = currentValue
      .replace(userMention, "")
      .replace(/\n\n/g, "\n")
      .replace(/^\n|\n$/g, "")
      .trim()

    return newValue || "No one"
  }
}
