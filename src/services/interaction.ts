import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js"
import { runtime } from "./lifecycle.js"
export async function acknowledge(interaction: ChatInputCommandInteraction, ephemeral = false) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral })
  runtime.assertAccepting()
}
export async function respond(interaction: ChatInputCommandInteraction, payload: string | Pick<InteractionReplyOptions, "content" | "embeds" | "components">) {
  if (interaction.deferred || interaction.replied) return await interaction.editReply(payload)
  return await interaction.reply(payload)
}
