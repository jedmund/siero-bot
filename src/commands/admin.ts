require('dotenv').config()

import { Message } from "discord.js"

const { Command } = require('discord-akairo')

const pluralize = require('pluralize')

class AdminCommand extends Command {
    constructor() {
        super('admin', {
            aliases: ['admin']
        })
    }

    exec(message: Message) {
        if (message.author.id == process.env.OWNER_ID) {
            const stats = `Currently running for ${this.client.users.cache.size} ${pluralize('user', this.client.users.cache.size)} in ${this.client.guilds.cache.size} ${pluralize('server', this.client.guilds.cache.size)}.`
            message.channel.send(stats)
        }
    }
}

module.exports = AdminCommand
