import { Message, Presence, PresenceStatusData } from 'discord.js'
import { Command } from 'discord-akairo'

const common = require('../helpers/common.js')
const dayjs = require('dayjs')
const pluralize = require('pluralize')

interface AdminArgs {
    operation: string
    string: string | undefined
}

class AdminCommand extends Command {
    commandType: string = 'admin'

    message!: Message
    args: AdminArgs = {
        operation: '',
        string: undefined
    }

    public constructor() {
        super('admin', {
            aliases: ['admin'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: 'stats'
                },
                {
                    id: 'string',
                    type: 'string'
                }
            ],
            ownerOnly: true
        })
    }

    public exec(message: Message, args: AdminArgs) {
        console.log(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`)

        this.message = message
        this.args = args

        common.storeArgs(this, args)
        common.storeMessage(this, message)

        this.switchOperation()
    }

    private switchOperation() {
        switch(this.args.operation) {
            case 'stats':
                this.stats()
                break

            case 'activity':
                this.activity()
                break

            case 'status':
                this.status()
                break

            default:
                this.stats()
                break
        }
    }

    private stats() {
        const stats = `Currently running for ${this.client.users.cache.size} ${pluralize('user', this.client.users.cache.size)} in ${this.client.guilds.cache.size} ${pluralize('server', this.client.guilds.cache.size)}.`
        this.message.channel.send(stats)
    }

    private activity() {
        if (this.client.user) {
            const bot = this.client.user

            if (this.args.string) {
                bot.setActivity(this.args.string || '', {
                        type: 'PLAYING',
                        url: 'https://siero.app'
                    })
                    .then((value: Presence) => {
                        this.message.channel.send(`Activity successfully set to \`${value.activities[0].type.charAt(0).toUpperCase() + value.activities[0].type.slice(1).toLowerCase()} ${value.activities[0].name}\`.`)
                    })
                    .catch((error: Error) => {
                        this.message.channel.send('Sorry, there was a problem updating my activity.')
                        console.error(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.message.author.id}] ${error}`)
                    })
            } else {
                bot.setPresence({})
                    .then(() => {
                        this.message.channel.send(`Activity successfully cleared.`)
                    })
                    .catch((error: Error) => {
                        this.message.channel.send('Sorry, there was a problem clearing my activity.')
                        console.error(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.message.author.id}] ${error}`)
                    })
            }
        } else {
            this.message.channel.send('Sorry, there was a problem updating my activity.')
            console.error(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.message.author.id}] Could not instantiate bot user from client`)
        }
    }

    private status() {
        let status: PresenceStatusData = 'online'
        if (this.args.string === 'online' || this.args.string === 'idle' || this.args.string === 'dnd' || this.args.string === 'invisible') {
            status = this.args.string
        }
        
        if (this.client.user) {
            this.client.user.setStatus(status)
                .then((value: Presence) => {
                    this.message.channel.send(`Status successfully set to \`${value.status}\`.`)
                })
                .catch((error: Error) => {
                    this.message.channel.send('Sorry, there was a problem updating my status.')
                    console.error(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.message.author.id}] ${error}`)
                })
        } else {
            this.message.channel.send('Sorry, there was a problem updating my status.')
            console.error(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.message.author.id}] Could not instantiate bot user from client`)
        }
    }
}

module.exports = AdminCommand
