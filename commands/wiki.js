const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

class WikiCommand extends Command {
    constructor() {
        super('wiki', {
            aliases: ['wiki', 'w'],
            args: [
                {
                    id: 'object',
                    type: 'string'
                },
                {
                    id: 'entry',
                    type: 'string'
                },
                {
                    id: 'section',
                    type: 'string'
                }
            ]
        })
    }

    exec(message, args) {
        switch(args.operation) {
            case "yolo":
                yolo(message, args)
                break
            case "ten":
                ten_pull(message, args)
                break
            case "spark":
                spark(message, args)
                break
            case "help":
                help(message)
                break
            default:
                break
        }
    }
}

module.exports = WikiCommand