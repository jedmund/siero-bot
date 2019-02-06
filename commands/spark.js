const sqlite3 = require('sqlite3').verbose();
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
                    id: 'currency',
                    type: 'string',
                    default: null
                },
                {
                    id: 'amount',
                    type: 'number',
                    default: 0
                }
            ]
        })
    }

    exec(message, args) {
        let currencies = ["crystals", "tickets", "tentickets"]

        if (!currencies.includes(args.currency) && !currencies.includes(args.currency + "s")) {
            return message.reply(`\`${args.currency}\` isn't a valid currency. The valid currencies are \`crystal\`, \`ticket\`, \`tenticket\` as well as their pluralized forms.`)
        }

        if (args.operation == "set") {
            return message.reply(set(message, args))
        }

        return message.reply(`${args.operation} ${args.currency} ${args.amount}`)
    }
}

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

        console.log('Close the database connection.')
    });
}

function checkIfExists(userId) {
    let db = openDatabase()

    let sql = 'SELECT COUNT(*) AS count FROM sparks WHERE user_id = ?'

    db.get(sql, [userId], (err, row) => {
        if (row['count'] == 0) {
            createEntry(userId)
        }

        closeDatabase(db)
    })
}

function getAmounts(userId) {
    let db = openDatabase()

    let sql = 'SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = ?'

    db.get(sql, [userId], (err, row) => {
        console.log(row)

        closeDatabase(db)
    })
}

function createEntry(userId) {
    let db = openDatabase()

    let sql = 'INSERT INTO sparks (user_id) VALUES (?)'

    db.run(sql, [userId], function(err) {
        if (err) {
            console.log(err.message)
        }

        console.log(this)

        closeDatabase(db)
    })
}

function transposedCurrency(currency) {
    if (['tenticket', 'tentickets'].includes(currency)) {
        return "ten_tickets"
    }

    if (currency.substr(-1) != "s") {
        return currency + "s"
    }

    return currency
}

function calculateDraws(crystals, tickets, tenTickets) {
    let ticketValue = tickets * 300
    let tenTicketValue = tenTickets * 3000
    let totalCrystalValue = crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / 300)
}

function set(message, args) {
    checkIfExists(message.author.id)

    let db = openDatabase()

    let sql = `UPDATE sparks SET ${transposedCurrency(args.currency)} = ? WHERE user_id = ?`
    let data = [args.amount, message.author.id]

    var amounts
    db.run(sql, data, (err) => {
        if (err) {
            console.log(err.message)
        }

        db.get('SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = ?', [message.author.id], (err, row) => {
            let crystals = row['crystals']
            let tickets = row['tickets']
            let tenTickets = row['ten_tickets']

            let draws = calculateDraws(crystals, tickets, tenTickets)
            
            console.log(`You have ${crystals} crystals, ${tickets} tickets, and ${tenTickets} 10-tickets for a total of ${draws} draws.`)
        })

        closeDatabase(db)
    })

    return "Set spark"
}

module.exports = SparkCommand