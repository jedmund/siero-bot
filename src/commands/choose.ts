import { SlashCommandStringOption } from "discord.js"
import { Command } from "@sapphire/framework"

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const COMMAND_ID =
  process.env.NODE_ENV === "production" ? "" : "1110730712241406013"

const NUM_MAX_CHOICES = 8

export class ChooseCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      description: `Chooses between up to ${NUM_MAX_CHOICES} options`,
    })
  }
  // Methods: Register application commands

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        const generated = builder //
          .setName(this.name)
          .setDescription(this.description)

        for (let i = 0; i < NUM_MAX_CHOICES; i++) {
          generated.addStringOption(
            this.choiceOption(i + 1, i === 0 || i === 1)
          )
        }

        generated.addBooleanOption((option) => {
          return option
            .setName("final")
            .setDescription(
              "Siero won't change her mind for the rest of the day"
            )
        })

        return generated
      },
      {
        idHints: [COMMAND_ID],
      }
    )
  }

  private choiceOption(number: number, required: boolean = false) {
    let optionBuilder: SlashCommandStringOption = new SlashCommandStringOption()

    optionBuilder.setName(`option${number}`)
    optionBuilder.setDescription("An option to choose from")
    optionBuilder.setRequired(required)

    return optionBuilder
  }

  public override chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const choices = this.getChoices(interaction)
    const final = interaction.options.getBoolean("final") || false
    const hash: number = this.hash(
      interaction.user.id + choices.join(","),
      choices.length
    )

    const randomChoiceIndex = (choices.length * Math.random()) | 0
    const newChoice = choices[randomChoiceIndex]

    const strings = [
      "Hmmm... I choose",
      "How about",
      "Let's go with",
      "I suggest",
    ]
    const randomStringIndex = (strings.length * Math.random()) | 0

    const choice = final ? choices[hash] : newChoice
    const finalString = final ? "That's my final answer!" : ""

    const reply = [
      `${strings[randomStringIndex]}...`,
      `**${choice}**!`,
      finalString,
    ].join(" ")

    interaction.reply(reply)
  }

  private getChoices(interaction: Command.ChatInputCommandInteraction) {
    let choices = []

    for (let i = 0; i < NUM_MAX_CHOICES; i++) {
      const choice = interaction.options.getString(`option${i + 1}`)
      if (choice) choices.push(choice)
    }
    return choices
  }

  private hash(string: string, size: number): number {
    let hash = 0
    for (let x = 0; x < string.length; x++) {
      hash += string.charCodeAt(x)
    }
    return hash % size
  }
}
