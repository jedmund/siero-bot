import { Message } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

interface ChooseArgs {
    choices: string
}

class ChooseCommand extends SieroCommand {
    public constructor() {
        super('choose', {
            aliases: ['choose', 'pick', 'ch'],
            args: [{ id: 'choices' }],
            separator: ';'
        })
    }

    public exec(message: Message, args: ChooseArgs) {
        this.log(message)

        const options: string[] = args.choices.split(',').map(Function.prototype.call, String.prototype.trim)
        const hash: number = this.hash(message.author.id + message.content, options.length)
        const choice: string = options[hash]

        const reply = (options.length > 1) ?
            `Hmm... I choose **${choice}**!` :
            `Um... you only gave me one thing to choose from!`

        message.reply(reply)
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
