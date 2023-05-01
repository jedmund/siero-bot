import { SapphireClient } from "@sapphire/framework"
import { REST, Routes } from "discord.js"

// Purge guild-based commands
export function purgeGuildCommands(client: SapphireClient) {
  if (
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_GUILD_ID &&
    process.env.DISCORD_TOKEN
  ) {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN)

    rest
      .put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        {
          body: [],
        }
      )
      .then(() =>
        client.logger.info("Successfully deleted all guild commands.")
      )
      .catch(console.error)
  } else {
    const missing = missingConstants()
    client.logger.error(
      `Some Discord credentials were not provided: ${missing.join(", ")}`
    )
  }
}

// Purge global commands
export function purgeGlobalCommands(client: SapphireClient) {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_TOKEN) {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN)

    rest
      .put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
        body: [],
      })
      .then(() =>
        client.logger.info("Successfully deleted all application commands.")
      )
      .catch(console.error)
  } else {
    const missing = missingConstants()
    client.logger.error(
      `Some Discord credentials were not provided: ${missing.join(", ")}`
    )
  }
}

function missingConstants() {
  const missingClientId = process.env.DISCORD_CLIENT_ID === undefined
  const missingGuildId = process.env.DISCORD_GUILD_ID === undefined
  const missingToken = process.env.DISCORD_TOKEN === undefined

  const missingConstants = []
  if (missingClientId) missingConstants.push("Client ID")
  if (missingGuildId) missingConstants.push("Guild ID")
  if (missingToken) missingConstants.push("Token")

  return missingConstants
}
