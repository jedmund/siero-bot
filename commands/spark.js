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
        checkIfUserExists(message.author.id, () => {
            switchOperation(message, args)
        })
    }
}

// Command methods
function add(message, args) {
    if (!checkCurrency(message, args.currency)) {
        return
    }

    let transposedCurrency = transposeCurrency(args.currency)

    let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1`
    client.query(sql, [message.author.id], (err, res) => {
        if (err) {
            console.log(err.message)
        }

        let sum = res.rows[0].currency + args.amount
        updateCurrency(sum, transposedCurrency, message)
    })
}

function help(message) {
    return message.reply(`Welcome! I can help you save your spark!

\`status\`: See how much you've saved
\`set\`: Save an absolute value for a currency
\`add\` \`save\`: Add an amount of currency to your total
\`remove\` \`spend\`: Remove an amount of currency from your total
\`reset\`: Reset your spark
\`quicksave\`: Quickly save all currencies in this order: \`crystals\` \`tickets\` \`10 tickets\``)
}

function help(message) {
    var embed = new RichEmbed()
    embed.setTitle("Spark")
    embed.setDescription("Welcome! I can help you save your spark!")
    embed.setColor(0xdc322f)
    embed.addField("Command syntax", "```spark <option> <amount> <currency>```")
    embed.addField("Spark options", `\`\`\`status: See how much you've saved
set: Save an absolute value for a currency
add/save: Add an amount of currency to your total
remove/spend: Remove an amount of currency from your total
reset: Reset your spark
quicksave: Quickly save all currencies\`\`\``)
    embed.addField("Currencies", `You can use both singular and plural words for currencies
\`\`\`crystals tickets tenticket\`\`\``)
    embed.addField("Quicksave", `This is the proper formatting for quicksave:
\`\`\`spark quicksave <crystals> <tickets> <tentickets>\`\`\``)

    message.channel.send(embed)
}

function quicksave(message) {
    let prefix = "$spark quicksave "
    let valueString = message.content.slice(prefix.length)
    let values = valueString.split(" ")

    updateSpark(values[0], values[1], values[2], message)
}

function remove(message, args) {
    if (!checkCurrency(message, args.currency)) {
        return
    }

    let transposedCurrency = transposeCurrency(args.currency)

    let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1`

    client.query(sql, [message.author.id], (err, res) => {
        if (err) {
            console.log(err.message)
        }

        let sum = res.rows[0].currency - args.amount
        updateCurrency(sum, transposedCurrency, message)
    })
}

function reset(message) {
    let sql = `UPDATE sparks SET crystals = 0, tickets = 0, ten_tickets = 0 WHERE user_id = $1`

    client.query(sql, [message.author.id], (err) => {
        if (err) {
            console.log(err.message)
        }

        message.reply("Your spark has been reset!")
    })
}

function set(message, args) {
    if (!checkCurrency(message, args.currency)) {
        return
    }
    
    updateCurrency(args.amount, transposeCurrency(args.currency), message)
}

function status(message) {
    getProgress(message)
}

// Helper methods
function calculateDraws(crystals, tickets, tenTickets) {
    let ticketValue = tickets * 300
    let tenTicketValue = tenTickets * 3000
    let totalCrystalValue = crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / 300)
}

function checkCurrency(message, currency) {
    let currencies = ["crystals", "tickets", "toclets", "tentickets"]
    var valid = true

    if (!currencies.includes(currency) && !currencies.includes(currency + "s")) {
        valid = false
        message.reply(`\`${currency}\` isn't a valid currency. The valid currencies are \`crystal\`, \`ticket\`, \`tenticket\` as well as their pluralized forms.`)
    }

    return valid
}

function checkIfUserExists(userId, callback) {
    let sql = 'SELECT COUNT(*) AS count FROM sparks WHERE user_id = $1'

    client.query(sql, [userId], (err, res) => {
        if (res.rows[0].count == 0) {
            createEntryForUser(userId, callback)
        } else {
            callback()
        }
    })
}

function createEntryForUser(userId, callback) {
    let sql = 'INSERT INTO sparks (user_id) VALUES ($1)'
    
    client.query(sql, [userId], function(err, res) {
        if (err) {
            console.log(err.message)
        }

        callback()
    })
}

function generateProgressString(message, crystals, tickets, tenTickets) {
    let draws = calculateDraws(crystals, tickets, tenTickets)
    let drawPercentage = Math.floor((draws / 300) * 100)
    
    let statusString = `You have ${crystals} ${pluralize('crystal', crystals)}, ${tickets} ${pluralize('ticket', tickets)}, and ${tenTickets} ${pluralize('10-ticket', tenTickets)} for a total of **${draws} draws.**`

    var progressString = ''
    if (draws >= 300) {
        let numSparks = Math.floor(draws / 300)
        let nextSparkPercentage = Math.floor(((draws - (numSparks * 300)) / 300) * 100)
        progressString = `Wow! You have **${numSparks} ${pluralize('spark', numSparks)}**. You have ${nextSparkPercentage}% towards your next spark.`
    } else {
        if (drawPercentage > 0) {
            progressString = `You're ${drawPercentage}% of the way there.`
        } else {
            progressString = `Time to start saving!`
        }
    }

    message.reply(`${statusString}\n\n${progressString}`)
}

function getProgress(message) {
    let sql = 'SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = $1'

    client.query(sql, [message.author.id], (err, res) => {
        let crystals = res.rows[0].crystals
        let tickets = res.rows[0].tickets
        let tenTickets = res.rows[0].ten_tickets

        generateProgressString(message, crystals, tickets, tenTickets)
    })
}

function switchOperation(message, args) {
    switch(args.operation) {
        case "add":
            add(message, args)
            break
        case "help":
            help(message)
            break
        case "quicksave":
            quicksave(message)
            break
        case "remove":
            remove(message, args)
            break
        case "reset":
            reset(message)
            break
        case "save":
            add(message, args)
            break
        case "set":
            set(message, args)
            break
        case "spend":
            remove(message, args)
            break
        case "status":
            status(message)
            break
        default:
            break
    }
}

function transposeCurrency(currency) {
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

function updateCurrency(amount, currency, message) {
    let sql = `UPDATE sparks SET ${currency} = $1 WHERE user_id = $2`
    let data = [amount, message.author.id]

    client.query(sql, data, (err) => {
        if (err) {
            console.log(err.message)
        }

        getProgress(message)
    })
}

function updateSpark(crystals, tickets, tenTickets, message) {
    let sql = `UPDATE sparks SET crystals = $1, tickets = $2, ten_tickets = $3 WHERE user_id = $4`
    let data = [crystals, tickets, tenTickets, message.author.id]

    client.query(sql, data, (err) => {
        if (err) {
            console.log(err.message)
        }

        getProgress(message)
    })
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