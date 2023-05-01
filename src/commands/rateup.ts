import {
  EmbedBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js"
import { Subcommand } from "@sapphire/plugin-subcommands"
import { ApplyOptions } from "@sapphire/decorators"
import { isMessageInstance } from "@sapphire/discord.js-utilities"

@ApplyOptions<Subcommand.Options>({
  description: "Manipulate gacha rates",
  subcommands: [
    {
      name: "set",
      chatInputRun: "chatInputSet",
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
            return this.rateupCommand(command, "set", description)
          })
          .addSubcommand((command) => {
            const description = "Copy someone else's gacha rates"
            return this.rateupCommand(command, "copy", description)
          })
          .addSubcommand((command) => {
            const description =
              "Reset your gacha rates to mirror the current banner"
            return this.rateupCommand(command, "reset", description)
          })
      },
      {
        guildIds: [process.env.DISCORD_GUILD_ID || ""],
        idHints: ["1099571255344103433"],
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

  // Methods: Slash Commands

  public async chatInputSet(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    await interaction.reply({
      content: `This command is still under construction`,
      ephemeral: true,
      fetchReply: true,
    })
  }

  public async chatInputCopy(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    await interaction.reply({
      content: `This command is still under construction`,
      ephemeral: true,
      fetchReply: true,
    })
  }

  public async chatInputReset(
    interaction: Subcommand.ChatInputCommandInteraction
  ) {
    await interaction.reply({
      content: `This command is still under construction`,
      ephemeral: true,
      fetchReply: true,
    })
  }
}
