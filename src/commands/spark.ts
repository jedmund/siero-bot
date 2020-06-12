import { Message } from 'discord.js'
import { MessageEmbed } from 'discord.js'
import { User } from 'discord.js'
import { GuildMember } from 'discord.js'
import { Snowflake } from 'discord.js'

const { Client, pgpErrors } = require('../services/connection.js')
const { Command } = require('discord-akairo')

const { Leaderboard } = require('../subcommands/spark/leaderboard.js')
const { Target } = require('../subcommands/spark/target.js')

const common = require('../helpers/common.js')
const dayjs = require('dayjs')

type StringResult = { [key: string]: string }
type NumberResult = { [key: string]: number }

interface SparkResult {
    id: string | null,
    name: string | null,
    recruits: string | null,
    item_type: string | null,
    rarity: string | null,
    crystals: number,
    tickets: number,
    ten_tickets: number
}

interface SparkArgs {
    operation: string | null
    amount: number | null
    currency: string | null
}

enum SparkOperation {
    Addition,
    Subtraction
}

class SparkCommand extends Command {
    public constructor() {
        super('spark', {
            aliases: ['spark', 's'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: 'status'
                },
                {
                    id: 'amount',
                    type: 'number',
                    default: 0
                },
                {
                    id: 'currency',
                    type: 'string',
                    default: null
                }
            ]
        })
    }

    public exec(message: Message, args: SparkArgs) {
        this.commandType = 'sparks'

        console.log(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`)

        // Store values for later use
        common.storeArgs(this, args)
        common.storeMessage(this, message)
        common.storeUser(this, message.author.id)

        this.checkIfUserExists(this.commandType)
            .then((count: number) => {
                if (count == 0) {
                    this.createRowForUser(this.commandType)
                }

                return
            }).then(() => {
                this.switchOperation(args)
            })
    }

    private switchOperation(args: SparkArgs) {
        let editOperations: string[] = ['add', 'save', 'remove', 'spend', 'set']

        if (args.operation && args.currency && editOperations.includes(args.operation)) {
            if (!this.checkCurrency(args.currency)) {
                return
            }
        }

        let amount: number = args.amount!
        let currency: string = args.currency!

        switch(args.operation) {
            // Set a currency to a value
            // Quicksave all currencies
            case 'set':
                this.set(amount, currency)
                break
            case 'quicksave':
                this.quicksave()
                break

            // Add value to one currency
            case 'add':
                this.update(amount, currency, SparkOperation.Addition)
                break
            case 'save':
                this.update(amount, currency, SparkOperation.Addition)
                break

            // Remove value from one currency
            case 'remove':
                this.update(amount, currency, SparkOperation.Subtraction)
                break
            case 'spend':
                this.update(amount, currency, SparkOperation.Subtraction)
                break

            // Clear all currencies
            case 'clear':
                this.reset()
                break
            case 'reset':
                this.reset()
                break

            // Leaderboard and Loserboard
            case 'leaderboard':
                this.leaderboard()
                break
            case 'loserboard':
                this.leaderboard('asc')
                break

            // Command help
            case 'help':
                this.help()
                break

            // See your spark
            case 'status':
                this.status()
                break

            // Manage your spark target
            case 'target':
                this.target()
                break

            default:
                this.status()
                break
        }
    }

    // Command methods
    private status() {
        let id = (this.message.mentions.users.values().next().value) ? this.message.mentions.users.values().next().value.id : this.userId
        this.getProgress(id)
    }

    private quicksave() {
        let values = this.message.content.split(' ').splice(2)
        this.updateSpark(values[0], values[1], values[2])
    }

    private set(amount: number, currency: string) {
        if (amount && currency) {
            let transposedCurrency = this.transposeCurrency(currency)
            this.updateCurrency(amount, transposedCurrency)
        } else {
            const text = `You're missing a valid amount or currency.`
            const section = {
                title: 'Valid currencies',
                content: [
                    `The valid currencies are \`crystal\`, \`ticket\`, and \`tenticket\`. They also work pluralized!`,
                    '```html\n',
                    `$spark ${this.args.operation} 1 ticket`,
                    `$spark ${this.args.operation} 300 crystals`,
                    '```'
                ].join('\n')
            }

            let error = `Invalid amount or currency: ${this.message.content}`
            common.reportError(this.message, this.userId, this.context, error, text, false, section)
        }
    }

    private async update(amount: number, currency: string, operation: SparkOperation) {
        let transposedCurrency = this.transposeCurrency(currency)
        let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1 LIMIT 1`

        Client.one(sql, this.userId)
            .then((result: NumberResult) => {
                var sum = 0
                switch(operation) {
                    case SparkOperation.Addition:
                        sum = this.add(result.currency, amount)
                        break
                    case SparkOperation.Subtraction:
                        sum = this.remove(result.currency, amount)
                        break
                    default:
                        break
                }

                this.updateCurrency(sum, transposedCurrency)
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    private reset() {
        let sql = `UPDATE sparks SET crystals = 0, tickets = 0, ten_tickets = 0 WHERE user_id = $1`
    
        Client.query(sql, this.userId)
            .then(() => {
                this.message.reply('Your spark has been reset!')
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })   
    }

    async leaderboard(order: string = 'desc') {
        if (this.message.channel.type === 'dm') {
            this.invalidContext()
            return
        }
        
        let memberIds: Snowflake[] = (await this.message.guild.members.fetch()).map((g: GuildMember) => g.id);
        let leaderboard = new Leaderboard(memberIds, order)
        await leaderboard.fetchData()
            .then((embed: string) => {
                this.message.channel.send(embed)
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    async target() {
        let target = new Target(this.message)
        target.execute()
    }

    help() {
        let sparkOptions = [
            '```html\n',
            '<status>',
            'See how much you\'ve saved\n',
            '<set>',
            'Save an absolute value for a currency\n',
            '<add/save>',
            'Add an amount of currency to your total\n',
            '<remove/spend>',
            'Remove an amount of currency from your total\n',
            '<quicksave>',
            'Quickly save all currencies\n',
            '<reset>',
            'Reset your spark\n',
            '<target>',
            'Set a target for your spark\n',
            '<leaderboard>',
            'See a leaderboard of everyone\'s spark progress```'
        ].join('\n')

        let currencies = [
            'You can use both singular and plural words for currencies',
            '```crystals tickets tenticket```'
        ].join('\n')

        let quicksave = [
            'This is the proper formatting for quicksave:',
            '```spark quicksave <crystals> <tickets> <tentickets>```'
        ].join('\n')

        let usingTargets = [
            '```html\n',
            '<target set @item>',
            'Set the provided @item as your spark target\n',
            '<target show>',
            'Show your current spark target\n',
            '<target reset>',
            'Reset your current spark target',
            '```'
        ].join('\n')

        let link = 'https://github.com/jedmund/siero-bot/wiki/Saving-sparks'

        var embed = new MessageEmbed({
            title: 'Spark',
            description: 'Welcome! I can help you save your spark!',
            color: 0xdc322f,
            fields: [
                {
                    name: 'Command syntax',
                    value: '```spark <option> <amount> <currency>```'
                },
                {
                    name: 'Spark options',
                    value: sparkOptions
                },
                {
                    name: 'Currencies',
                    value: currencies
                },
                {
                    name: 'Quicksave',
                    value: quicksave
                },
                {
                    name: 'Using targets',
                    value: usingTargets
                },
                {
                    name: 'Full documentation',
                    value: link
                }
            ]
        })
    
        this.message.channel.send(embed)
    }

    // Helper methods
    private add(currentAmount: number, difference: number) {
        return currentAmount + difference
    }

    private remove(currentAmount: number, difference: number) {
        return (currentAmount - difference >= 0) ? currentAmount - difference : 0
    }

    private calculateDraws(crystals: number, tickets: number, tenTickets: number) {
        let ticketValue = tickets * 300
        let tenTicketValue = tenTickets * 3000
        let totalCrystalValue = crystals + ticketValue + tenTicketValue
    
        return Math.floor(totalCrystalValue / 300)
    }

    private checkCurrency(currency: string) {
        let currencies = ['crystals', 'tickets', 'toclets', 'tentickets']
        var valid = true
    
        if (!currencies.includes(currency) && !currencies.includes(currency + 's')) {
            valid = false
            this.invalidCurrency(currency)
        }
    
        return valid
    }

    private transposeCurrency(currency: string) {
        if (['tenticket', 'tentickets', '10ticket', '10tickets'].includes(currency)) {
            return 'ten_tickets'
        }

        if (['toclet', 'toclets'].includes(currency)) {
            return 'tickets'
        }

        return (currency.substr(-1) != 's') ? `${currency}s` : currency
    }

    // Error methods
    private invalidContext() {
        let text = 'Sorry, I can\'t show you leaderboards in direct messages. Please send the command from a server that we\'re both in!'
        let error = `Incorrect context: ${this.message.content}` 

        common.reportError(this.message, this.userId, this.context, error, text)
    }

    private invalidCurrency(currency: string) {
        var text
        var section

        if (!isNaN(parseInt(currency))) {
            text = `You might have reversed the currency and amount! \`${currency}\` is a number.`
            section = {
                title: 'You might mean...',
                content: [
                    '```html\n',
                    `$spark ${this.args.operation} ${this.args.currency} tickets`,
                    `$spark ${this.args.operation} ${this.args.currency} crystals`,
                    '```'
                ].join('\n')
            }
        } else {
            text = `\`${currency}\` isn't a valid currency.`
            section = {
                title: 'Valid currencies',
                content: [
                    `The valid currencies are \`crystal\`, \`ticket\`, and \`tenticket\`. They also work pluralized!`,
                    '```html\n',
                    `$spark ${this.args.operation} 1 ticket`,
                    `$spark ${this.args.operation} 300 crystals`,
                    '```'
                ].join('\n')
            }
        }
        
        let error = `Invalid currency: ${this.message.content}`
        common.reportError(this.message, this.userId, this.context, error, text, false, section)
    }

    // Database methods
    private getProgress(targetId: string | null = null) {
        let sql = [
            'SELECT sparks.crystals, sparks.tickets, sparks.ten_tickets, sparks.target_id AS id,',
            'gacha.name, gacha.recruits, gacha.rarity, gacha.item_type FROM sparks',
            'LEFT JOIN gacha ON sparks.target_id = gacha.id',
            'WHERE user_id = $1'
        ].join(' ')
        
        let id = (targetId) ? targetId : this.userId

        Client.one(sql, id)
            .then((result: SparkResult) => {
                let string = ''

                if (['add', 'save'].includes(this.args.operation)) {
                    string = `I've added ${this.args.amount} ${this.args.currency} to your spark, ${this.message.author}.`
                } else if (['remove', 'spend'].includes(this.args.operation)) {
                    string = `I've removed ${this.args.amount} ${this.args.currency} from your spark, ${this.message.author}.`
                }

                this.message.channel.send(
                    {
                        content: string,
                        embed: this.renderSpark(result)
                    }
                )
            })
            .catch((error: Error) => {
                var text

                if (error instanceof pgpErrors.QueryResultError) {
                    if (id !== this.userId) {
                        let username = this.message.mentions.users.values().next().value.username
                        text = `It looks like ${username} hasn't started saving their spark target yet!`
                    }
                } else {
                    text = 'Sorry, there was an error communicating with the database for your last request.'
                }

                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    private async updateCurrency(amount: number, currency: string) {
        let sql = `UPDATE sparks SET ${currency} = $1, username = $2 WHERE user_id = $3`
        let data = [amount, this.message.author.username, this.message.author.id]
    
        await Client.query(sql, data)
            .then((_: StringResult) => {
                this.getProgress()
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    private async updateSpark(crystals: number, tickets: number, tenTickets: number) {
        let sql = `UPDATE sparks SET crystals = $1, tickets = $2, ten_tickets = $3, username = $4 WHERE user_id = $5`
        let data = [crystals, tickets, tenTickets, this.message.author.username, this.userId]
    
        await Client.query(sql, data)
            .then(() => {
                this.getProgress()
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, error, text, this.context)
            })
    }

    private async checkIfUserExists(table: string): Promise<number> {
        let sql: string = `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = $1`

        try {
            return await Client.one(sql, this.userId)
                .then((result: NumberResult) => {
                    return result.count
                })
                .catch((error: Error) => {
                    console.error(error)
                })
        } catch(error) {
            console.error(error)
            return -1
        }
    }

    private async createRowForUser(table: string) {
        let sql: string = `INSERT INTO ${table} (user_id, username) VALUES ($1, $2) RETURNING user_id`
        
        try {
            Client.one(sql, [this.userId, this.message.author.username])
                .then((_: StringResult) => {
                    console.log(`[${this.commandType}] New user created: ${this.userId}`)
                })
                .catch((error: Error) =>  {
                    console.error(error)
                })
        } catch(error) {
            console.error(error)
        }
    }

    // Render methods
    private renderSpark(result: SparkResult) {
        const user: User = (this.message.mentions.users.values().next().value) ? this.message.mentions.users.values().next().value : this.message.author

        const draws = this.calculateDraws(result.crystals, result.tickets, result.ten_tickets)
        const numSparks = Math.floor(draws / 300)

        const remainder = draws - (numSparks * 300)
        const drawPercentage = (numSparks > 0) ? Math.floor((remainder / 300) * 100) : Math.floor((draws / 300) * 100)

        let embed = new MessageEmbed({
            title: user.username,
            color: 0xdc322f,
            thumbnail: {
                url: user.displayAvatarURL()
            },
            fields: [
                {
                    name: 'Crystals',
                    value: result.crystals,
                    inline: true
                },
                {
                    name: 'Tickets',
                    value: result.tickets,
                    inline: true
                },
                {
                    name: '10-Part Tickets',
                    value: result.ten_tickets,
                    inline: true
                },
                {
                    name: 'Progress',
                    value: this.drawProgressBar(drawPercentage, numSparks)
                }
            ]
        })

        if (numSparks > 0) {
            embed.addField('Sparks', numSparks)
        }

        if (result.name || result.recruits) {
            const rarity = common.mapRarity(result.rarity)
            const target = (result.recruits) ? `(${rarity}) ${result.name} \u2014 ${result.recruits}` : `(${rarity}) ${result.name}`
            embed.addField('Target', target)
        }

        return embed
    }

    private drawProgressBar(percentage: number, numSparks: number) {
        const character = '='
        const length = 15
        const ticks = Math.floor(length / (100 / percentage))
        const spaces = length - ticks
        
        return [
            `\`\`\`Spark \#${numSparks + 1} `,
            '[',
            Array(ticks).fill(character).join(''),
            '>',
            Array(spaces).fill(' ').join(''),
            ']',
            ` ${percentage}%\`\`\``
        ].join('')
    }
}

module.exports = SparkCommand
