import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js"
import type DrawableItem from "../interfaces/DrawableItem.js"
import { readableElement, readableRarity, readableType } from "./readable.js"

export function generateConflictOptions(items: DrawableItem[]) {
  return items.map((item) => {
    let description = `${readableType(item.type)} · ${readableRarity(
      item.rarity
    )} · ${readableElement(item.element)}`

    if (item.recruits) {
      description += ` · Recruits ${item.recruits.name.en}`
    }

    return new StringSelectMenuOptionBuilder()
      .setLabel(item.name.en)
      .setDescription(description)
      .setValue(item.granblue_id)
  })
}

export function generateConflictSelect(items: DrawableItem[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId("conflict")
    .setPlaceholder("Pick an item")
    .addOptions(generateConflictOptions(items))
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    select
  )

  return row
}
