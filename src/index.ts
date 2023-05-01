import { LogLevel, SapphireClient } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  logger: { level: LogLevel.Debug },
})

client.login(process.env.DISCORD_TOKEN)
