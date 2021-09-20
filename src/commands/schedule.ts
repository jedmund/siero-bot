
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
    maintenance: Duration[]
    magfests: Event[]
    events: Event[]
    roadmap: Patch[]
    scheduled: Month[]
    streams: Event[]
}

interface Cast {
    name: string,
    role: string
}

interface FestivalEvent {
    readonly [index: string]: string | number | LocalizedString | Cast[] | null
    name: LocalizedString
    day: number,
    starts: string,
    ends: string,
    cast: Cast[] | null
}

interface Patch {
    date: string
    features: Feature[]
    upcoming: boolean
}

interface Feature {
    name: string
    details: string
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
        maintenance: [],
        events: [],
        magfests: [],
        roadmap: [],
        streams: [],
        scheduled: [],
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

        await this.load('events.json')
            .then((events: Event[]) => {
                this.schedule.events = events
            })
            .then((): Promise<any> => {
                return this.load('roadmap.json')
            })
            .then((roadmap: Patch[]) => {
                this.schedule.roadmap = roadmap
            })
            .then((): Promise<any> => {
                return this.load('magfest.json')
            })
            .then((magfests: Event[]) => {
                this.schedule.magfests = magfests
            })
            .then((): Promise<any> => {
                return this.load('maintenance.json')
            })
            .then((maintenance: Duration[]) => {
                this.schedule.maintenance = maintenance
            })
            .then((): Promise<any> => {
                return this.load('streams.json')
            })
            .then((streams: Event[]) => {
                this.schedule.streams = streams
            })
            .then(() => {
                this.switchOperation(args.operation)
            })
    }

    private switchOperation(operation: string) {
        switch (operation) {
            case 'show':
                this.show()
                break

            case 'fes':
                this.festival()
                break

            case 'next':
                this.next()
                break

            case 'upcoming':
                this.upcoming()
                break

            case 'roadmap':
                this.roadmap()
                break

            default:
                break
        }
    }

    private createPager(): Pager {
        let pager: Pager = new Pager(this.message.author)

        pager.addPage('🕒', this.renderRightNow())
        pager.addPage('📅', this.renderUpcoming())
        pager.addPage('🔨', this.renderRoadmap())

        if (this.schedule.magfests.length > 1 && this.schedule.magfests.filter(this.isCurrent) ||
           (this.schedule.magfests.length == 1 && dayjs().isBetween(dayjs(this.schedule.magfests[0].starts), dayjs(this.schedule.magfests[0].ends)))) {
            pager.addPage('🎉', this.renderMagfest())
        }

        pager.addPage('❓', this.renderHelp())

        return pager
    }

    // Command methods
    private show() {        
        let pager: Pager = this.createPager()
        pager.render(this.message)
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

    private upcoming() {
        let pager: Pager = this.createPager()
        pager.selectPage('📅')
        pager.render(this.message)
    }

    private roadmap() {
        // TODO: Why doesn't this work?
        let pager: Pager = this.createPager()
        pager.selectPage('🔨')
        pager.render(this.message)
    }

    private async festival() {
        let pager: Pager = new Pager(this.message.author)

        pager.addPage('1️⃣', await this.renderFestival(1))
        pager.addPage('2️⃣', await this.renderFestival(2))

        pager.render(this.message)
    }

    // File methods
    private async load(filename: string = "events.json"): Promise<any> {
        const file: string = path.join(__dirname, '..', '..', '..', 'src', 'resources', 'schedule', filename)
        const data: string = await fs.readFile(file, 'utf8')

        return JSON.parse(data)
    }

    // Page render methods
    private renderRightNow(): Page {
        const currentEvents: Event[] = this.currentEvents()
        let prefixSections: Section[] = []
        
        let { section: magfestInfo, image: magfestImage } = this.renderMagfestEvent() || {}
        const maintenanceInfo = this.renderMaintenanceEvent()

        if (maintenanceInfo) {
            prefixSections.push(maintenanceInfo)
        }

        if (magfestInfo && this.schedule.magfests.length == 1 && dayjs().isBetween(dayjs(this.schedule.magfests[0].starts), dayjs(this.schedule.magfests[0].ends))) {
            prefixSections.push(magfestInfo)
        } else {
            magfestInfo = undefined
        }
        
        let image
        if (maintenanceInfo) {
            image = 'https://media.discordapp.net/attachments/436609998756249640/701883843375792280/maintanence.jpg'
        } else if (magfestImage) {
            image = magfestImage
        } else if (currentEvents.length > 1) {
            image = currentEvents[0].banner
        }

        const streamInfo = this.renderStreamEvent()
        const title = (streamInfo && streamInfo.name) ? streamInfo.name : 'Right Now'
        const description = (streamInfo && streamInfo.value) ? streamInfo.value : ''

        let page: Page
        if (currentEvents.length == 1 && 
            magfestInfo == null && maintenanceInfo == null && streamInfo == null) {
            page = this.renderSingleEvent(currentEvents[0])
        } else if (currentEvents.length >= 1) {
            page = this.renderEvents({ 
                title: title,
                description: description,
                image: image || undefined
            }, currentEvents, prefixSections)
        } else {
            page = this.renderEvents({
                title: title,
                description: 'There are no events running right now.'
            }, [], prefixSections)
        }

        return page
    }

    private renderUpcoming(): Page {
        const title = 'Upcoming Events'
        const events = this.upcomingEvents()
        return this.renderEvents({
            title: title,
            image: (events.length > 0 && events[0].banner != null) ? events[0].banner : undefined
        }, events)
    }

    private renderRoadmap(): Page {
        const roadmap: Patch[] = this.schedule.roadmap
        let patches: Section[] = []

        for (let i in roadmap) {
            const patch = roadmap[i]
            if (patch.upcoming) {
                patches.push({
                    name: patch.date,
                    value: `\`\`\`${patch.features.map(f => f.name).join('\n')}\`\`\``
                })
            }
        }

        return new Page({
            title: 'Feature Roadmap'
        }, patches)
    }

    private renderMagfest(): Page {
        let magfest
        if (this.schedule.magfests.length > 1) {
            magfest = this.schedule.magfests.filter(this.isCurrent)[0]
        } else {
            magfest = this.schedule.magfests[0]
        }

        return new Page({
            title: magfest.name.en,
            author: `Ends in ${this.buildDiffString(magfest.ends)}`,
            image: magfest.banner || undefined
        }, [{
            name: 'Wiki',
            value: magfest.wiki as string
        }, {
            name: 'Content',
            value: `\`\`\`${magfest.info.join('\n')}\`\`\``
        }])
    }

    private async renderFestival(day: number): Promise<Page> {
        const sections = await this.renderFestivalSections(day)

        return new Page({
            title: 'Granblue Fes 2020',
            image: 'https://images-ext-2.discordapp.net/external/Zky9CQAg3g7hdOQR_w7YbIaqy6FRh6P5mnZAvEQEu4g/https/fes.granbluefantasy.jp/assets2020/images/share/ogp.jpg'
        }, sections)
    }

    private async renderFestivalSections(day: number): Promise<Section[]> {
        return await this.load('festival.json')
            .then((data) => {
                const festival: FestivalEvent[] = data.events
                let events: Section[] = []

                for (let i in festival) {
                    const event = festival[i]

                    if (dayjs(event.ends).isAfter(dayjs())) {
                        const startsDiffString = `<Starts in ${this.buildDiffString(event.starts)}>`
                        const endsDiffString = `<Ends in ${this.buildDiffString(event.ends)}>`
                        
                        const isCurrentEvent: boolean = (dayjs(event.starts).isBefore(dayjs()) && dayjs(event.ends).isAfter(dayjs()))
        
                        const startsString: string = `${startsDiffString}\n${dayjs(event.starts).format('LLLL')} JST`
                        const endsString: string = `${endsDiffString}\n${dayjs(event.ends).format('LLLL')} JST`
                        const dateString: string = (isCurrentEvent) ? endsString : startsString
        
                        let castString = (event.cast) ? event.cast.map(member => `${member.name} (${member.role})`).join('\n') : null
                        let value: string = `\`\`\`html\n${castString ? castString + '\n\n' : ''}${dateString}\n\`\`\``
                        
                        if (event.day == day) {
                            events.push({
                                name: event.name.en,
                                value: value
                            })
                        }
                    }
                }

                const link1 = 'https://www.youtube.com/watch?v=gEIfjAoqKjE'
                const link2 = 'https://www.youtube.com/watch?v=Kb8ChL3ABZA'

                events.unshift({
                    name: `Day ${day}`,
                    value: `Watch → ${(day == 1) ? link1 : link2}`
                })

                return events
            })
    }

    private renderHelp(): Page {
        let options = [
            '```html\n',
            '<show>',
            'Show the schedule\n',
            '<next>',
            'Only show the upcoming event```'
        ].join('\n')

        return new Page({
            title: 'Schedule Help',
            description: 'I can tell you what\'s coming up soon in Granblue Fantasy!'
        }, [
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
                value: 'https://github.com/jedmund/siero-bot/wiki/Viewing-the-schedule'
            }
        ])
    }

    // Section render methods

    private renderEvents(config: PageConfig, events: Event[], prefixes: Section[] = []): Page {
        let sections = prefixes || []

        if (events.length > 0) {
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
        } else {
            sections.push({
                name: "No upcoming events",
                value: "It looks like there are no upcoming events. Huh? Did we reach Estalucia already?"
            })
        }

        return new Page(config, sections)
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

    private isCurrent(event: Event) {
        dayjs().isBetween(dayjs(event.starts), dayjs(event.ends))
    }

    private isUpcoming(event: Event) {
        dayjs(event.starts).isBetween(dayjs(), dayjs().add(48, 'hours'))
    }

    private renderMagfestEvent(): { section: Section, image: string } | null {
        let magfest: Event | null
        let isMagfest = false

        let name = ''
        let description = ''
        let image = ''

        if (this.schedule.magfests.length > 1) {
            if (this.schedule.magfests.filter(this.isCurrent).length > 0) {
                magfest = this.schedule.magfests.filter(this.isCurrent)[0]
                isMagfest = true
            } else if (this.schedule.magfests.filter(this.isUpcoming).length > 0) {
                magfest = this.schedule.magfests.filter(this.isUpcoming)[0]
                isMagfest = false
            } else {
                magfest = null
            }
        } else {
            magfest = this.schedule.magfests[0]
            if (dayjs().isBetween(dayjs(magfest.starts), dayjs(magfest.ends))) {
                isMagfest = true
            }
        }

        if (magfest) {
            if (isMagfest) {
                const difference = this.buildDiffString(magfest.ends)

                name = magfest.name.en
                image = (magfest.banner) ? magfest.banner : ''
                description = `The ${magfest.name.en} is underway for the next **${difference}**.\n\u200e`
            } else {
                const parts: NumberObject = dayjs.preciseDiff(dayjs(magfest.starts).utcOffset(540), dayjs(magfest.ends), true)
                const difference = this.buildDiffString(magfest.starts)
                const duration = this.buildString(null, parts.days, parts.hours)
                
                name = `${magfest.name.en} coming soon!`
                description = `The ${magfest.name.en} starts in **${difference}**! It will last for **${duration}**.\n\u200e`
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

    private renderMaintenanceEvent(): Section | null {
        let maintenance: Duration | null
        let isMaintenance = false
        let upcomingMaintenance = false

        let name = ''
        let description = ''

        if (this.schedule.maintenance.length > 1) {
            if (this.schedule.maintenance.filter((e => dayjs().isBetween(dayjs(e.starts), dayjs(e.ends)))).length > 0) {
                maintenance = this.schedule.maintenance.filter((e => dayjs().isBetween(dayjs(e.starts), dayjs(e.ends))))[0]
                isMaintenance = true
            } else if (this.schedule.maintenance.filter((e => dayjs(e.starts).isBetween(dayjs(), dayjs().add(48, 'hours')))).length > 0) {
                maintenance = this.schedule.maintenance.filter((e => dayjs(e.starts).isBetween(dayjs(), dayjs().add(48, 'hours'))))[0]
                upcomingMaintenance = true
            } else {
                maintenance = null
            }
        } else {
            maintenance = this.schedule.maintenance[0]
            if (dayjs().isBetween(dayjs(maintenance.starts), dayjs(maintenance.ends))) {
                isMaintenance = true
            }
        }

        if (maintenance) {
            if (isMaintenance) {
                const difference = this.buildDiffString(maintenance.ends)

                name = 'Maintenance'
                description = `Granblue Fantasy will be undergoing maintenance for the next **${difference}**.\n\u200e`
            } else if (upcomingMaintenance) {
                const parts: NumberObject = dayjs.preciseDiff(dayjs(maintenance.starts).utcOffset(540), dayjs(maintenance.ends), true)
                const difference = this.buildDiffString(maintenance.starts)
                const duration = this.buildString(null, parts.days, parts.hours)
                
                name = 'Upcoming Maintenance'
                description = `Granblue Fantasy will be undergoing maintenance in **${difference}**.\n\nMaintenance will last for **${duration}**.\n\u200e`
            }
        }

        return (name && description) ? {
            name: name,
            value: description
        } : null
    }


    // MessageEmbed render methods

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

    private upcomingEvents(): Event[] {
        let upcomingEvents: Event[] = []

        for (let i in this.schedule.events) {
            const event: Event = this.schedule.events[i]

            if (dayjs(event.starts).isAfter(dayjs())) {
                upcomingEvents.push(event)
            }
        }

        return upcomingEvents
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
