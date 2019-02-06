const { Command } = require('discord-akairo')

class SparkCommand extends Command {
    constructor() {
        super('spark', {
            aliases: ['spark'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: 'status'
                },
                {
                    id: 'currency',
                    type: 'string',
                    default: null
                },
                {
                    id: 'amount',
                    type: 'number',
                    default: 0
                }
            ]
        })
    }

    exec(message, args) {
        return message.reply(`${args.operation} ${args.currency} ${args.amount}`)
    }
}

module.exports = SparkCommand