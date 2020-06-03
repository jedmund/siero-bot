import { Message } from 'discord.js'
const { Listener } = require('discord-akairo')

class CommandBlockedListener extends Listener {
    constructor() {
        super('commandBlocked', {
            emitter: 'commandHandler',
            eventName: 'commandBlocked',
        });
    }

    async exec(message: Message, command: string, reason: string) {
        message.reply('Let\'s see... you don\'t have permission to use that command!')
        console.log(`${message.author.id} was blocked from using the command "${command}" because of ${reason}.`)
    }
}

module.exports = CommandBlockedListener