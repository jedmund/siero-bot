import * as dotenv from "dotenv";
dotenv.config();

import { LogLevel, SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";
import { purgeGuildCommands } from "../utils/purgeCommands";

// Debug output to verify env loaded
console.log("Env loaded, token exists:", !!process.env.DISCORD_TOKEN);

// Setup minimal client
const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  logger: { level: LogLevel.Info },
});

// Initialize the client
client.once("ready", async () => {
  console.log("Client is ready, purging commands...");

  // Purge commands based on environment
  if (process.env.NODE_ENV === "production") {
    // In production, be careful with global commands
    console.log("Purging guild commands in production");
    purgeGuildCommands(client);
  } else {
    // In development, purge both
    console.log("Purging all commands in development");
    purgeGuildCommands(client);
    // Uncomment below if you want to purge global commands in dev
    // purgeGlobalCommands(client)
  }

  // Exit after timeout to ensure API requests complete
  setTimeout(() => {
    console.log("Purge complete, shutting down");
    process.exit(0);
  }, 2000);
});

// Login
client.login(process.env.DISCORD_TOKEN);
