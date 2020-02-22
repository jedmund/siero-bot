const { Client } = require('pg')
const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')
const pluralize = require('pluralize')

const client = getClient()
client.connect()

class SparkCommand extends Command {
    constructor() {
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

    exec(message, args) {
        this.checkIfUserExists(message.author, () => {
            this.switchOperation(message, args)
        })
    }

    // Command methods
    add(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
    
        let transposedCurrency = this.transposeCurrency(args.currency)
    
        let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1`
        client.query(sql, [message.author.id], (err, res) => {
            if (err) {
                console.log(err.message)
            }
    
            let sum = res.rows[0].currency + args.amount
            this.updateCurrency(sum, transposedCurrency, message)
        })
    }

    remove(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
    
        let transposedCurrency = this.transposeCurrency(args.currency)
    
        let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1`
    
        client.query(sql, [message.author.id], (err, res) => {
            if (err) {
                console.log(err.message)
            }
    
            let sum = res.rows[0].currency - args.amount
            this.updateCurrency(sum, transposedCurrency, message)
        })
    }

    quicksave(message) {
        let prefix = "$spark quicksave "
        let valueString = message.content.slice(prefix.length)
        let values = valueString.split(" ")
    
        this.updateSpark(values[0], values[1], values[2], message)
    }
    
    reset(message) {
        let sql = `UPDATE sparks SET crystals = 0, tickets = 0, ten_tickets = 0 WHERE user_id = $1`
    
        client.query(sql, [message.author.id], (err) => {
            if (err) {
                console.log(err.message)
            }
    
            message.reply("Your spark has been reset!")
        })
    }

    set(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
        
        this.updateCurrency(args.amount, this.transposeCurrency(args.currency), message)
    }

    async leaderboard(message, order = 'desc') {
        let sql = `SELECT * FROM sparks`

        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        if (order === 'desc') {
            embed.setTitle("Leaderboard")
        } else {
            embed.setTitle("~~Leader~~ Loserboard")
        }

        client.query(sql, (err, res) => {
            let rows = (order === 'desc') ? 
                res.rows.sort(this.compareProgress) :
                res.rows.sort(this.compareProgress).reverse()
            
            var maxItems = 10
            let usernameMaxChars = 15
            let numDrawsMaxChars = 10

            let divider = '+-----+' + '-'.repeat(usernameMaxChars + 2) + '+' + '-'.repeat(numDrawsMaxChars + 1) + '+\n'
            var result = divider

            for (var i = 0; i < maxItems; i++) {
                let numDraws = this.calculateDraws(rows[i].crystals, rows[i].tickets, rows[i].ten_tickets)

                let spacedUsername = this.spacedString(rows[i].username, usernameMaxChars)
                let spacedDraws = this.spacedString(`${numDraws} draws`, numDrawsMaxChars)

                let place = ((i + 1) < 10) ? `${i + 1}  ` : `${i + 1} `

                result += `| #${place}| ${spacedUsername} | ${spacedDraws}|\n`
                result += divider
            }
            
            embed.setDescription("```html\n" + result + "\n```")
            message.channel.send(embed)

            if (err) {
                console.log(err.message)
            }
        })
    }

    status(message) {
        // var id = 0
        // if (message.mentions.users.values().next().value != undefined) {
        // id = message.mentions.users.values().next().value.id

        var id = message.author.id
        this.getProgress(message, id)
    }

    help(message) {
        var embed = new RichEmbed()
        embed.setTitle("Spark")
        embed.setDescription("Welcome! I can help you save your spark!")
        embed.setColor(0xdc322f)
        embed.addField("Command syntax", "```spark <option> <amount> <currency>```")
        embed.addField("Spark options", `\`\`\`html\n
<status>
See how much you've saved\n
<set>
Save an absolute value for a currency\n
<add/save>
Add an amount of currency to your total\n
<remove/spend>
Remove an amount of currency from your total\n
<reset>
Reset your spark\n
<quicksave>
Quickly save all currencies\n
<leaderboard>
See a leaderboard of everyone's spark progress\`\`\``)
        embed.addField("Currencies", `You can use both singular and plural words for currencies
    \`\`\`crystals tickets tenticket\`\`\``)
        embed.addField("Quicksave", `This is the proper formatting for quicksave:
    \`\`\`spark quicksave <crystals> <tickets> <tentickets>\`\`\``)
    
        message.channel.send(embed)
    }

    // Helper methods
    calculateDraws(crystals, tickets, tenTickets) {
        let ticketValue = tickets * 300
        let tenTicketValue = tenTickets * 3000
        let totalCrystalValue = crystals + ticketValue + tenTicketValue
    
        return Math.floor(totalCrystalValue / 300)
    }
    
    checkCurrency(message, currency) {
        let currencies = ["crystals", "tickets", "toclets", "tentickets"]
        var valid = true
    
        if (!currencies.includes(currency) && !currencies.includes(currency + "s")) {
            valid = false
            message.reply(`\`${currency}\` isn't a valid currency. The valid currencies are \`crystal\`, \`ticket\`, \`tenticket\` as well as their pluralized forms.`)
        }
    
        return valid
    }

    compareProgress(a, b, order = 'desc') {
        function calculateDraws(crystals, tickets, tenTickets) {
            let ticketValue = tickets * 300
            let tenTicketValue = tenTickets * 3000
            let totalCrystalValue = crystals + ticketValue + tenTicketValue

            return Math.floor(totalCrystalValue / 300)
        }

        let aDraws = calculateDraws(a.crystals, a.tickets, a.ten_tickets)
        let bDraws = calculateDraws(b.crystals, b.tickets, b.ten_tickets)

        let comparison = 0
        if (aDraws > bDraws) {
            comparison = 1
        } else if (aDraws < bDraws) {
            comparison = -1
        }

        return (
            (order === 'desc') ? (comparison * -1) : comparison
        )
    }

    spacedString(string, maxNumChars) {
        let numSpaces = maxNumChars - string.length
        var spacedString = string

        for (var i = 0; i < numSpaces; i++) {
            spacedString += " "
        }

        return spacedString
    }

    generateProgressString2(message, crystals, tickets, tenTickets) {
        let draws = this.calculateDraws(crystals, tickets, tenTickets)
        let drawPercentage = Math.floor((draws / 300) * 100)

        let embed = new RichEmbed()

        message.channel.send(embed)
    }

    generateProgressString(message, crystals, tickets, tenTickets) {
        let draws = this.calculateDraws(crystals, tickets, tenTickets)
        let drawPercentage = Math.floor((draws / 300) * 100)

        let table = this.generateTable(crystals, tickets, tenTickets)

        let statusString = `You have ${crystals} ${pluralize('crystal', crystals)}, ${tickets} ${pluralize('ticket', tickets)}, and ${tenTickets} ${pluralize('10-ticket', tenTickets)} for a total of **${draws} draws.**`

        var progressString = ""
        if (drawPercentage > 0 && drawPercentage < 25) {
            progressString = `You're just **${drawPercentage}%** of the way there.`
        } else if (drawPercentage > 25 && drawPercentage < 75) {
            progressString = `You've saved **${drawPercentage}%** of a spark.`
        } else if (drawPercentage > 75 && drawPercentage < 100) {
            progressString = `Wow! You've got **${drawPercentage}%** of your spark.`
        } else {
            progressString = `Time to start saving!`
        }

        var encouragement = ""
        if (draws < 50) {
            encouragement = "Looks like you have some work to do!"
        } else if (draws < 150) {
            encouragement = "You're getting there! Stay strong!"
        } else if (draws < 250) {
            encouragement = "You've been at this for a while, haven't you?"
        } else if (draws < 290) {
            encouragement = "This is the home stretch! You're almost done!"
        }
        
        message.reply(`${statusString}\n${progressString}`)
    }

    generateTable(crystals, tickets, tenTickets) {
        let draws = this.calculateDraws(crystals, tickets, tenTickets)

        var bookends = "+-------------+------------+"
        var separator = "+=============+============+"

        var crystalsRow = `| crystals    | ${this.createStringWithRemainder(crystals,)} |`
        var ticketsRow = `| tickets     | ${this.createStringWithRemainder(tickets)} |`
        var tenTicketsRow = `| 10 tickets  | ${this.createStringWithRemainder(tenTickets)} |`
        var totalsRow = `| Total draws | ${this.createStringWithRemainder(draws)} |`

        // console.log("```\n" + bookends + "\n" + crystalsRow + "\n" + bookends + "\n" + ticketsRow + "\n" + bookends + "\n" + tenTicketsRow + "\n" + separator + "\n" + totalsRow + "\n" + bookends + "\n```")
        return "```\n" + bookends + "\n" + crystalsRow + "\n" + bookends + "\n" + ticketsRow + "\n" + bookends + "\n" + tenTicketsRow + "\n" + separator + "\n" + totalsRow + "\n" + bookends + "\n```"
    }

    createStringWithRemainder(number) {
        var string = ""

        let numDashes = 10
        var remainder = numDashes - number.toString().length

        for (var i = 0; i < remainder; i++) {
            string = string + " "
        }
        return string + number
    }

    switchOperation(message, args) {
        switch(args.operation) {
            case "add":
                this.add(message, args)
                break
            case "help":
                this.help(message)
                break
            case "quicksave":
                this.quicksave(message)
                break
            case "remove":
                this.remove(message, args)
                break
            case "reset":
                this.reset(message)
                break
            case "save":
                this.add(message, args)
                break
            case "set":
                this.set(message, args)
                break
            case "spend":
                this.remove(message, args)
                break
            case "status":
                this.status(message)
                break
            case "leaderboard":
                this.leaderboard(message)
                break
            case "loserboard":
                this.leaderboard(message, "asc")
                break
            default:
                break
        }
    }

    transposeCurrency(currency) {
        if (['tenticket', 'tentickets'].includes(currency)) {
            return "ten_tickets"
        }
    
        if (['toclet', 'toclets'].includes(currency)) {
            return "tickets"
        }
    
        if (currency.substr(-1) != "s") {
            return currency + "s"
        }
    
        return currency
    }
    
    // Database methods
    checkIfUserExists(user, callback) {
        let sql = 'SELECT COUNT(*) AS count FROM sparks WHERE user_id = $1'
    
        client.query(sql, [user.id], (err, res) => {
            if (res.rows[0].count == 0) {
                this.createRowForUser(user, callback)
            } else {
                callback()
            }
        })
    }
    
    createRowForUser(user, callback) {
        let sql = 'INSERT INTO sparks (user_id, username) VALUES ($1, $2)'
        
        client.query(sql, [user.id, user.username], function(err, res) {
            if (err) {
                console.log(err.message)
            }
    
            callback()
        })
    }
    
    getProgress(message) {
        let sql = 'SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = $1'

        client.query(sql, [message.author.id], (err, res) => {
            if (res.rowCount > 0) {
                let crystals = res.rows[0].crystals
                let tickets = res.rows[0].tickets
                let tenTickets = res.rows[0].ten_tickets
        
                this.generateProgressString(message, crystals, tickets, tenTickets)
            } else {
                var id = message.mentions.users.values().next().value
                message.reply(`It looks like ${id} hasn't started a spark yet.`)
            }
        })
    }
    
    async updateCurrency(amount, currency, message) {
        let sql = `UPDATE sparks SET ${currency} = $1, username = $2 WHERE user_id = $3`
        let data = [amount, message.author.username, message.author.id]
    
        await client.query(sql, data, (err, res) => {
            if (err) {
                console.log(err.message)
            }
        })

        this.getProgress(message)
    }
    
    updateSpark(crystals, tickets, tenTickets, message) {
        let sql = `UPDATE sparks SET crystals = $1, tickets = $2, ten_tickets = $3, username = $4 WHERE user_id = $5`
        let data = [crystals, tickets, tenTickets, message.author.username, message.author.id]
    
        client.query(sql, data, (err) => {
            if (err) {
                console.log(err.message)
            }
    
            this.getProgress(message)
        })
    }
}

function getClient() {
    var c
    if (process.env.NODE_ENV == "development") {
        c = new Client({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DB,
            password: process.env.PG_PASSWORD,
            port: 5432,
        })
    } else {
        c = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: true
        })
    }

    return c
}

module.exports = SparkCommand