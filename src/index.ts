import { SapphireClient } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

client.login("your-token-goes-here")
