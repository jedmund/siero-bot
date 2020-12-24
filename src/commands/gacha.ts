import { Message, MessageEmbed, User } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'
import { Page, Pager } from '../services/pager'

// Services
import { Item } from '../services/constants.js'
import { Gacha } from '../services/gacha.js'

// Subcommands
const { Rateup } = require('../subcommands/gacha/rateup.js')
const { Until } = require('../subcommands/gacha/until.js')
const { Target } = require('../subcommands/spark/target.js')

const common = require('../helpers/common.js')

interface GachaArgs {
    operation: string
    gala: string
    season: string | null
}

interface Spark {
    count: RarityMap,
    items: Item[]
}

interface RarityMap {
    R: number,
    SR: number,
    SSR: number
}

enum Rarity {
    R = 1,
    SR = 2,
    SSR = 3
}

enum ItemType {
    Weapon = 0,
    Summon = 1
}

class GachaCommand extends SieroCommand {
    rateups: Item[] = []
    sparkTarget: Item | null = null
    defaultRateups: boolean = false

    public constructor() {
        super('gacha', {
            aliases: ['gacha', 'g'],
            args: [
                {
                    id: 'operation',
                    default: 'help'
                },
                {
                    id: 'gala',
                    default: 'premium'
                },
                {
                    id: 'season',
                    default: 'none'
                }
            ]
        })
    }

    async exec(message: Message, args: GachaArgs) {
        this.log(message)

        this.commandType = 'gacha'

        this.args = args
        this.message = message

        await this.storeRateups()
        await this.storeSparkTarget()

        this.switchOperation()
    }

    private switchOperation() {
        switch (this.args.operation) {
            case 'yolo':
                this.yolo()
                break
            case 'ten':
                this.ten_pull()
                break
            case 'spark':
                this.spark()
                break
            case 'rateup':
                this.rateup()
                break
            case 'until':
                this.until()
                break
            case 'help':
                this.help()
                break
            default:
                let text = 'Sorry, I don\'t recognize that command. Are you sure it\'s the right one?'
                let error = `[Unrecognized command] ${this.message.author.id}: ${this.message.content}`

                this.reportError(error, text)

                break
        }
    }

    // Command methods
    private yolo() {
        let gacha = new Gacha(this.args.gala, this.args.season, this.rateups)
        let item = gacha.singleRoll()
        let response = this.renderItem(item)

        this.message.reply(response)
    }

    private ten_pull() {
        let gacha = new Gacha(this.args.gala, this.args.season, this.rateups)
        let items = gacha.tenPartRoll()
        let response = [
            'You got these 10 things!',
            `\`\`\`html\n${this.renderItems(items.items)}\n\`\`\``
        ].join('')

        this.message.reply(response)
    }

    private async spark() {
        let gacha = new Gacha(this.args.gala, this.args.season, this.rateups)
        let items = gacha.spark()

        const siero = (this.message.author.id === this.client.ownerID) ? this.client.user : null
        const rateup = new Rateup(this, this.message, siero)
        await rateup.setup()

        const author = (this.defaultRateups) ? siero : this.message.author
        
        let pager: Pager = new Pager(this.message.author)
        pager.addPage('✨', this.renderSpark(items))
        pager.addPage('📈', rateup.renderPage(this.rateups, author))

        pager.render(this.message)
    }

    private until() {
        const until = new Until(this, this.message, this.rateups)
        until.execute()
    }

    async rateup() {
        const siero = (this.message.author.id === this.client.ownerID) ? this.client.user : null
        const rateup = new Rateup(this, this.message, siero)
        rateup.execute()
    }

    private help() {
        const gachaOptions = [
            '```html\n',
            '<yolo>',
            'A single Premium Draw pull\n',
            '<ten>',
            'A 10-part Premium Draw pull\n',
            '<spark>',
            'A whole spark\n',
            '<until>',
            'Roll until you get the item you want```'
        ].join('\n')

        const galasAndSeasons = [
            '```html\n',
            '<gala: premium flash legend ff lf>',
            'The <gala> you choose will determine the SSR rate\n',
            '<season: valentines summer halloween holiday>',
            'The <season> you choose adds seasonal units to the pool```'
        ].join('\n')

        const usingRateups = [
            '```html\n',
            '<rateup set>',
            'Start a new rateup\n',
            '<rateup copy @user>',
            'Copy the tagged user\'s rateup\n',
            '<rateup check>',
            'Check your current rateup\n',
            '<rateup reset>',
            'Clear your current rateup```'
        ].join('\n')

        const settingRateups = [
            '```html\n',
            '<rateup set Sky Ace 0.300, Elil 0.500>',
            'Set rateups with the weapon or summon name followed by the desired rate',
            'You can add multiple rateups by separating them with a comma, as seen above.```'
        ].join('\n')

        const currentRateup = [
            '```html\n',
            'Get the current banner\'s rateup',
            '$gacha rateup copy @Siero',
            '```'
        ]

        const link = 'https://github.com/jedmund/siero-bot/wiki/Pulling-gacha'

        const embed = new MessageEmbed({
            title: 'Gacha',
            description: 'Welcome! I can help you save your money!',
            color: 0xdc322f,
            fields:[
                {
                    name: 'Command syntax',
                    value: '```gacha spark <gala> <season>```'
                },
                {
                    name: 'Gacha options',
                    value: gachaOptions
                },
                {
                    name: 'Galas and Seasons',
                    value: galasAndSeasons
                },
                {
                    name: 'Using Rate-ups',
                    value: usingRateups
                },
                {
                    name: 'Setting Rate-ups',
                    value: settingRateups
                },
                {
                    name: 'Current Banner',
                    value: currentRateup
                },
                {
                    name: 'Full documentation',
                    value: link
                }
            ]
        })

        this.message.channel.send(embed)
    }

