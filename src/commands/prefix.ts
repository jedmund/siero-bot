import { Message, MessageEmbed } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

import { Client } from '../services/connection.js'

interface PrefixArgs {
    operation: string
    prefix: string | null
}

class PrefixCommand extends SieroCommand {
    commandType: string = 'prefix'

    public constructor() {
        super('prefix', {
            aliases: ['prefix'],
            args: [
                { id: 'operation' },
                { id: 'prefix' }
            ],
            channel: 'guild'
        })
    }

    public exec(message: Message, args: PrefixArgs) {
        this.log(message)

        this.args = args
        this.message = message

        this.switchOperation()
    }

    private switchOperation() {
        const operation = this.args?.operation

        switch (operation) {
            case 'set':
                this.set()
                break

            case 'help':
                this.help()
                break

            default:
                this.help()
                break
        }
    }

    // Command methods
    private set() {
        const regex: RegExp = /[!$%^&*~=:;?]*/

        const message = this.message!
        const guild = message.guild!
        const owner = guild.owner!
        const args = this.args!

        if (message.author.id === owner.id) {
            let matches: RegExpMatchArray | null | undefined = args.prefix?.match(regex)

            if (matches && matches[0]) {
                this.save(guild.id, matches[0])
            } else {
                this.invalidPrefix(args.prefix!)
            }
        } else {
            message.reply(`only the owner of **${guild.name}** can set the server's command prefix.`)
        }
    }

    private help() {
        const embed = new MessageEmbed({
            title: 'Command prefix',
            description: 'Welcome! You can set your server\'s command prefix with this command, but only if you\'re the server owner!',
            color: 0xdc322f,
            fields: [
                {
                    name: 'Command syntax',
                    value: '```set <prefix>```'
                },
                {
                    name: 'Supported characters',
                    value: '```! $ % ^ & * ~ = : ; ?```'
                }
            ]
        })
    
        this.message?.channel.send(embed)
    }

    // Database methods
    private save(guildId: string, prefix: string) {
        const sql = [
            'INSERT INTO guilds (id, prefix)',
            'VALUES ($1, $2)',
            'ON CONFLICT (id)',
            'DO UPDATE SET prefix = $2',
            'WHERE guilds.id = $1'
        ].join(' ')

        Client.none(sql, [guildId, prefix])
            .then(() => {
                const message = this.message!
                const guild = message.guild!

                message.channel.send(`The command prefix for **${guild.name}** has been changed to **${prefix}**.`)
            })
    }

    // Error methods
    private invalidPrefix(prefix: string) {
        const text = 'The character you supplied is not supported.'
        const error = `Unsupported prefix: ${prefix}`
        const section = {
            title: 'Supported characters',
            content: '```! $ % ^ & * ~ = : ; ?```'
        }

        this.reportError(error, text, false, section)
    }
}

module.exports = PrefixCommand
