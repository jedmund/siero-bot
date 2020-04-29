const { Client } = require('../services/connection.js')
const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')
const pluralize = require('pluralize')

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
        this.storeMessage(message)
        this.storeUser(message.author.id)

        this.checkIfUserExists(message.author, message.guild, () => {
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
        Client.query(sql, [message.author.id])
            .then(res => {
                let sum = res[0].currency + args.amount
                this.updateCurrency(sum, transposedCurrency, message)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    remove(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
    
        let transposedCurrency = this.transposeCurrency(args.currency)
    
        let sql = `SELECT ${transposedCurrency} AS currency FROM sparks WHERE user_id = $1`
        Client.query(sql, [message.author.id])
            .then(res => {
                let sum = (res[0].currency - args.amount >= 0) ? res[0].currency - args.amount : 0
                this.updateCurrency(sum, transposedCurrency, message)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
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
    
        Client.query(sql, [message.author.id])
            .then(_ => {
                message.reply("Your spark has been reset!")
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })   
    }

    set(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
        
        this.updateCurrency(args.amount, this.transposeCurrency(args.currency), message)
    }

    async leaderboard(message, order = 'desc') {
        let sql = `SELECT username, crystals, tickets, ten_tickets, target_memo, last_updated, gacha.name, gacha.recruits FROM sparks LEFT JOIN gacha ON sparks.target_id = gacha.id WHERE last_updated > NOW() - INTERVAL '14 days' AND guild_ids @> $1`

        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        if (order === 'desc') {
            embed.setTitle("Leaderboard (Last 14 days)")
        } else {
            embed.setTitle("~~Leader~~ Loserboard (Last 14 days)")
        }

        let guildId = "{" + message.guild.id + "}"
        Client.query(sql, [guildId])
            .then(res => {
                if (res.length > 0) {
                    let rows = (order === 'desc') ? 
                        res.sort(this.compareProgress) :
                        res.sort(this.compareProgress).reverse()
                    
                    var maxItems = (rows.length > 10) ? 10 : rows.length
                    let usernameMaxChars = 15
                    let numDrawsMaxChars = 10
                    let targetMaxChars = 16

                    let divider = '+-----+' + '-'.repeat(usernameMaxChars + 2) + '+' + '-'.repeat(numDrawsMaxChars + 1) + '+' + '-'.repeat(targetMaxChars + 2) + '+\n'
                    var result = divider

                    for (var i = 0; i < maxItems; i++) {
                        let numDraws = this.calculateDraws(rows[i].crystals, rows[i].tickets, rows[i].ten_tickets)

                        let spacedUsername = this.spacedString(rows[i].username, usernameMaxChars)
                        let spacedDraws = this.spacedString(`${numDraws} draws`, numDrawsMaxChars)

                        var spacedTarget = ""
                        if (rows[i].recruits == null && rows[i].name == null && rows[i].target_memo != null) {
                            spacedTarget = this.spacedString(`${rows[i].target_memo} (U)`, targetMaxChars)
                        } else if (rows[i].recruits != null || rows[i].name != null) {
                            if (rows[i].recruits != null) {
                                spacedTarget = this.spacedString(rows[i].recruits, targetMaxChars)
                            } else if (rows[i].name != null) {
                                spacedTarget = this.spacedString(rows[i].name, targetMaxChars)
                            }
                        } else {
                            spacedTarget = this.spacedString("", targetMaxChars)
                        }

                        let place = ((i + 1) < 10) ? `${i + 1}  ` : `${i + 1} `

                        result += `| #${place}| ${spacedUsername} | ${spacedDraws}| ${spacedTarget} |\n`
                        result += divider
                    }
                    
                    embed.setDescription("```html\n" + result + "\n```")
                    message.channel.send(embed)
                } else {
                    message.channel.send("No one has updated their sparks in the last two weeks!")
                }
            })
            .catch(error => {
                console.log(sql)
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    status(message) {
        // var id = 0
        // if (message.mentions.users.values().next().value != undefined) {
        // id = message.mentions.users.values().next().value.id

        var id = message.author.id
        this.getProgress(message, id)
    }

    target(message) {
        let splitMessage = message.content.split(" ")

        var isUnreleased = false
        if (splitMessage.indexOf("unreleased") >= 0) {
            isUnreleased = true
            splitMessage.splice(splitMessage.indexOf("unreleased", 1))
        }

        let targetString = splitMessage.slice(3).join(" ")

        if (splitMessage.length >= 4 && splitMessage[2] == "set") {
            if (isUnreleased) {
                this.setAmbiguousTarget(message.author.id, targetString)
            } else {
                this.setTarget(message.author.id, targetString)
            }
        } else if (splitMessage.length == 2 || splitMessage[2] == "show") {
            this.showTarget(message.author.id)
        } else if (splitMessage.length == 2 || splitMessage[2] == "reset") {
            this.resetTarget(message)
        }
    }

    setTarget(userId, target) {
        this.resetTarget(this.message, false)

        let sql = [
            "UPDATE sparks SET target_id = (",
            "SELECT id FROM gacha",
            "WHERE name = $1 OR recruits = $1",
            "LIMIT 1)",
            "WHERE user_id = $2 RETURNING",
            "(SELECT name FROM gacha WHERE id = target_id),",
            "(SELECT recruits FROM gacha WHERE id = target_id),",
            "(SELECT rarity FROM gacha WHERE id = target_id)"
        ].join(" ")
        
        Client.any(sql, [target, userId])
            .then(data => {
                let embed = this.buildSparkTargetEmbed(data[0])
                this.message.channel.send(embed)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    setAmbiguousTarget(userId, target) {
        this.resetTarget(this.message, false)

        let sql = [
            "UPDATE sparks SET target_memo = $1",
            "WHERE user_id = $2",
        ].join(" ")

        Client.any(sql, [target, userId])
            .then(data => {
                let fauxData = {
                    "rarity": 3,
                    "name": `${target} (unreleased)`
                }

                let embed = this.buildSparkTargetEmbed(fauxData)
                this.message.channel.send(embed)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    showTarget(userId) {
        let sql = [
            "SELECT sparks.target_id, gacha.name, gacha.recruits, gacha.rarity FROM sparks",
            "LEFT JOIN gacha ON sparks.target_id = gacha.id",
            "WHERE user_id = $1 AND sparks.target_id IS NOT NULL"
        ].join(" ")

        Client.one(sql, [userId])
            .then(data => {
                let embed = this.buildSparkTargetEmbed(data)
                this.message.channel.send(embed)
            })
            .catch(error => {
                this.message.author.send(`It looks like you haven't set a spark target yet!`)
                console.log(error)
            })
    }

    resetTarget(message, reply = true) {
        let sql = `UPDATE sparks SET target_id = NULL, target_memo = NULL WHERE user_id = $1`
    
        Client.query(sql, [message.author.id])
            .then(_ => {
                if (reply) {
                    message.reply("Your spark target has been reset!")
                }
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    help(message) {
        let sparkOptions = [
            "```html\n",
            "<status>",
            "See how much you've saved\n",
            "<set>",
            "Save an absolute value for a currency\n",
            "<add/save>",
            "Add an amount of currency to your total\n",
            "<remove/spend>",
            "Remove an amount of currency from your total\n",
            "<quicksave>",
            "Quickly save all currencies\n",
            "<reset>",
            "Reset your spark\n",
            "<target>",
            "Set a target for your spark\n",
            "<leaderboard>",
            "See a leaderboard of everyone's spark progress```"
        ].join("\n")

        let currencies = [
            "You can use both singular and plural words for currencies",
            "```crystals tickets tenticket```"
        ].join("\n")

        let quicksave = [
            "This is the proper formatting for quicksave:",
            "```spark quicksave <crystals> <tickets> <tentickets>```"
        ].join("\n")

        let usingTargets = [
            "```html\n",
            "<target set @item>",
            "Set the provided @item as your spark target",
            "<target show>",
            "Show your current spark target",
            "<target reset>",
            "Reset your current spark target",
            "```"
        ].join("\n")

        var embed = new RichEmbed()
        embed.setTitle("Spark")
        embed.setDescription("Welcome! I can help you save your spark!")
        embed.setColor(0xdc322f)
        
        embed.addField("Command syntax", "```spark <option> <amount> <currency>```")
        embed.addField("Spark options", sparkOptions)
        embed.addField("Currencies", currencies)
        embed.addField("Quicksave", quicksave)
        embed.addField("Using Targets", usingTargets)
    
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
            case "target":
                this.target(message, args)
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
    checkIfUserExists(user, guild, callback) {
        let sql = 'SELECT COUNT(*) AS count FROM sparks WHERE user_id = $1'
    
        Client.one(sql, [user.id])
            .then(res => {
                if (res.count == 0) {
                    this.createRowForUser(user, guild, callback)
                } else {
                    callback()
                }
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }
    
    createRowForUser(user, guild, callback) {
        var sql
        var parameters

        if (guild != null) {
            sql = 'INSERT INTO sparks (user_id, guild_id, username) VALUES ($1, $2, $3)'
            parameters = [user.id, guild.id, user.username]
        } else {
            sql = 'INSERT INTO sparks (user_id, username) VALUES ($1, $2)'
            parameters = [user.id, user.username]
        }
        
        Client.any(sql, parameters)
            .then(_ => {
                callback()
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }
    
    getProgress(message) {
        let sql = 'SELECT crystals, tickets, ten_tickets FROM sparks WHERE user_id = $1'

        Client.one(sql, [message.author.id])
            .then(res => {
                let crystals = res.crystals
                let tickets = res.tickets
                let tenTickets = res.ten_tickets
        
                this.generateProgressString(message, crystals, tickets, tenTickets)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }
    
    async updateCurrency(amount, currency, message) {
        let sql = `UPDATE sparks SET ${currency} = $1, username = $2 WHERE user_id = $3`
        let data = [amount, message.author.username, message.author.id]
    
        await Client.query(sql, data)
            .then(_ => {
                this.getProgress(message)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    buildSparkTargetEmbed(target) {
        var rarity = this.mapRarity(target.rarity)

        var string = `<${rarity}> ${target.name}`
        if (target.recruits != null) {
            string += ` (${target.recruits})`
        }

        var embed = new RichEmbed()
        embed.setColor(0xb58900)
        embed.setTitle("Your spark target")
        embed.setDescription("```html\n" + string + "\n```")

        return embed
    }

    mapRarity(rarity) {
        var rarityString = ""

        if (rarity == 1) {
            rarityString = "R"
        } else if (rarity == 2) {
            rarityString = "SR"
        } else if (rarity == 3) {
            rarityString = "SSR"
        }

        return rarityString
    }
    
    updateSpark(crystals, tickets, tenTickets, message) {
        let sql = `UPDATE sparks SET crystals = $1, tickets = $2, ten_tickets = $3, username = $4 WHERE user_id = $5`
        let data = [crystals, tickets, tenTickets, message.author.username, message.author.id]
    
        Client.query(sql, data)
            .then(_ => {
                this.getProgress(message)
            })
            .catch(error => {
                this.message.author.send(`Sorry, there was an error with your last request.`)
                console.log(error)
            })
    }

    // Helper methods
    storeMessage(message) {
        this.message = message
    }

    storeUser(id) {
        this.userId = id
    }
}

module.exports = SparkCommand