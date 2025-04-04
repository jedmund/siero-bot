import { Command } from "@sapphire/framework"
import { isMessageInstance } from "@sapphire/discord.js-utilities"
import { config } from "dotenv"

if (process.env.NODE_ENV !== "production") {
  config()
}

const COMMAND_ID = process.env.PING_COMMAND_ID ?? ""

export class PingCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      description: "Pings Siero to see if she's alive",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        builder //
          .setName(this.name)
          .setDescription(this.description)
      },
      {
        idHints: [COMMAND_ID],
      }
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const msg = await interaction.reply({
      content: `Ping?`,
      ephemeral: true,
      fetchReply: true,
    })

    if (isMessageInstance(msg)) {
      const diff = msg.createdTimestamp - interaction.createdTimestamp
      const ping = Math.round(this.container.client.ws.ping)
      return interaction.editReply(
        `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`
      )
    }

    return interaction.editReply("Failed to retrieve ping :(")
  }
}
