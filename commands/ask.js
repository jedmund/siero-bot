const { Command } = require('discord-akairo')

const Answers = [
    "Yes",
    "Possibly",
    "What do you think?",
    "I don't think so",
    "Hmm... maybe!",
    "Fufufu~",
    "Definitely not",
    "Absolutely",
    "Not a chance",
    "No way",
    "Are you sure that's the right question?"
]

class AskCommand extends Command {
    constructor() {
        super('ask', {
            aliases: ['ask'],
            trigger: ['\b<@539533389187776523>\b']
        })
    }

    exec(message) {
        console.log(message)
        message.reply(Answers[Math.floor(Math.random() * Answers.length)])
    }
}

module.exports = AskCommand