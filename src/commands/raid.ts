import { EmbedBuilder, ChatInputCommandInteraction } from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"

const ELEMENTS = {
  FIRE: { name: "Fire", emoji: "🔴", color: 0xFF0000 },
  WATER: { name: "Water", emoji: "🔵", color: 0x0000FF },
  EARTH: { name: "Earth", emoji: "🟠", color: 0xFFA500 },
  WIND: { name: "Wind", emoji: "🟢", color: 0x00FF00 },
  LIGHT: { name: "Light", emoji: "🟡", color: 0xFFFF00 },
  DARK: { name: "Dark", emoji: "🟣", color: 0x800080 }
}

const RAIDS = {
  HEXACHROMATIC: {
    name: "Hexachromatic Hierarch",
    role: "1216359309869580368"
  },
  DARK_RAPTURE: {
    name: "Dark Rapture Zero",
    role: "1216359321340739614"
  }
}

@ApplyOptions<Subcommand.Options>({
  description: "Create a raid ping for a specific raid",
  subcommands: [
    {
      name: "create",
      chatInputRun: "chatInputCreate"
    }
  ]
})
export class RaidCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    console.log("Registering raid command...")
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
              .addStringOption((option) =>
                option
                  .setName("time")
                  .setDescription("When the raid will start")
                  .setRequired(true)
                  .addChoices(
                    { name: "In 30 minutes", value: "30" },
                    { name: "In 1 hour", value: "60" },
                    { name: "In 2 hours", value: "120" },
                    { name: "In 3 hours", value: "180" },
                    { name: "In 4 hours", value: "240" },
                    { name: "In 5 hours", value: "300" },
                    { name: "In 6 hours", value: "360" }
                  )
              )
          )
        },
        {
          idHints: ["1354487670557904978"],
        }
    )
  }

  public async chatInputCreate(interaction: ChatInputCommandInteraction) {
    const raidType = interaction.options.getString("raid", true)
    const timeOffset = parseInt(interaction.options.getString("time", true))

    const raid = raidType === "hexachromatic" ? RAIDS.HEXACHROMATIC : RAIDS.DARK_RAPTURE
    const startTime = new Date(Date.now() + timeOffset * 60 * 1000)

    const embed = new EmbedBuilder()
      .setTitle(`${raid.name} Signup Sheet`)
      .setDescription(`Raid starting at ${startTime.toLocaleTimeString()}`)
      .setColor(0x0099FF)
      .addFields(
        { name: "🔴 Fire", value: "No one", inline: true },
        { name: "🔵 Water", value: "No one", inline: true },
        { name: "🟠 Earth", value: "No one", inline: true },
        { name: "🟢 Wind", value: "No one", inline: true },
        { name: "🟡 Light", value: "No one", inline: true },
        { name: "🟣 Dark", value: "No one", inline: true }
      )

    const message = await interaction.reply({
      content: `<@&${raid.role}> Organizing a run for ${raid.name} ${timeOffset}`,
      embeds: [embed],
      fetchReply: true
    })

    // Add reactions for each element
    for (const element of Object.values(ELEMENTS)) {
      await message.react(element.emoji)
    }

    // Create a collector for reactions
    const collector = message.createReactionCollector({
      time: timeOffset * 60 * 1000 // Same as the time offset
    })

    collector.on("collect", async (reaction, user) => {
      console.log("Reaction collected:", {
        emoji: reaction.emoji.name,
        userId: user.id,
        isBot: user.bot
      })

      if (user.bot) return

      try {
        // Fetch the reaction to get the emoji name
        const fetchedReaction = await reaction.fetch()
        console.log("Fetched reaction:", {
          emoji: fetchedReaction.emoji.name,
          count: fetchedReaction.count
        })

        const emoji = fetchedReaction.emoji.name
        const element = Object.values(ELEMENTS).find(e => e.emoji === emoji)
        
        console.log("Found element:", element)
        
        if (!element) return

        // Get the current embed
        const currentEmbed = message.embeds[0]
        const fields = currentEmbed.fields || []
        
        console.log("Current fields:", fields)
        
        // Find the field for this element
        const fieldIndex = fields.findIndex(f => f.name.includes(element.emoji))
        console.log("Found field index:", fieldIndex)
        
        if (fieldIndex === -1) return

        const currentValue = fields[fieldIndex].value
        const newValue = currentValue === "No one" 
          ? `<@${user.id}>`
          : `${currentValue}\n<@${user.id}>`

        console.log("Updating value:", {
          current: currentValue,
          new: newValue
        })

        // Update the embed
        const updatedEmbed = new EmbedBuilder()
          .setTitle(currentEmbed.title)
          .setDescription(currentEmbed.description)
          .setColor(currentEmbed.color)
          .setFields(
            fields.map((field, index) => 
              index === fieldIndex 
                ? { ...field, value: newValue }
                : field
            )
          )

        await message.edit({ embeds: [updatedEmbed] })
        console.log("Embed updated successfully")
      } catch (error) {
        console.error("Error in reaction collector:", error)
      }
    })

    collector.on("end", () => {
      console.log("Reaction collector ended")
      const finalEmbed = new EmbedBuilder()
        .setTitle(message.embeds[0].title)
        .setDescription(`${message.embeds[0].description}\n\n**Raid time has passed!**`)
        .setColor(message.embeds[0].color)
        .setFields(message.embeds[0].fields)
      message.edit({ embeds: [finalEmbed] })
    })
  }
}