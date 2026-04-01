import "dotenv/config"
import { LogLevel, SapphireClient } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"

const sapphire = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.GuildMessageReactions
    // GatewayIntentBits.MessageContent
  ],
  logger: { level: LogLevel.Debug },
})

sapphire.login(process.env.DISCORD_TOKEN)
