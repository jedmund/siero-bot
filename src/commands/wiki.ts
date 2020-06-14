// import { Message } from 'discord.js'
import { Command } from 'discord-akairo'
import { Wiki } from '../services/wiki.js'

// interface WikiArgs {
//     operation: string
//     object: string | null
//     section: string | null
// }

class WikiCommand extends Command {
    constructor() {
        super('wiki', {
            aliases: ['wiki', 'w'],
            args: [
                { id: 'operation' },
                { id: 'object' },
                { id: 'section' }
            ]
        })
    }

    exec() {
        console.log('Hello world')!

        new Wiki()
    }
}

module.exports = WikiCommand