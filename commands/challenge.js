const { Command } = require('discord-akairo')

class ChallengeCommand extends Command {
    constructor() {
        super('challenge', {
            aliases: ['challenge'],
        })
    }

    exec(message) {
        message.channel.send("I'm Siero!")
    }
}

module.exports = ChallengeCommand