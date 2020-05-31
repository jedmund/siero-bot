
import { Client } from '../../services/connection.js'
import { Message, MessageEmbed } from 'discord.js'
import { Gacha } from '../../services/gacha.js'

const fetch = require('make-fetch-happen').defaults({
    cacheManager: './cache' // path where cache will be written (and read)
})
  
import common from '../../helpers/common.js'
import decision from '../../helpers/decision.js'

type NumberResult = { [key: string]: number }

interface Properties {
    gala: string | undefined
    season: string | undefined
}

interface Result {
    [index: string]: string | number | boolean | null
    id: string
    name: string
    recruits: string | null
    rarity: number
    item_type: number | null
    premium: boolean
    flash: boolean
    legend: boolean
    halloween: boolean
    holiday: boolean
    summer: boolean
    valentines: boolean
}

interface Rolls {
    item: Result,
    count: number
}

class Until {
    target: string
    properties: Properties = {
        gala: 'premium',
        season: undefined
    }

    rateups: Result[] = []
    currency: string = 'USD'

    userId: string
    message: Message
    deciderMessage: Message | null = null

    public constructor(message: Message, rateups: Result[]) {
        this.userId = message.author.id
        this.message = message
        this.rateups = rateups

        this.properties = this.parseProperties(message.content)
        this.target = this.parseTarget(message.content)
    }

    public async execute() {
        const gacha = new Gacha(this.properties.gala!, this.properties.season!, this.rateups)

        await this.countPossibleItems(this.target)
            .then((data: NumberResult) => {
                return this.parsePossibleItems(data.count)
            })
            .then((chosenItem: Result | void) => {
                if (!chosenItem) {
                    common.missingItem(this.message, this.userId, 'until', this.target)
                    throw Error('Item not found')
                }

                if (chosenItem && !this.testProperties(gacha, chosenItem)) {
                    this.notAvailableError(gacha, chosenItem)
                    throw Error('Item not available')
                }

                return chosenItem!
            })
            .then((item: Result) => {
                const rolls = this.roll(gacha, item)

                return {
                    item: item,
                    count: rolls
                }
            })
            .then((rolls: Rolls) => {
                return this.render(rolls)
            })
            .then((response: string) => {
                if (this.deciderMessage) {
                    this.deciderMessage.edit({
                        content: response,
                        embed: null
                    })
    
                    if (this.deciderMessage.channel.type !== 'dm') {
                        this.deciderMessage.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error))
                    }

                    this.deciderMessage = null
                } else {
                    this.message.channel.send(response)
                }
            })
            .catch((error: Error) => {
                console.error(error)
            })
    }

    private parseProperties(request: string) {
        const splitRequest = request.split(' ')

        const galas = ['legend', 'flash', 'lf', 'ff']
        const seasons = ['halloween', 'holiday', 'summer', 'valentines']

        const gala = [splitRequest, galas].reduce((a, c) => a.filter(i => c.includes(i))).pop()
        const season = [splitRequest, seasons].reduce((a, c) => a.filter(i => c.includes(i))).pop()

        return {
            gala: gala,
            season: season
        }
    }

    private parseTarget(request: string) {
        const splitRequest = request.split(' ')
        const target = [splitRequest, [this.properties.gala, this.properties.season]].reduce((a, c) => a.filter(i => !c.includes(i)))

        return target.splice(2).join(' ')
    }

    // Action methods
    private roll(gacha: Gacha, target: Result) {
        let count = 0
        let found = false

        while (!found) {
            let roll = gacha.tenPartRoll()
            count = count + 10

            for (var i in roll.items) {
                let item = roll.items[i]
                if (item.name == target.name || (target.recruits && item.recruits == target.recruits)) {
                    found = true
                }
            }
        }

        return count
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

    private async fetchItem(name: string) {
        const sql = [
            'SELECT id, name, recruits, rarity, item_type',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1 LIMIT 1'
        ].join(' ')

        return await Client.one(sql, name)
            .catch((error: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, 'rateup', error, text)
            })
    }

    // Render methods
    private async render(rolls: Rolls) {
        const exchange = await this.getExchangeRate(this.currency)

        var string = ''
        if (rolls.item.recruits != null) {
            string = `It took **${rolls.count} rolls** to pull **${rolls.item.name} (${rolls.item.recruits})**.`
        } else {
            string = `It took **${rolls.count} rolls** to pull **${rolls.item.name}**.`
        }

        let numTenPulls = rolls.count / 10
        let tenPullCost = 3000
        let mobacoinCost = 3150

        let conversion = `That's **${(numTenPulls * tenPullCost).toLocaleString()} crystals** or about **\$${Math.ceil(((numTenPulls * mobacoinCost) * exchange)).toLocaleString()}**!`

        return [string, conversion].join(" ")
    }

    // Helper methods
    private async getExchangeRate(currency: string = 'USD') {
        const url = `https://api.exchangeratesapi.io/latest?base=JPY&symbols=${currency.toUpperCase()}`

        try {
            const result = await (await fetch(url)).json()
            return result['rates'][currency]
        } catch(error) {
            console.error(error)
        }
    }

    private async parsePossibleItems(possibilities: number) {
        let result: Result | void

        if (possibilities > 1) {
            result = await this.resolveDuplicate(this.target)
        } else if (possibilities == 1) {
            result = await this.fetchItem(this.target)
        }

        return result
    }

    private async resolveDuplicate(targetName: string): Promise<Result | void> {
        const sql = [
            'SELECT id, name, recruits, rarity, item_type',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1'
        ].join(' ')

        let results: Result[] = []
        return await Client.any(sql, targetName)
            .then((data: Result[]) => {
                results = data
                return decision.buildDuplicateEmbed(data, targetName)
            })
            .then((embed: MessageEmbed) => {
                if (this.deciderMessage) {
                    return this.deciderMessage.edit(embed)
                } else {
                    return this.message.channel.send(embed)
                }
            })
            .then((newMessage: Message) => {
                this.deciderMessage = newMessage
                decision.addOptions(this.deciderMessage, results.length)

                return decision.receiveSelection(this.deciderMessage, this.userId)
            })
            .then((selection: number) => {
                return results[selection]
            })
            .catch((error: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, 'rateup', error, text)
            })
    }

    private testProperties(gacha: Gacha, item: Result) {
        if (this.properties.gala == null && this.properties.season == null && (gacha.isLimited(item) || gacha.isSeasonal(item))) {
            return false
        }

        if (this.properties.gala != null && this.properties.season == null && item[this.properties.gala] == 0) {
            return false
        }

        if (this.properties.season != null && this.properties.gala == null && item[this.properties.season] == 0) {
            return false
        }

        if (this.properties.gala != null && this.properties.season != null && item[this.properties.gala] == 0 && item[this.properties.season] == 0) {
            return false
        }

        return true
    }

    // Error methods
    private notAvailableError(gacha: Gacha, target: Result) {
        const text = `It looks like **${target.name}** doesn't appear in the gala or season you selected.`
        const error = `[Incorrect gala or season] ${this.userId}: ${this.message.content}`

        var appearance
        if (gacha.isLimited(target)) {
            appearance = gacha.getGala(target)
        } else if (gacha.isSeasonal(target)) {
            appearance = gacha.getSeason(target)
        }

        let section = {
            title: "Did you mean...",
            content: `\`\`\`${this.message.content} ${appearance}\`\`\``
        }

        common.reportError(this.message, this.userId, 'until', error, text, false, section)
    }
}

exports.Until = Until