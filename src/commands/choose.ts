import { Message } from 'discord.js'
import { Command } from 'discord-akairo'

class ChooseCommand extends Command {
    constructor() {
        super('choose', {
            aliases: ['choose', 'pick', 'ch'],
            args: [
                {
                    id: 'options',
                    type: 'string'
                }
            ]
        })
    }

    exec(message: Message) {
        console.log(`[${message.author.id}] ${message.content}`)

        let options: string[] = this.parseRequest(message.content)
        const reply: string = options[Math.floor(Math.random() * options.length)]

        message.reply(`Hmm... I choose ${reply}!`)
    }

    private parseRequest(request: string): string[] {
        let options: string[] = []
        const splitRequest: string[] = request.split(' ').splice(1).join('').split(',')

        for (let i in splitRequest) {
            options.push(splitRequest[i].trim())
        }

        return options
    }
}

module.exports = ChooseCommand
