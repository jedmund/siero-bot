import { Message } from 'discord.js'
import { Command } from 'discord-akairo'

const dayjs = require('dayjs')

export class SieroCommand extends Command {
    args: { [key: string]: any } = {}
    commandType: string = ''
    message!: Message

    public log(message: Message): void {
        const string = `(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`
        console.log(string)
    }
}