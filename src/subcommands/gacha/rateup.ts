
import { Client } from '../../services/connection.js'
import { Message, MessageEmbed, User } from 'discord.js'
import { SieroCommand } from '../../helpers/SieroCommand'
import { Item, PromptResult } from '../../services/constants.js'

import common from '../../helpers/common.js'
import { Decision as decision } from '../../helpers/decision.js'

type NumberResult = { [key: string]: number }

interface Rate {
    name: string
    rate: number
}

interface RateSet {
    rates: Item[]
    ambiguous: Rate[]
}

class Rateup {
    userId: string
    siero: User | null
    prefix: string = '$'
    command: SieroCommand

    operation: string | null = null
    rates: Rate[] = []

    message: Message
    deciderMessage: Message | null = null
    firstMention: User | null = null

    public constructor(command: SieroCommand, message: Message, siero: User | null) {
        this.userId = message.author.id
        this.message = message
        this.command = command
        this.siero = siero

        this.parseRequest(message.content)
    }

    public async execute() {
        if (this.message.guild) {
            await this.command.fetchPrefix(this.message.guild.id)
                .then((prefix: string) => {
                    this.prefix = prefix
                    return this.switchOperation()
                })
        } else {
            this.prefix = '$'
            this.switchOperation()
        }
    }

    private parseRequest(request: string) {
        this.firstMention = this.message.mentions.users.values().next().value

        const splitRequest = request.split(' ').splice(2)
        if (splitRequest.length > 0) {
            this.operation = splitRequest.shift()!
        }

        if (this.operation === 'set' || this.operation === 'override') {
            this.parseRates(splitRequest.join(' '))
        }
    }

    private parseRates(request: string) {
        // comma regex from https://stackoverflow.com/a/21106122/299315
        // quote regex from https://stackoverflow.com/q/19156148/299315
        // alternate comma regex at https://stackoverflow.com/a/632552/299315
        const commaRe = /(?!\B"[^"]*),(?![^"]*"\B)/
        const quoteRe = /^"|"$/g

        const splitRequest = request.split(commaRe).map(item => item.trim())

        splitRequest.forEach((item: string) => {
            const parts = item.split(' ')

            const rate = parseFloat(parts.pop()!)
            const name = common.capitalize(parts.join(' ').replace(quoteRe, ''), true)

            this.rates.push(
                {
                    name: name,
                    rate: rate
                }
            )
        })
    }

    private switchOperation() {
        switch(this.operation) {
            case 'check':
                this.show()
                break
            case 'copy':
                this.copy()
                break
            case 'set':
                this.set()
                break
            case 'show':
                this.show()
                break
            case 'clear':
                this.reset()
                break
            case 'reset':
                this.reset()
                break
            case 'override':
                this.set(true)
                break
            default:
                this.show()
                break
        }
    }

    // Command methods
    private async copy() {
        this.reset(false)

        const sourceUser = this.firstMention

        if (this.firstMention) {
            const sql = [
                'INSERT INTO rateups (gacha_id, rate, user_id)',
                'SELECT gacha_id, rate, $1',
                'FROM rateups WHERE user_id = $2'
            ].join(" ")

            await Client.any(sql, [this.userId, this.firstMention.id])
                .then(() => {
                    this.firstMention = null
                    return Rateup.fetch(this.userId)
                })
                .then((data: Item[] | void) => {
                    if (data) {
                        this.message.channel.send(
                            {
                                content: `You successfully copied ${sourceUser}'s rate up!`,
                                embed: this.render(this.message.author, data)
                            }
                        )
                    }
                })
                .catch((error: Error) => {
                    const text = `Sorry, there was an error communicating with the database to copy ${sourceUser}'s rate-up.`
                    this.command.reportError(error.message, text)
                })
        }
    }

