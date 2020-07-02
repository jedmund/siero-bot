import { Message } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

const Answers: string[] = [
    'Yes',
    'Possibly',
    'What do you think?',
    'I don\'t think so',
    'Hmm... maybe!',
    'Fufufu~',
    'Hehehe!',
    'Definitely not',
    'Absolutely',
    'Not a chance',
    'No way',
    'Are you sure that\'s the right question?'
]

class AskCommand extends SieroCommand {
    public constructor() {
        super('ask', {
            aliases: ['ask']
        })
    }

    public exec(message: Message) {
        this.log(message)

        const hash = this.hash(message.author.id + message.content, Answers.length)
        message.reply(Answers[hash])
    }

    private hash(string: string, size: number): number {
        let hash = 0
        for (let x = 0; x < string.length; x++) {
            hash += string.charCodeAt(x)
        }
        return (hash % size)
    }
}

module.exports = AskCommand
