
import { Message, MessageEmbed } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'
import { Pager, Page, PageConfig, Section } from '../services/pager'
import { promises as fs } from 'fs'

import isBetween from 'dayjs/plugin/isBetween'
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import dayjsPluginUTC from 'dayjs-plugin-utc'

const pluralize = require('pluralize')

const dayjs = require('dayjs')
const preciseDiff = require('dayjs-precise-range')

dayjs.extend(isBetween)
dayjs.extend(relativeTime)
dayjs.extend(preciseDiff)
dayjs.extend(localizedFormat)
dayjs.extend(dayjsPluginUTC)

const path = require('path')

type NumberObject = { [key: string]: number }
type NullableNumber = number | null

interface Event {
    readonly [index: string]: string | LocalizedString | string[] | null
    name: LocalizedString
    type: string
    starts: string
    ends: string
    advantage: string | null
    info: string[]
    banner: string | null
    link: string | null
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
    maintenance: Duration | null
    magfest: Event | null
    events: Event[]
    scheduled: Month[],
    streams: Event[]
}

interface LocalizedString {
    en: string
    jp: string
}

interface Duration {
    starts: string,
    ends: string
}

class ScheduleCommand extends SieroCommand {
    schedule: Schedule = {
        maintenance: null,
        events: [],
        streams: [],
        scheduled: [],
        magfest: null
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
        this.log(message)

        this.message = message

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

            case 'magfest':
                this.magfest()
                break

            case 'help':
                this.help()

            default:
                break
        }
    }

    // Command methods
    private async show() {
        let pager: Pager = new Pager(this.message.author)
        
        // const upcomingEvents = this.renderEvents('Upcoming', this.schedule.events)

        // let eventSchedule: Page = new Page('', upcomingEvents)
        // let featureSchedule: Page = new Page('These features have been announced.')

        pager.addPage('🕒', this.renderRightNow())
        pager.addPage('📅', this.renderUpcoming())
        // pager.addPage('❓', featureSchedule)

        // pager.selectPage('🛠')
        pager.listPages()

        pager.render(this.message)
        
        // let embed: MessageEmbed = this.renderList(this.schedule.events)

        // const eventInfo = this.renderServiceEvent()
        // const streamInfo = this.renderStreamEvent()

        // const name = (streamInfo.name) ? streamInfo.name : eventInfo.name

        // let description = ''
        // if (streamInfo.description && eventInfo.description) {
        //     description = `${streamInfo.description}\n\n**${eventInfo.name}**\n${eventInfo.description}`
        // } else if (streamInfo.description && !eventInfo.description) {
        //     description = streamInfo.description
        // } else {
        //     description = eventInfo.description
        // }

        // embed.setTitle(name)
        // embed.setDescription(description)
        // embed.setImage(eventInfo.image)

        // this.message!.channel.send(embed)
    }

    private next(): void {
        const event: Event | null = this.nextEvent()

        if (event) {
            const embed: MessageEmbed = this.renderEvent(event, false)
            this.message!.channel.send(embed)
        } else {
            this.message!.channel.send('There is no event scheduled next. Is this the end?')
        }
    }

    private current(): void {
        if (this.schedule.maintenance && dayjs().isBetween(dayjs(this.schedule.maintenance.starts), dayjs(this.schedule.maintenance.ends))) {
            const parts: NumberObject = dayjs.preciseDiff(dayjs(), this.schedule.maintenance.ends, true)
            const difference = this.buildString(null, parts.hours, parts.minutes)
            const embed = new MessageEmbed({
                title: 'Maintenance',
                description: `Granblue Fantasy is currently undergoing maintenance.\n\nIt will end in **${difference}**.\n\u00A0`
            })

            this.message!.channel.send(embed)
        } else {
            const currentEvents: Event[] = this.currentEvents()

            if (currentEvents.length == 1) {
                const embed: MessageEmbed = this.renderEvent(currentEvents[0])
                this.message!.channel.send(embed)
            } else if (currentEvents.length > 1) {
                const embed: MessageEmbed = this.renderList(currentEvents)
                this.message!.channel.send(embed)
            } else {
                this.message!.channel.send('There is no event running right now. Use `$schedule next` to find out what event is running next.')
            }
        }
    }

    private renderRightNow(): Page {
        const currentEvents: Event[] = this.currentEvents()
        let prefixSections: Section[] = []
        
        const { section: magfestInfo, image: magfestImage } = this.renderMagfestEvent() || {}
        const maintenanceInfo = this.renderMaintenanceEvent()

        if (maintenanceInfo) {
            prefixSections.push(maintenanceInfo)
        }

        if (magfestInfo) {
            prefixSections.push(magfestInfo)
        }
        const image = (this.magfest) ? magfestImage : currentEvents[0].banner

        const streamInfo = this.renderStreamEvent()
        const title = (streamInfo && streamInfo.name) ? streamInfo.name : 'Right Now'
        const description = (streamInfo && streamInfo.value) ? streamInfo.value : ''

        let page: Page
        if (currentEvents.length == 1 && 
            magfestInfo == null && maintenanceInfo == null && streamInfo == null) {
            page = this.renderSingleEvent(currentEvents[0])
        } else if (currentEvents.length > 1) {
            page = this.renderEvents({ 
                title: title,
                description: description,
                image: image || undefined
            }, currentEvents, prefixSections)
        } else {
            page = new Page({
                title: title,
                description: 'There is no event running right now.'
            })
        }

        return page
    }

    private renderUpcoming(): Page {
        const title = 'Upcoming'
        return this.renderEvents({
            title: title
        }, this.schedule.events)
    }

    private magfest(): void {
        const isMagfest = this.schedule.magfest && dayjs().isBetween(dayjs(this.schedule.magfest.starts), dayjs(this.schedule.magfest.ends))
        const upcomingMagfest = this.schedule.magfest && dayjs(this.schedule.magfest.starts).isBetween(dayjs(), dayjs().add(48, 'hours'))

        if (isMagfest || upcomingMagfest) {
            const embed: MessageEmbed = this.renderMagfest()
            this.message!.channel.send(embed)
        } else {
            this.message?.channel.send('There is no upcoming magfest right now.')
        }
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
    
        this.message!.channel.send(embed)
    }

    // File methods
    private async load(): Promise<void> {
        const schedule: string = path.join(__dirname, '..', '..', '..', 'src', 'resources', 'schedule.json')
        const data: string = await fs.readFile(schedule, 'utf8')

        this.schedule = JSON.parse(data)
    }

    // Render methods
    private renderList(events: Event[]): MessageEmbed {        
        let embed: MessageEmbed = new MessageEmbed({
            title: 'Schedule'
        })

        for (let i in events) {
            let event: Event = events[i]

            if (dayjs(event.ends).isAfter(dayjs())) {
                const startsDiffString = `<Starts in ${this.buildDiffString(event.starts)}>`
                const endsDiffString = `<Ends in ${this.buildDiffString(event.ends)}>`
                
                const isCurrentEvent: boolean = (dayjs(event.starts).isBefore(dayjs()) && dayjs(event.ends).isAfter(dayjs()))

                const startsString: string = `${startsDiffString}\n${dayjs(event.starts).format('LLLL')} JST`
                const endsString: string = `${endsDiffString}\n${dayjs(event.ends).format('LLLL')} JST`
                const dateString: string = (isCurrentEvent) ? endsString : startsString

                let duration: string = `\`\`\`html\n${dateString}\n\`\`\``
                embed.addField(event.name.en, duration)
            }
        }

        return embed
    }

    private renderEvents(config: PageConfig, events: Event[], prefixes: (Section | null)[] = []): Page {
        let sections = prefixes

        for (let i in events) {
            let event: Event = events[i]

            if (dayjs(event.ends).isAfter(dayjs())) {
                const startsDiffString = `<Starts in ${this.buildDiffString(event.starts)}>`
                const endsDiffString = `<Ends in ${this.buildDiffString(event.ends)}>`
                
                const isCurrentEvent: boolean = (dayjs(event.starts).isBefore(dayjs()) && dayjs(event.ends).isAfter(dayjs()))

                const startsString: string = `${startsDiffString}\n${dayjs(event.starts).format('LLLL')} JST`
                const endsString: string = `${endsDiffString}\n${dayjs(event.ends).format('LLLL')} JST`
                const dateString: string = (isCurrentEvent) ? endsString : startsString

                let duration: string = `\`\`\`html\n${dateString}\n\`\`\``
                
                sections.push({
                    name: event.name.en,
                    value: duration
                })
            }
        }

        return new Page(config, sections)
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
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                embed.addField(`${readableKey}`, `${formattedTime} JST`)
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
                if (currentEvent) {
                    embed.setAuthor(`Ends in ${this.buildDiffString(event['ends'])}`)
                } else {
                    embed.setAuthor(`Starts in ${this.buildDiffString(event['starts'])}`)
                }
            }
            
            if (currentEvent && key === 'ends') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                embed.addField(`${readableKey}`, `${formattedTime} JST`)
            }

            if (!currentEvent && key === 'ends') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                embed.addField(readableKey, `${formattedTime} JST`)
            }
            
            if (key === 'advantage' && event[key]) {
                const advantage: string = event[key]!
                embed.addField(readableKey, this.capitalize(advantage))
            }
            
            if (key === 'link') {
                embed.addField('Wiki', event[key])
            }
        }

        return embed
    }

    private renderSingleEvent(event: Event, currentEvent: boolean = true): Page {
        let config: PageConfig = {
            title: '',
            description: '',
            author: '',
            image: ''
        }

        let sections: Section[] = []

        const keys = Object.keys(event)
        for (var i = 0; i < keys.length; i++) {
            const key: string = keys[i]
            const readableKey: string = this.capitalize(keys[i].replace('-', ' '))

            if (currentEvent && key !== 'starts') {
                // do nothing
            }

            if (key === 'banner') {
                if (typeof event[key] === "string") {
                    config.image = event[key] as string
                }
            }

            if (key === 'name') {
                config.title = event[key].en
            }

            if (key === 'type') {
                if (currentEvent) {
                    config.author = `Ends in ${this.buildDiffString(event['ends'])}`
                } else {
                    config.author = `Starts in ${this.buildDiffString(event['starts'])}`
                }
            }

            if (!currentEvent && key === 'starts') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                sections.push({
                    name: `${readableKey}`,
                    value: `${formattedTime} JST`
                })
            }
            
            if (currentEvent && key === 'ends') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                sections.push({
                    name: `${readableKey}`, 
                    value: `${formattedTime} JST`
                })
            }

            if (!currentEvent && key === 'ends') {
                const formattedTime: string = dayjs(event[key]).format('LLLL')
                sections.push({
                    name: `${readableKey}`, 
                    value: `${formattedTime} JST`
                })
            }
            
            if (key === 'advantage' && event[key]) {
                const advantage: string = event[key]!
                sections.push({
                    name: readableKey,
                    value: this.capitalize(advantage)
                })
            }
            
            if (key === 'link') {
                sections.push({
                    name: 'Wiki', 
                    value: event[key] || ''
                })
            }
        }

        return new Page(config, sections)
    }

    private renderMagfest(): MessageEmbed {
        let embed = new MessageEmbed({
            color: 0xdc322f
        })

        const isMagfest = this.schedule.magfest && dayjs().isBetween(dayjs(this.schedule.magfest.starts), dayjs(this.schedule.magfest.ends))

        if (this.schedule.magfest) {
            const magfest = this.schedule.magfest

            embed.setTitle(magfest.name)

            if (magfest.banner) {
                embed.setImage(magfest.banner)
            }

            if (isMagfest) {
                embed.setAuthor(`Ends in ${this.buildDiffString(magfest.ends)}`)
            } else {
                embed.setAuthor(`Starts in ${this.buildDiffString(magfest.starts)}`)
            }

            embed.addField('Wiki', magfest.wiki)
            embed.addField('Content', `\`\`\`${magfest.info.join('\n')}\`\`\``)
        }

        return embed
    }

    private renderStreamEvent(): Section | null {
        let name = ''
        let description = ''

        for (let i in this.schedule.streams) {
            const stream = this.schedule.streams[i]

            const isLive = dayjs().isBetween(dayjs(stream.starts), dayjs(stream.ends))
            const liveSoon = dayjs(stream.starts).isBetween(dayjs(), dayjs().add(7, 'days'))

            if (isLive) {
                name = `${stream.name.en} is live now!`
                description = `Airing live right now \u2192 ${stream.link}\n\u200e`
                break
            } else if (liveSoon) {
                name = `${stream.name.en} airs soon!`
                description = `Live in **${this.buildDiffString(stream.starts)}**.\n\nTune in \u2192 ${stream.link}\n\u200e`
                break
            }
        }

        return (name && description) ? {
            name: name,
            value: description
        } : null
    }

    private renderMaintenanceEvent(): Section | null {
        let name = ''
        let description = ''

        const isMaintenance = this.schedule.maintenance && dayjs().isBetween(dayjs(this.schedule.maintenance.starts), dayjs(this.schedule.maintenance.ends))
        const upcomingMaintenance = this.schedule.maintenance && dayjs(this.schedule.maintenance.starts).isBetween(dayjs(), dayjs().add(48, 'hours'))

        if (this.schedule.maintenance) {
            if (upcomingMaintenance) {
                const parts: NumberObject = dayjs.preciseDiff(dayjs(this.schedule.maintenance.starts).utcOffset(540), dayjs(this.schedule.maintenance.ends), true)
                const difference = this.buildDiffString(this.schedule.maintenance.starts)
                const duration = this.buildString(null, parts.days, parts.hours)
                
                name = 'Upcoming Maintenance'
                description = `Granblue Fantasy will be undergoing maintenance in **${difference}**.\nMaintenance will last for **${duration}**.\n\u200e`
            } else if (isMaintenance) {
                const difference = this.buildDiffString(this.schedule.maintenance.ends)

                name = 'Maintenance'
                description = `Granblue Fantasy will be undergoing maintenance for the next **${difference}**.\n\u200e`
            }
        }

        return (name && description) ? {
            name: name,
            value: description
        } : null
    }

    private renderMagfestEvent(): { section: Section, image: string } | null {
        let name = ''
        let description = ''
        let image = ''

        const isMagfest = this.schedule.magfest && dayjs().isBetween(dayjs(this.schedule.magfest.starts), dayjs(this.schedule.magfest.ends))
        const upcomingMagfest = this.schedule.magfest && dayjs(this.schedule.magfest.starts).isBetween(dayjs(), dayjs().add(48, 'hours'))

        if (this.schedule.magfest) {
            if (upcomingMagfest) {
                const parts: NumberObject = dayjs.preciseDiff(dayjs(this.schedule.magfest.starts).utcOffset(540), dayjs(this.schedule.magfest.ends), true)
                const difference = this.buildDiffString(this.schedule.magfest.starts)
                const duration = this.buildString(null, parts.days, parts.hours)
                
                name = `${this.schedule.magfest.name.en} coming soon!`
                description = `The ${this.schedule.magfest.name.en} starts in **${difference}**! It will last for **${duration}**.\n\u200e`
            } else if (isMagfest) {
                const difference = this.buildDiffString(this.schedule.magfest.ends)

                name = this.schedule.magfest.name.en
                image = (this.schedule.magfest.banner) ? this.schedule.magfest.banner : ''
                description = `The ${this.schedule.magfest.name.en} is underway for the next **${difference}**.\n\u200e`
            }
        }

        return (name && description) ? {
            section: {
                name: name,
                value: description
            },
            image: image
        } : null
    }

    // Helper methods
    private capitalize(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1)
    }

    private currentEvents(): Event[] {
        let currentEvents: Event[] = []

        for (let i in this.schedule.events) {
            const event: Event = this.schedule.events[i]

            if (dayjs().isBetween(dayjs(event.starts), dayjs(event.ends))) {
                currentEvents.push(event)
            }
        }

        return currentEvents
    }

    private nextEvent(): Event | null {
        let found: boolean = false
        let n: number = 0
        let event: Event | null = null

        while (!found) {
            const e: Event = this.schedule.events[n]

            const startsAfterNow: boolean = dayjs(e.starts).isAfter(dayjs())

            if (startsAfterNow) {
                found = true
                event = e
            }

            n++
        }

        return event
    }

    private buildDiffString(date: string): string {
        let string = ''
        const parts: NumberObject = dayjs.preciseDiff(dayjs().utcOffset(540), date, true)

        const threshold = dayjs().utcOffset(540).add(2, 'day')
        const afterThreshold: boolean = dayjs(threshold).isAfter(date)

        if (afterThreshold) {
            string = `${this.buildString(parts.months, parts.days, parts.hours, parts.minutes)}`
        } else {
            string = `${this.buildString(parts.months, parts.days)}`
        }

        return string
    }

    private buildString(m: NullableNumber = null, d: NullableNumber = null, h: NullableNumber = null, mm: NullableNumber = null, s: NullableNumber = null): string {
        let string = ''
        let strings = []

        if (m && d) {
            strings.push(`${m} ${pluralize('month', m)} ${d} ${pluralize('day', d)}`)
        } else if (d) {
            strings.push(`${d} ${pluralize('day', d)}`)
        }

        if (h) {
            strings.push(`${h} ${pluralize('hour', h)}`)
        }

        if (mm) {
            strings.push(`${mm} ${pluralize('minute', mm)}`)
        }
        
        if (s) {
            strings.push(`${s} ${pluralize('second', s)}`)
        }

        for (let i = 0; i < strings.length; i++) {
            if (i == strings.length - 2) {
                string += strings[i] + ' and '
            } else if (i < strings.length - 1) {
                string += strings[i] + ' '
            } else {
                string += strings[i]
            }
        }

        return string
    }
}

module.exports = ScheduleCommand
