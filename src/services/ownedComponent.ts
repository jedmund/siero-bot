import {
  ComponentType,
  type Message,
  type MessageComponentInteraction,
} from "discord.js"
import { runtime } from "./lifecycle.js"

export function waitForOwnedComponent(
  message: Message,
  userId: string,
  customId: string,
  componentType: ComponentType.Button | ComponentType.StringSelect,
  timeout: number,
): Promise<MessageComponentInteraction> {
  runtime.assertAccepting()
  return new Promise((resolve, reject) => {
    const collector = message.createMessageComponentCollector({
      componentType,
      time: timeout,
      max: 1,
      filter: (interaction) =>
        interaction.user.id === userId && interaction.customId === customId,
    })
    const unregister = runtime.registerCleanup(() => collector.stop("shutdown"))
    collector.on("collect", (interaction) => resolve(interaction))
    collector.on("end", (collected) => {
      unregister()
      if (!collected.size) reject(new Error("Selection expired or cancelled"))
    })
  })
}
