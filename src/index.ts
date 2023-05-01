import { LogLevel, SapphireClient } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  logger: { level: LogLevel.Debug },
})

client.logger.info("Hello world!")
client.login(process.env.DISCORD_TOKEN)

// const { REST, Routes } = require("discord.js")
// const rest = new REST().setToken(process.env.DISCORD_TOKEN)

// ...

// for guild-based commands
// rest
//   .put(
//     Routes.applicationGuildCommands(
//       process.env.DISCORD_CLIENT_ID,
//       process.env.DISCORD_GUILD_ID
//     ),
//     {
//       body: [],
//     }
//   )
//   .then(() => client.logger.info("Successfully deleted all guild commands."))
//   .catch(console.error)

// for global commands
// rest
//   .put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [] })
//   .then(() =>
//     client.logger.info("Successfully deleted all application commands.")
//   )
//   .catch(console.error)
