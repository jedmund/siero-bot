import { Events, Listener } from "@sapphire/framework"
import { ButtonInteraction } from "discord.js"

import Gacha from "../services/gacha"
import Api from "../services/api"

import { Promotion, Season } from "../utils/enums"
import fetchRateups from "../utils/fetchRateups"
import { RenderingUtils } from "../utils/rendering"
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
    const destinationUserId = interaction.user.id

    const gala = Promotion[galaString.toUpperCase() as keyof typeof Promotion]
    const season = Season[seasonString.toUpperCase() as keyof typeof Season]

    try {
      // Copy rateups from source to destination user
      await Api.copyRateups(sourceUserId, destinationUserId)

      // Fetch the copied rateups for the destination user
      const rateups = await fetchRateups(destinationUserId)

      // Use the provided Gala for the Gacha instance
      const gacha = new Gacha(rateups, gala, season) // Ensure proper type for gala
      const result = gacha.spark()

      const embed = RenderingUtils.renderSpark(result, rateups)
      await interaction.reply({ embeds: [embed] })
    } catch (error) {
      console.error("Error handling spark button interaction:", error)
      await interaction.reply({
        content: "There was an error processing your request.",
        ephemeral: true,
      })
    }
  }
}
