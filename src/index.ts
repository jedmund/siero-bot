import "dotenv/config"
import { LogLevel, SapphireClient } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"
import { Client } from "./services/connection.js"
import { catalogueCache } from "./services/cache.js"
import { validateConfiguration } from "./services/config.js"
import { checkRateupSchema } from "./services/readiness.js"
import { runtime } from "./services/lifecycle.js"

const sapphire = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  logger: { level: LogLevel.Debug },
})
let shutdownPromise: Promise<void> | undefined
function shutdown() {
  return shutdownPromise ??= (async () => {
    await runtime.shutdown()
    await catalogueCache.close()
    await sapphire.destroy()
    await Client.destroy()
  })()
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void shutdown().catch(error => { console.error("Shutdown failed", error); process.exitCode = 1 }) })
try {
  validateConfiguration(process.env)
  await checkRateupSchema(Client)
  await catalogueCache.load()
  runtime.assertAccepting()
  catalogueCache.startRefresh()
  await sapphire.login(process.env.DISCORD_TOKEN)
} catch (error) {
  console.error("Startup failed", error)
  process.exitCode = 1
  await shutdown()
}
