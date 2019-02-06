const sqlite3 = require('sqlite3').verbose();
const pluralize = require('pluralize')
const { Command } = require('discord-akairo')

class SparkCommand extends Command {
    constructor() {
        super('spark', {
            aliases: ['spark'],
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

    let db = openDatabase()
    let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = ?`

    db.get(sql, [message.author.id], (err, row) => {
        if (err) {
            console.log(err.message)
        }

        let sum = row['currency'] + args.amount
        updateCurrency(sum, transposedCurrency, message)

        closeDatabase(db)
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

    let db = openDatabase()
    let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = ?`

    db.get(sql, [message.author.id], (err, row) => {
        if (err) {
            console.log(err.message)
        }

        let sum = row['currency'] - args.amount
        updateCurrency(sum, transposedCurrency, message)

        closeDatabase(db)
    })
}

function reset(message) {
    let db = openDatabase()
    let sql = `UPDATE sparks SET crystals = 0, tickets = 0, ten_tickets = 0 WHERE user_id = ?`

    db.run(sql, [message.author.id], (err) => {
        if (err) {
            console.log(err.message)
        }

        message.reply("Your spark has been reset!")

        closeDatabase(db)
    })
}

function set(message, args) {
    if (!checkCurrency(message, args.currency)) {
        return
    }
    
    updateCurrency(args.amount, transposedCurrency(args.currency), message)
}

function status(message) {
    getProgress(message)
}

// Database methods
function openDatabase() {
    return new sqlite3.Database('./db/siero.db', (err) => {
        if (err) {
            console.error(err.message)
        }

        console.log('Connected to the Knickknack Shack.')
    });
}

function closeDatabase(db) {
    db.close((err) => {
        if (err) {
          return console.error(err.message)
        }

        console.log('Closing the database connection.')
    });
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
    let db = openDatabase()
    let sql = 'SELECT COUNT(*) AS count FROM sparks WHERE user_id = ?'

    db.get(sql, [userId], (err, row) => {
        if (row['count'] == 0) {
            createEntryForUser(userId, callback)
        } else {
            callback()
        }

        closeDatabase(db)
    })
}

function createEntryForUser(userId, callback) {
    let db = openDatabase()
    let sql = 'INSERT INTO sparks (user_id) VALUES (?)'

    db.run(sql, [userId], function(err) {
        if (err) {
            console.log(err.message)
        }

        callback()

        closeDatabase(db)
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
    let db = openDatabase()
    let sql = 'SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = ?'

    db.get(sql, [message.author.id], (err, row) => {
        let crystals = row['crystals']
        let tickets = row['tickets']
        let tenTickets = row['ten_tickets']

        generateProgressString(message, crystals, tickets, tenTickets)

        closeDatabase(db)
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
    let db = openDatabase()
    let sql = `UPDATE sparks SET ${currency} = ? WHERE user_id = ?`
    let data = [amount, message.author.id]

    db.run(sql, data, (err) => {
        if (err) {
            console.log(err.message)
        }

        getProgress(message)

        closeDatabase(db)
    })
}

function updateSpark(crystals, tickets, tenTickets, message) {
    let db = openDatabase()
    let sql = `UPDATE sparks SET crystals = ?, tickets = ?, ten_tickets = ? WHERE user_id = ?`
    let data = [crystals, tickets, tenTickets, message.author.id]

    db.run(sql, data, (err) => {
        if (err) {
            console.log(err.message)
        }

        getProgress(message)

        closeDatabase(db)
    })
}

module.exports = SparkCommand