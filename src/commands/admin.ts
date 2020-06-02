import { Message } from 'discord.js'
import { Command } from 'discord-akairo'

const pluralize = require('pluralize')

class AdminCommand extends Command {
    constructor() {
        super('admin', {
            aliases: ['admin'],
            ownerOnly: true
        })
    }

    exec(message: Message) {
        const stats = `Currently running for ${this.client.users.cache.size} ${pluralize('user', this.client.users.cache.size)} in ${this.client.guilds.cache.size} ${pluralize('server', this.client.guilds.cache.size)}.`
        message.channel.send(stats)
    }
}

module.exports = AdminCommand
