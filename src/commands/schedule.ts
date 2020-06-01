
import { Message, MessageEmbed } from 'discord.js'
import { Command } from 'discord-akairo'
import { promises as fs } from 'fs'

// import common from '../helpers/common.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'
dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

const path = require('path')



class ScheduleCommand extends Command {
    schedule: { [key: string]: [ { [key: string]: string }] } = {}
    message: Message

    constructor() {
        super('schedule', {
            aliases: ['schedule', 'sc'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: 'show'
                }
            ]
        })
    }

    public async exec(message: Message, args: { operation: string }) {
        this.message = message
        console.log(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`)

        await this.load()
            .then(() => {
                this.switchOperation(args.operation)
            })
    }

    private switchOperation(operation: string) {
        switch (operation) {
            case 'show':
                this.show()
                break
            case 'next':
                this.next()
                break
            case 'current':
                this.current()
                break
            default:
                break
        }
    }

    // Command methods
    private async show() {
        let embed = this.renderSchedule()
        this.message.channel.send(embed)
    }

    private next() {
        const embed = this.renderEvent(this.schedule.events[1], false)
        this.message.channel.send(embed)
    }

    private current() {
        const embed = this.renderEvent(this.schedule.events[0])
        this.message.channel.send(embed)
    }

    // File methods
    private async load() {
        const schedule = path.join(__dirname, '..', '..', '..', 'src', 'resources', 'schedule.json')
        const data = await fs.readFile(schedule, 'utf8')

        this.schedule = JSON.parse(data)
    }

    // Render methods
    private renderSchedule() {
        let embed = new MessageEmbed({
            title: 'Schedule'
        })

        return embed
    }

    private renderEvent(event: { [key: string]: string }, currentEvent: boolean = true) {
        let embed = new MessageEmbed({
            color: 0xdc322f
        })

        const keys = Object.keys(event)
        for (var i = 0; i < keys.length; i++) {
            const key = keys[i]
            const readableKey = this.capitalize(keys[i].replace('-', ' '))

            if (currentEvent && key !== 'starts') {
                
            }

            if (!currentEvent && key === 'starts') {
                const formattedTo = dayjs().to(event[key])
                const formattedTime = dayjs(event[key]).format('LLLL')
                embed.addField(`${readableKey} ${formattedTo}`, `${formattedTime} JST`)
            }

            if (key === 'banner') {
                embed.setImage(event[key])
            }

            if (key === 'name') {
                embed.setTitle(event[key].en)
            }
            
            if (key === 'type') {
                embed.setAuthor(this.capitalize(event[key]))
            }
            
            if (currentEvent && key === 'ends') {
                const formattedTo = dayjs().to(event[key])
                const formattedTime = dayjs(event[key]).format('LLLL')
                embed.addField(`${readableKey} ${formattedTo}`, `${formattedTime} JST`)
            }

            if (!currentEvent && key === 'ends') {
                const formattedTime = dayjs(event[key]).format('LLLL')
                embed.addField(readableKey, `${formattedTime} JST`)
            }
            
            if (key === 'advantage') {
                embed.addField(readableKey, this.capitalize(event[key]))
            }
        }

        return embed
    }

    private capitalize(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1)
    }
}

module.exports = ScheduleCommand
