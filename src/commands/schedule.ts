
import { Message } from 'discord.js'
import { MessageEmbed } from 'discord.js'
import { Command } from 'discord-akairo'
import { promises as fs } from 'fs'

import common from '../helpers/common.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

const path = require('path')

interface Event {
    readonly [index: string]: string | LocalizedString | null
    name: LocalizedString
    type: string
    starts: string
    ends: string
    advantage: string | null
}

interface Month {
    month: string
    period: string
    events: {
        en: string[]
        jp: string[]
    }
}

interface Schedule {
    events: Event[]
    scheduled: Month[]
}

interface LocalizedString {
    en: string
    jp: string
}

class ScheduleCommand extends Command {
    message: Message
    schedule: Schedule = {
        events: [],
        scheduled: []
    }

    public constructor() {
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
        console.log(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`)

        common.storeMessage(this, message)

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

            case 'now':
                this.current()
                break

            case 'help':
                this.help()

            default:
                break
        }
    }

    // Command methods
    private async show() {
        const embed: MessageEmbed = this.renderSchedule()
        this.message.channel.send(embed)
    }

    private next(): void {
        const index: number = this.extractCurrentIndex() + 1
        const event: Event = this.schedule.events[index]
        const embed: MessageEmbed = this.renderEvent(event, false)

        this.message.channel.send(embed)
    }

    private current(): void {
        const index: number = this.extractCurrentIndex()
        const event: Event = this.schedule.events[index]
        const embed: MessageEmbed = this.renderEvent(event)

        this.message.channel.send(embed)
    }

    private help(): void {
        let options = [
            '```html\n',
            '<show>',
            'Show the upcoming schedule\n',
            '<now>',
            'Show the current event\n',
            '<next>',
            'Show the upcoming event```'
        ].join('\n')

        let link = 'https://github.com/jedmund/siero-bot/wiki/Viewing-the-schedule'

        var embed = new MessageEmbed({
            title: 'Schedule',
            description: 'Welcome! I can tell you what events are coming up in Granblue Fantasy!',
            color: 0xdc322f,
            fields: [
                {
                    name: 'Command syntax',
                    value: '```schedule <option>```'
                },
                {
                    name: 'Schedule options',
                    value: options
                },
                {
                    name: 'Full documentation',
                    value: link
                }
            ]
        })
    
        this.message.channel.send(embed)
    }

    // File methods
    private async load(): Promise<void> {
        const schedule: string = path.join(__dirname, '..', '..', '..', 'src', 'resources', 'schedule.json')
        const data: string = await fs.readFile(schedule, 'utf8')

        this.schedule = JSON.parse(data)
    }

    // Render methods
    private renderSchedule(): MessageEmbed {
        const events: Event[] = this.schedule.events
        
        let embed: MessageEmbed = new MessageEmbed({
            title: 'Schedule'
        })

        for (let i in events) {
            let event: Event = events[i]
            
            const isCurrentEvent: boolean = (dayjs(event.starts).isBefore(dayjs()) && dayjs(event.ends).isAfter(dayjs()))
            const startsString: string = `<Starts in ${dayjs().to(event.starts, true)}>\n${dayjs(event.starts).format('LLLL')} JST`
            const endsString: string = `<Ends in ${dayjs().to(event.ends, true)}>\n${dayjs(event.ends).format('LLLL')} JST`
            const dateString: string = (isCurrentEvent) ? endsString : startsString

            let duration: string = `\`\`\`html\n${dateString}\n\`\`\``
            embed.addField(event.name.en, duration)
        }

        return embed
    }

    private renderEvent(event: Event, currentEvent: boolean = true): MessageEmbed {
        let embed = new MessageEmbed({
            color: 0xdc322f
        })

        const keys = Object.keys(event)
        for (var i = 0; i < keys.length; i++) {
            const key: string = keys[i]
            const readableKey: string = this.capitalize(keys[i].replace('-', ' '))

            if (currentEvent && key !== 'starts') {
                // do nothing
            }

            if (!currentEvent && key === 'starts') {
                const formattedTo: string = dayjs().to(event[key])
                const formattedTime: string = dayjs(event[key]).format('LLLL')

                embed.addField(`${readableKey} ${formattedTo}`, `${formattedTime} JST`)
            }

            if (key === 'banner') {
                if (typeof event[key] === "string") {
                    embed.setImage(event[key] as string)
                }
            }

            if (key === 'name') {
                embed.setTitle(event[key].en)
            }
            
            if (key === 'type') {
                embed.setAuthor(this.capitalize(event[key]))
            }
            
            if (currentEvent && key === 'ends') {
                const formattedTo: string = dayjs().to(event[key])
                const formattedTime: string = dayjs(event[key]).format('LLLL')

                embed.addField(`${readableKey} ${formattedTo}`, `${formattedTime} JST`)
            }

            if (!currentEvent && key === 'ends') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                embed.addField(readableKey, `${formattedTime} JST`)
            }
            
            if (key === 'advantage' && event[key]) {
                const advantage: string = event[key]!
                embed.addField(readableKey, this.capitalize(advantage))
            }
        }

        return embed
    }

    // Helper methods
    private capitalize(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1)
    }

    private extractCurrentIndex(): number {
        let found: boolean = false
        let n: number = 0

        while (!found) {
            const event: Event = this.schedule.events[n]

            const startsBeforeNow: boolean = dayjs(event.starts).isBefore(dayjs())
            const endsAfterNow: boolean = dayjs(event.ends).isAfter(dayjs())

            if (startsBeforeNow && endsAfterNow) {
                found = true
                return n
            }

            n++
        }

        return n
    }
}

module.exports = ScheduleCommand
