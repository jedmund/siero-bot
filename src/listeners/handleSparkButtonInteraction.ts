import { Events, Listener } from "@sapphire/framework"
import { ButtonInteraction } from "discord.js"

import Gacha from "../services/gacha.js"

import { Promotion, Season } from "../utils/enums.js"
import fetchRateups from "../utils/fetchRateups.js"
import { RenderingUtils } from "../utils/rendering.js"
export class HandleSparkButtonInteractionListener extends Listener<
  typeof Events.InteractionCreate
> {
  public constructor(context: Listener.Context) {
    super(context, { event: Events.InteractionCreate })
  }

  public async run(interaction: ButtonInteraction) {
    if (
      !interaction.isButton() ||
      !interaction.customId.startsWith("copySpark:")
    )
      return

    // Ensure we have all parts: action, userId, gala, and season
    const parts = interaction.customId.split(":")
    if (parts.length < 4) return

    const [, sourceUserId, galaString, seasonString] = parts

    const gala = Promotion[galaString.toUpperCase() as keyof typeof Promotion]
    const season = Season[seasonString.toUpperCase() as keyof typeof Season]

    try {
      await interaction.deferReply()
      const rateups = await fetchRateups(sourceUserId)

      // Use the provided Gala for the Gacha instance
      const gacha = await Gacha.create(rateups, gala, season) // Ensure proper type for gala
      const result = await gacha.spark()

      const embed = RenderingUtils.renderSpark(result, rateups)
      await interaction.editReply({
        content: `Simulation using <@${sourceUserId}>’s current settings (including configured defaults).`,
        embeds: [embed],
      })
    } catch (error) {
      console.error("Error handling spark button interaction:", error)
      const payload = {
        content: "There was an error processing your request.",
      }
      if (interaction.deferred || interaction.replied)
        await interaction.editReply(payload)
      else await interaction.reply({ ...payload, ephemeral: true })
    }
  }
}
