const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

class IRSCommand extends Command {
    constructor() {
        super('taxes', {
            aliases: ['taxes', 'payup', 'collectiontime', 'audit']
        })
    }

    exec(message) {
        const embed = new MessageEmbed({
            color: 'C8232C',
            title: 'IWASSHAAAAY',
            description: '…ムムムム？？？？？？？',
            image: { url: 'https://i.imgur.com/GhkS14Z.png' },
        })
        message.channel.send(embed)
    }
}

module.exports = IRSCommand