    private async set(admin: boolean = false) {
        // First, clear the existing rate up
        this.reset(false, admin)

        await this.validate()
            .then((items: RateSet) => {
                return this.saveAll(items, admin)
            })
            .then((items: RateSet | null) => {
                if (items) {
                    const user = (admin) ? this.siero : this.message.author
                    return this.render(user!, items.rates, items.ambiguous)
                } else {
                    throw Error('There was an error saving rates')
                }
            })
            .then((embed: MessageEmbed) => {
                if (this.deciderMessage) {
                    this.deciderMessage.edit(embed)
    
                    if (this.deciderMessage.channel.type !== 'dm') {
                        this.deciderMessage.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error))
                    }

                    this.deciderMessage = null
                } else {
                    this.message.channel.send(embed)
                }
            })
    }

    private async show() {
        const user = (this.firstMention) ? this.firstMention : this.message.author
        const isOwnTarget = (user.id == this.userId) ? true : false

        await Rateup.fetch(user.id)
            .then((data: Item[] | void) => {
                if (data && data.length > 0) {
                    this.message.channel.send(this.render(user, data))
                } else {
                    this.message.author.send(this.notFoundError(isOwnTarget))
                }
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                this.command.reportError(error.message, text)
            })
    }

    private async reset(showMessage: boolean = true, admin: boolean = false) {
        const id = (admin) ? this.siero!.id : this.userId
        const sql = 'DELETE FROM rateups WHERE user_id = $1'

        return await Client.any(sql, id)
            .then(() => {
                if (showMessage) {
                    this.message.reply('Your rate-up has been cleared.')
                }
            })
            .catch((error: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                this.command.reportError(error.message, text)
            })
    }

    // Database methods
    private async countPossibleItems(name: string) {
        const sql = [
            'SELECT COUNT(*)',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1'
        ].join(' ')

        try {
            return await Client.one(sql, name)
        } catch (error) {
            console.log(error)
        }
    }

    public static async fetch(id: string): Promise<Item[] | void> {
        const sql = [
            'SELECT rateups.gacha_id AS id, rateups.rate, gacha.name, gacha.recruits, gacha.rarity, gacha.item_type, ',
            'gacha.flash, gacha.legend, gacha.summer, gacha.holiday, gacha.halloween, gacha.valentines',
            'FROM rateups LEFT JOIN gacha ON rateups.gacha_id = gacha.id',
            'WHERE rateups.user_id = $1',
            'ORDER BY rateups.rate DESC'
        ].join(' ')

        return await Client.any(sql, id)
    }

    private async saveAll(items: RateSet, admin: boolean = false) {
        const rates = items.rates

        try {
            for (var i in rates) {
                let rateup = rates[i]
                await this.save(rateup, admin)
            }

            return items
        } catch(error) {
            const text = 'Sorry, there was an error fulfilling your last request.'
            this.command.reportError(error, text)

            return null
        }
    }

    private async save(item: Item, admin: boolean = false) {
        const id = (admin) ? this.siero!.id : this.userId
        const sql = 'INSERT INTO rateups (gacha_id, user_id, rate) VALUES ($1, $2, $3)'
        
        await Client.query(sql, [item.id, id, item.rate])
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                this.command.reportError(error.message, text)
            })
    }

    // Render methods
    private render(user: User, rateups: Item[], missing: Rate[] | null = null) {
        let string = ''

        if (rateups.length > 0) {
            for (let i in rateups) {
                let rateup = rateups[i]

                if (rateup.recruits != null) {
                    string += `${rateup.name} - ${rateup.recruits}: ${rateup.rate}%\n`
                } else {
                    string += `${rateup.name}: ${rateup.rate}%\n`
                }
            }
        }

        let embed = new MessageEmbed({
            title: 'Your current rate-up',
            color: 0xb58900,
            footer: {
                iconURL: user.displayAvatarURL(),
                text: `Copy with ${this.prefix}gacha rateup copy @${user.username}`
            }
        })

        if (string.length > 0) {
            embed.setDescription(`\`\`\`html\n${string}\n\`\`\``)
        }

        if (missing && missing.length > 0) {
            let missingStrings = []

            for (let i in missing) {
                missingStrings.push(`${missing[i].name} `)
            }

            const title = 'The following items could not be found and were not added to your rateup'
            embed.addField(title, `\`\`\`${missingStrings.join('\n')}\`\`\``)
        }

        return embed
    }

    // Helper methods
    private notFoundError(isOwnTarget: boolean) {
        const text = `It looks like ${(isOwnTarget) ? 'you haven\'t' : this.firstMention!.username + ' hasn\'t'} set a spark target yet!`
                    
        if (isOwnTarget) {
            let embed: MessageEmbed = new MessageEmbed({
                color: 0xb58900
            })

            const link = 'https://github.com/jedmund/siero-bot/wiki/Pulling-gacha'
            const settingRateups = [
                '```html\n',
                '<target set @item @rate, @item @rate, ...>',
                'Set the @rate for the provided @items',
                '```'
            ].join('\n')

            embed.setDescription(`You can find the documentation for \`\$gacha\` at ${link}, or you can type \`\$gacha help\``)
            embed.addField('Setting rate-ups', settingRateups)

            return {
                content: text,
                embed: embed
            }
        } else {
            return {
                content: text
            }
        }
    }

    private async validate() {
        let items: Item[] = []
        let ambiguousItems: Rate[] = []

        for (let i = this.rates.length - 1; i >= 0; i--) {
            let item = this.rates[i]

            await this.countPossibleItems(item.name)
                .then((data: NumberResult) => {
                    return this.parsePossibleItems(item, data.count)
                })
                .then((chosenItem: Item | void) => {
                    if (chosenItem) {
                        items.push(chosenItem)
                    } else {
                        ambiguousItems.push(item)
                    }
                })
                .catch((error: Error) => {
                    console.error(error)
                })
        }

        return {
            rates: items,
            ambiguous: ambiguousItems
        }
    }

    private async resolveDuplicate(targetName: string) {
        return await decision.resolveDuplicate(targetName, this.message, this.deciderMessage, this.userId)
            .then((result: PromptResult) => {
                this.deciderMessage = result.message
                return result.selection
            })
            .catch((error: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                this.command.reportError(error.message, text)
            })
    }

    private async fetchItem(name: string) {
        const sql = [
            'SELECT id, name, recruits, rarity, item_type',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1 LIMIT 1'
        ].join(' ')

        return await Client.one(sql, name)
            .catch((error: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                this.command.reportError(error.message, text)
            })
    }
    
    private async parsePossibleItems(item: Rate, possibilities: number) {
        let result: Item | void

        if (possibilities > 1) {
            result = await this.resolveDuplicate(item.name)
        } else if (possibilities == 1) {
            result = await this.fetchItem(item.name)
        }

        if (result) {
            result.rate = item.rate
        }

        return result
    }
}

exports.Rateup = Rateup