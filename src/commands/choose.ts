import { Message } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

class ChooseCommand extends SieroCommand {
    public constructor() {
        super('choose', {
            aliases: ['choose', 'pick', 'ch'],
            args: [{ id: 'options' }]
        })
    }

    public exec(message: Message) {
        this.log(message)

        const options: string[] = this.parseRequest(message.content)
        const hash: number = this.hash(message.author.id + message.content, options.length)
        const choice: string = options[hash]

        const reply = (options.length > 1) ?
            `Hmm... I choose **${choice}**!` :
            `Um... you only gave me one thing to choose from!`

        message.reply(reply)
    }

    private parseRequest(request: string): string[] {
        const splitRequest: string[] = request.split('?')
        return splitRequest[splitRequest.length - 1].split(',').map(Function.prototype.call, String.prototype.trim)
    }

    private hash(string: string, size: number): number {
        let hash = 0
        for (let x = 0; x < string.length; x++) {
            hash += string.charCodeAt(x)
        }
        return (hash % size)
    }
}

module.exports = ChooseCommand