    // Data methods
    private async storeRateups() {
        const sourceUser: User = this.message.mentions.users.values().next().value
        
        this.rateups = await Rateup.fetch(this.message.author.id, this.message)
            .catch((error: Error) => {
                const text = `Sorry, there was an error communicating with the database to copy ${sourceUser}'s rate-up.`
                this.reportError(error.message, text)
            })
        
        if (this.rateups.length == 0) {
            this.defaultRateups = true
            this.rateups = await Rateup.fetch(this.client.user?.id)
                .catch((error: Error) => {
                    const text = `Sorry, there was an error communicating with the database to fetch the default rate-up.`
                    this.reportError(error.message, text)
                })
        }
    }

    private async storeSparkTarget() {
        this.sparkTarget = await Target.fetch(this.message.author.id, this.message)
    }

    // Render methods
    private renderItem(result: Item, combined: boolean = false) {
        let rarity: string = common.mapRarity(result.rarity)

        if (result.name && result.recruits) {
            var response = `<${rarity}> ${result.name} – You recruited ${result.recruits.trim()}!`
        } else if (result.name && !result.recruits && result.item_type == ItemType.Summon) {
            var response = `<${rarity} Summon> ${result.name}`
        } else {
            var response = `<${rarity}> ${result.name}`
        }

        return (!combined) ? `\`\`\`html\n${response}\n\`\`\`` : `${response}\n`
    }

    private renderItems(results: Item[]) {
        let characterWeapons = this.sortCharacterWeapons(results)
        var gachaItems = results.filter(x => !characterWeapons.includes(x)).concat(characterWeapons.filter(x => !results.includes(x)))

        let items = this.shuffle(gachaItems).concat(characterWeapons)

        var string = ''
        for (var item in items) {
            string += this.renderItem(items[item], true)
        }

        return string
    }

    private renderSpark(results: Spark): Page {

        let rate = Math.floor((results.count.SSR / 300) * 100)
        let summary = `\`\`\`${this.renderSummary(results)}\`\`\``

        var details = '```html\n' 
        results.items.forEach((item: Item) => {
            details += this.renderItem(item, true)
        })
        details += '\n```'

        return new Page({
            title: 'Spark',
            description: details,
            author: this.message.author.username
        }, [
            {
                name: 'Summary',
                value: summary
            },
            {
                name: 'Rate',
                value: `Your SSR rate is **${rate}%**`
            }
        ])
    }

    private renderSummary(results: Spark) {
        let ssrWeapons = results.items.filter(this.filterSSRWeapons)
        let ssrSummons = results.items.filter(this.filterSSRSummons)
        let numRateupItems = this.filterRateUpItems(results)

        // TODO: Extract into helper method
        let targetsAcquired = results.items.filter((item: Item) => {
            if (this.sparkTarget != null) {
                return item.name == this.sparkTarget.name || (item.recruits != null && item.recruits == this.sparkTarget.recruits)
            } else {
                return null
            }
        })

        let targetAcquiredString = ''
        if (targetsAcquired != null) {
            targetAcquiredString = (targetsAcquired.length > 0) ? `You got your spark target! (${targetsAcquired.length})` : ''
        }

        return [
            targetAcquiredString,
            (this.rateups.length > 0) ? `Rate-up Items: ${numRateupItems}` : '', 
            `SSR Weapons: ${ssrWeapons.length}`, 
            `SSR Summons: ${ssrSummons.length}`, 
            `SR: ${results.count.SR}`, 
            `R: ${results.count.R}`
        ].join('\n')
    }

    // Filter and sort methods
    private filterSSRWeapons(item: Item) {
        return item.rarity == Rarity.SSR && item.item_type == ItemType.Weapon
    }

    private filterSSRSummons(item: Item) {
        return item.rarity == Rarity.SSR && item.item_type == ItemType.Summon
    }

    private filterRateUpItems(spark: Spark) {
        let totalCount = 0

        for (let i in this.rateups) {
            let rateupItem: Item = this.rateups[i]
            totalCount += spark.items.reduce((n: number, item: Item) => {
                return n + ((rateupItem.id == item.id) ? 1 : 0)
            }, 0)
        }
        
        return totalCount
    }

    private sortCharacterWeapons(results: Item[]) {
        let weapons: Item[] = []

        results.forEach((item: Item) => {
            let hasPlacedSR = false
            let lastSRPos = 0
            let placedSSRCount = 0

            if (item.recruits) {
                // If an R is drawn, put it at the front of the list.
                if (item.rarity == Rarity.R) {
                    weapons.unshift(item)
                    lastSRPos = (!hasPlacedSR) ? weapons.length : lastSRPos
                }

                // If an SR is drawn, put it at the last SR position,
                // then record a new position.
                if (item.rarity == Rarity.SR) {
                    weapons.splice(lastSRPos, 0, item)
                    hasPlacedSR = (!hasPlacedSR) ? true : false
                }

                // If an SSR is drawn, put it at the end of the list.
                if (item.rarity == Rarity.SSR) {
                    weapons.push(item)

                    if (!hasPlacedSR) {
                        placedSSRCount += 1
                        lastSRPos = weapons.length - placedSSRCount
                    }
                }
            }
        })

        return weapons
    }

    // Helper methods
    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    private shuffle(array: Item[]) {
        var currentIndex = array.length, temporaryValue, randomIndex

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex)
            currentIndex -= 1

            // And swap it with the current element.
            temporaryValue = array[currentIndex]
            array[currentIndex] = array[randomIndex]
            array[randomIndex] = temporaryValue
        }

        return array
    }
}

module.exports = GachaCommand
