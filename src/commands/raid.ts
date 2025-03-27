import { EmbedBuilder, ChatInputCommandInteraction } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"

const COMMAND_ID =
  process.env.NODE_ENV === "production"
    ? "1354487670557904978"
    : "1354505875779489833"

const ELEMENTS = {
  FIRE: { name: "Fire", emoji: "🔴", color: 0xff0000 },
  WATER: { name: "Water", emoji: "🔵", color: 0x0000ff },
  EARTH: { name: "Earth", emoji: "🟠", color: 0xffa500 },
  WIND: { name: "Wind", emoji: "🟢", color: 0x00ff00 },
  LIGHT: { name: "Light", emoji: "🟡", color: 0xffff00 },
  DARK: { name: "Dark", emoji: "🟣", color: 0x800080 },
}

const RAIDS = {
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
    console.log("Starting raid command execution")

    const raidType = interaction.options.getString("raid", true)

    // Get hours and minutes with defaults
    const hours = interaction.options.getInteger("hours") || 0
    const minutes = interaction.options.getInteger("minutes") || 0

    // Calculate total time offset in minutes (0 if both are 0)
    const timeOffset = hours * 60 + minutes

    // If both hours and minutes are 0, assume it's starting now
    const isStartingNow = hours === 0 && minutes === 0

    const raid =
      raidType === "hexachromatic" ? RAIDS.HEXACHROMATIC : RAIDS.DARK_RAPTURE

    // Calculate the current time
    const currentTime = new Date()

    // Create a clean time with seconds and milliseconds set to 0
    const cleanTime = new Date(currentTime)
    cleanTime.setSeconds(0)
    cleanTime.setMilliseconds(0)

    // Add the time offset to the rounded time (if not starting now)
    let startTime: number

    if (isStartingNow) {
      // If starting now, don't clean the time, just use current time
      startTime = new Date().getTime()
    } else {
      // Otherwise use the clean time plus offset
      startTime = cleanTime.getTime() + timeOffset * 60 * 1000
    }

    // Create Discord timestamp format for embed
    const discordTimestamp = `<t:${Math.floor(startTime / 1000)}:t>`

    console.log(`Creating raid: ${raid.name}, time offset: ${timeOffset}`)

    // Generate element fields programmatically
    const elementFields = Object.values(ELEMENTS).map((element) => ({
      name: `${element.emoji} ${element.name}`,
      value: "No one",
      inline: true,
    }))

    const embed = new EmbedBuilder()
      .setTitle(`${raid.name} Signup Sheet`)
      .setDescription(`Raid starting at ${discordTimestamp}`)
      .setColor(0x0099ff)
      .addFields(elementFields)

    // Create Discord timestamp format for ping message
    const discordRelativeTime = `<t:${Math.floor(startTime / 1000)}:R>`

    // Create appropriate message based on start time
    const pingMessage = isStartingNow
      ? `<@&${raid.role}> Organizing a run for ${raid.name} starting now!`
      : `<@&${raid.role}> Organizing a run for ${raid.name} ${discordRelativeTime}`

    console.log("Sending initial embed")

    const message = await interaction.reply({
      content: pingMessage,
      embeds: [embed],
      fetchReply: true,
    })

    // Add reactions for each element
    console.log("Adding reactions to message")
    for (const element of Object.values(ELEMENTS)) {
      await message.react(element.emoji)
    }

    // Fix: Create collector with proper filter
    console.log("Setting up reaction collector")
    const collector = message.createReactionCollector({
      filter: (reaction, user) => {
        // Don't filter out any reactions, but ignore bot reactions
        console.log(
          `Reaction received: ${reaction.emoji.name} from user ${user.tag}`
        )
        return (
          !user.bot &&
          Object.values(ELEMENTS).some((e) => e.emoji === reaction.emoji.name)
        )
      },
      time: isStartingNow ? 10000 : timeOffset * 60 * 1000, // give at least 10 seconds for "now" raids
      dispose: true,
    })

    // Handle adding reactions
    collector.on("collect", async (reaction, user) => {
      console.log(
        `Reaction collected: ${reaction.emoji.name} from user ${user.tag}`
      )
      await this.handleReaction(message, reaction, user, true)
    })

    // Handle removing reactions
    collector.on("remove", async (reaction, user) => {
      console.log(
        `Reaction removed: ${reaction.emoji.name} from user ${user.tag}`
      )
      await this.handleReaction(message, reaction, user, false)
    })

    // Handle collector ending
    collector.on("end", async (collected) => {
      console.log(
        `Reaction collector ended with ${collected.size} reactions collected`
      )

      const freshMessage = await message.fetch()
      const currentEmbed = freshMessage.embeds[0]

      const finalEmbed = new EmbedBuilder()
        .setTitle(currentEmbed.title)
        .setDescription(
          `${currentEmbed.description}\n\n**Raid time has passed!**`
        )
        .setColor(currentEmbed.color)

      // properly copy each field individually
      if (currentEmbed.fields) {
        for (const field of currentEmbed.fields) {
          finalEmbed.addFields(field)
        }
      }

      await message.edit({
        content: `Organized a run for ${raid.name} that started ${discordRelativeTime}`,
        embeds: [finalEmbed],
      })

      // do same for follow-up message
      const finalMessageEmbed = new EmbedBuilder()
        .setTitle(currentEmbed.title)
        .setDescription(
          `**${raid.name} is starting now!**\n\nFinal signup sheet:`
        )
        .setColor(0x00ff00) // Green color to indicate it's starting

      // properly copy fields again
      if (currentEmbed.fields) {
        for (const field of currentEmbed.fields) {
          finalMessageEmbed.addFields(field)
        }
      }

      // check if channel supports sending messages
      if (message.channel && "send" in message.channel) {
        await message.channel.send({
          content: `<@&${raid.role}> is starting! Here's the final signup sheet:`,
          embeds: [finalMessageEmbed],
        })
      }
    })
  }

  private getElementFromEmoji(emoji: string | null) {
    if (!emoji) return null
    const element = Object.values(ELEMENTS).find((e) => e.emoji === emoji)
    console.log(
      `Looking up emoji: ${emoji}, found element: ${element?.name || "none"}`
    )
    return element
  }

  private async handleReaction(
    message: any,
    reaction: any,
    user: any,
    isAdd: boolean
  ) {
    console.log(`handleReaction called - isAdd: ${isAdd}`)
    if (user.bot) {
      console.log("Ignoring bot user")
      return
    }

    try {
      // Get the emoji name - no need to fetch again as it's already provided
      const emoji = reaction.emoji.name

      console.log(`Processing emoji: ${emoji}`)
      const element = this.getElementFromEmoji(emoji)
      if (!element) {
        console.log("No matching element found")
        return
      }

      // Get the current embed
      const currentEmbed = await message
        .fetch()
        .then((msg: any) => msg.embeds[0])
      console.log(
        "Current embed fields:",
        currentEmbed.fields.map((f: any) => `${f.name}: ${f.value}`)
      )
      const fields = currentEmbed.fields || []

      // Find the field for this element
      const fieldIndex = fields.findIndex((f: any) =>
        f.name.includes(element.emoji)
      )
      console.log(`Found field at index: ${fieldIndex}`)
      if (fieldIndex === -1) {
        console.log("Field not found in embed")
        return
      }

      const currentValue = fields[fieldIndex].value
      console.log(`Current field value: "${currentValue}"`)

      const userMention = `<@${user.id}>`

      // Update the value based on whether we're adding or removing the user
      let newValue
      if (isAdd) {
        // Check if user is already in this element's list
        if (currentValue.includes(userMention)) {
          console.log(
            `User ${user.tag} already in ${element.name} list, skipping`
          )
          return
        }

        // Add user to the list
        newValue =
          currentValue === "No one"
            ? userMention
            : `${currentValue}\n${userMention}`

        console.log(`Adding user ${user.tag} to ${element.name}`)
      } else {
        // Remove the user mention from the value
        newValue = currentValue
          .replace(`<@${user.id}>`, "")
          .replace(/\n\n/g, "\n") // Remove double line breaks
          .replace(/^\n|\n$/g, "") // Remove leading/trailing line breaks
          .trim()

        // If empty, reset to "No one"
        if (!newValue) {
          newValue = "No one"
        }
      }

      console.log(`New field value: "${newValue}"`)

      const currentFields = message.embeds[0].fields || []
      const updatedFields = [...currentFields]
      updatedFields[fieldIndex] = {
        name: currentFields[fieldIndex].name,
        value: newValue,
        inline: currentFields[fieldIndex].inline,
      }

      // Update the embed with the new field value
      const updatedEmbed = this.updateEmbedField(
        currentEmbed,
        fieldIndex,
        newValue
      )

      console.log("Editing message with updated embed")
      await message.edit({ embeds: [updatedEmbed] })
      console.log("Message successfully edited")
    } catch (error) {
      console.error(
        `Error in reaction ${isAdd ? "collection" : "removal"}:`,
        error
      )
    }
  }

  private updateEmbedField(embed: any, fieldIndex: number, newValue: string) {
    const fields = embed.fields || []

    // Create a new array of fields with the updated value
    const updatedFields = fields.map((field: any, idx: number) =>
      idx === fieldIndex
        ? { name: field.name, value: newValue, inline: field.inline }
        : field
    )

    // Create a new embed with the updated fields
    return EmbedBuilder.from(embed).setFields(updatedFields)
  }
}
