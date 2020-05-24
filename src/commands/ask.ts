import { Message } from "discord.js"

const { Command } = require('discord-akairo')

const Answers = [
    "Yes",
    "Possibly",
    "What do you think?",
    "I don't think so",
    "Hmm... maybe!",
    "Fufufu~",
    "Hehehe!",
    "Definitely not",
    "Absolutely",
    "Not a chance",
    "No way",
    "Are you sure that's the right question?"
]

class AskCommand extends Command {
    constructor() {
        super('ask', {
            aliases: ['ask']
        })
    }

    exec(message: Message) {
        const reply = Answers[Math.floor(Math.random() * Answers.length)]
        message.reply(reply)
    }
}

module.exports = AskCommand
