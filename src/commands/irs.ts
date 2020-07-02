import { Message, MessageEmbed } from "discord.js"
import { SieroCommand } from '../helpers/SieroCommand'

class IRSCommand extends SieroCommand {
    constructor() {
        super('taxes', {
            aliases: ['taxes', 'payup', 'collectiontime', 'audit']
        })
    }

    exec(message: Message) {
        const embed = new MessageEmbed({
            color: this.embedColor,
            title: 'IWASSHAAAAY!',
            description: '…ムムムム？？？？？？？',
            image: { url: 'https://i.imgur.com/GhkS14Z.png' },
        })
        
        message.channel.send(embed)
    }
}

module.exports = IRSCommand
