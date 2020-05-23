const { Client, pgpErrors } = require('../services/connection.js')
const { Command } = require('discord-akairo')
const { DiscordAPIError, MessageEmbed } = require('discord.js')

const common = require('../helpers/common.js')
const decision = require('../helpers/decision.js')
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
        this.context = "spark"

        common.storeArgs(this, args)
        common.storeMessage(this, message)
        common.storeUser(this, message.author.id)

        this.checkIfUserExists(message.author, message.guild, () => {
            this.switchOperation(message, args)
        })

        if (message.channel.type !== 'dm') {
            this.checkGuildAssociation(message.author, message.guild)
        }
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })   
    }

    set(message, args) {
        if (!this.checkCurrency(message, args.currency)) {
            return
        }
        
        this.updateCurrency(args.amount, this.transposeCurrency(args.currency), message)
    }

    async leaderboard(message, order = 'desc') {
        if (message.channel.type === 'dm') {
            let text = 'Sorry, I can\'t show you leaderboards in direct messages. Please send the command from a server that we\'re both in!'
            let error = `Incorrect context: ${message.content}` 

            common.reportError(this.message, this.userId, this.context, error, text)

            return
        }

        let sql = `SELECT username, crystals, tickets, ten_tickets, target_memo, last_updated, gacha.name, gacha.recruits FROM sparks LEFT JOIN gacha ON sparks.target_id = gacha.id WHERE last_updated > NOW() - INTERVAL '14 days' AND guild_ids @> $1`

        var embed = new MessageEmbed()
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

                        let spacedUsername = common.spacedString(rows[i].username, usernameMaxChars)
                        let spacedDraws = common.spacedString(`${numDraws} draws`, numDrawsMaxChars)

                        var spacedTarget = ""
                        if (rows[i].recruits == null && rows[i].name == null && rows[i].target_memo != null) {
                            spacedTarget = common.spacedString(`${rows[i].target_memo} (U)`, targetMaxChars)
                        } else if (rows[i].recruits != null || rows[i].name != null) {
                            if (rows[i].recruits != null) {
                                spacedTarget = common.spacedString(rows[i].recruits, targetMaxChars)
                            } else if (rows[i].name != null) {
                                spacedTarget = common.spacedString(rows[i].name, targetMaxChars)
                            }
                        } else {
                            spacedTarget = common.spacedString("", targetMaxChars)
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
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
        } else {
            let text = 'Sorry, I don\'t recognize that command. Are you sure it\'s the right one?'
            let error = `Unrecognized command: ${message.content}`
            
            common.reportError(this.message, this.userId, this.context, error, text, true)
        }
    }

    setTarget(userId, target) {
        this.resetTarget(this.message, false)

        let sql = [
            "SELECT COUNT(*)",
            "FROM gacha",
            "WHERE name = $1 OR recruits = $1"
        ].join(" ")

        Client.any(sql, [target])
            .then(data => {
                if (data[0].count > 1) {
                    this.resolveDuplicate(target)
                } else {
                    this.saveTarget(userId, target)
                }
            })
            .catch(error => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    async resolveDuplicate(target) {
        let sql = [
            "SELECT id, name, recruits, rarity, item_type",
            "FROM gacha",
            "WHERE name = $1 OR recruits = $1"
        ].join(" ")

        try {
            var results
            await Client.any(sql, [target])
                .then(data => {
                    results = data
                    return decision.buildDuplicateEmbed(data, target)
                }).then(embed => {
                    return this.message.channel.send(embed)
                }).then(message => {
                    this.duplicateMessage = message
                    decision.addOptions(message, results.length)

                    return decision.receiveSelection(message, this.userId)
                }).then(selection => {
                    this.saveTargetById(this.userId, results[selection].id, this.duplicateMessage)
                }).catch(error => {
                    this.message.author.send(`Sorry, there was an error with your last request.`)
                        .catch(function(error) {
                            if (error instanceof DiscordAPIError) {
                                console.log(`Cannot send private messages to this user: ${userId}`)
                            }
                        })
                        .then(function() {
                            message.reply("There was an error, but it looks like I'm not allowed to send you direct messages! Check your Discord privacy settings if you'd like help with commands via DM.")
                        })
                    console.log(error)
                })
        } catch(error) {
            console.log(error)
        }
    }

    saveTarget(userId, target) {
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
                    .catch(function(error) {
                        if (error instanceof DiscordAPIError) {
                            console.log(`Cannot send private messages to this user: ${userId}`)
                        }
                    })
                    .then(function() {
                        message.reply("There was an error, but it looks like I'm not allowed to send you direct messages! Check your Discord privacy settings if you'd like help with commands via DM.")
                    })
                console.log(error)
            })
    }

    saveTargetById(userId, targetId, message) {
        let sql = [
            "UPDATE sparks SET target_id = (",
            "SELECT id FROM gacha",
            "WHERE id = $1",
            "LIMIT 1)",
            "WHERE user_id = $2 RETURNING",
            "(SELECT name FROM gacha WHERE id = target_id),",
            "(SELECT recruits FROM gacha WHERE id = target_id),",
            "(SELECT rarity FROM gacha WHERE id = target_id)"
        ].join(" ")
        
        Client.any(sql, [targetId, userId])
            .then(data => {
                let embed = this.buildSparkTargetEmbed(data[0])
                message.edit(embed)

                if (message.channel.type !== 'dm') {
                    message.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error))
                }
            })
            .catch(error => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    setAmbiguousTarget(userId, target) {
        this.resetTarget(this.message, false)

        let sql = [
            "UPDATE sparks SET target_memo = $1",
            "WHERE user_id = $2",
        ].join(" ")

        Client.any(sql, [target, userId])
            .then(_ => {
                let fauxData = {
                    "rarity": 3,
                    "name": `${target} (unreleased)`
                }

                let embed = this.buildSparkTargetEmbed(fauxData)
                this.message.channel.send(embed)
            })
            .catch(error => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
                
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
                var text
                var documentation = false
                
                if (error instanceof pgpErrors.QueryResultError) {
                    text = 'It looks like you haven\'t set a spark target yet!'
                    documentation = true
                } else {
                    text = 'Sorry, there was an error communicating with the database for your last request.'
                }

                let section = {
                    title: "Setting a spark target",
                    content: [
                        "```html\n",
                        "<target set @item>",
                        "Set the provided @item as your spark target",
                        "```"
                    ].join("\n")
                }

                common.reportError(this.message, this.userId, this.context, error, text, documentation, section)
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
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
            "Set the provided @item as your spark target\n",
            "<target show>",
            "Show your current spark target\n",
            "<target reset>",
            "Reset your current spark target",
            "```"
        ].join("\n")

        let link = "https://github.com/jedmund/siero-bot/wiki/Saving-sparks"

        var embed = new MessageEmbed(
            {
                title: "Spark",
                description: "Welcome! I can help you save your spark!",
                color: 0xdc322f
            }
        )
        
        embed.addField("Command syntax", "```spark <option> <amount> <currency>```")
        embed.addField("Spark options", sparkOptions)
        embed.addField("Currencies", currencies)
        embed.addField("Quicksave", quicksave)
        embed.addField("Using Targets", usingTargets)
        embed.addField("Full documentation", link)
    
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

            var text
            var section

            if (!isNaN(currency)) {
                text = `You might have reversed the currency and amount! \`${currency}\` is a number.`
                section = {
                    title: "You might mean...",
                    content: [
                        "```html\n",
                        `$spark ${this.args.operation} ${this.args.currency} tickets`,
                        `$spark ${this.args.operation} ${this.args.currency} crystals`,
                        "```"
                    ].join("\n")
                }
            } else {
                text = `\`${currency}\` isn't a valid currency.`
                section = {
                    title: "Valid currencies",
                    content: [
                        `The valid currencies are \`crystal\`, \`ticket\`, and \`tenticket\`. They also work pluralized!`,
                        "```html\n",
                        `$spark ${this.args.operation} 1 ticket`,
                        `$spark ${this.args.operation} 300 crystals`,
                        "```"
                    ].join("\n")
                }
            }
            
            let error = `Invalid currency: ${message.content}`
            common.reportError(this.message, this.userId, this.context, error, text, false, section)
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

    generateProgressString2(message, crystals, tickets, tenTickets) {
        let draws = this.calculateDraws(crystals, tickets, tenTickets)
        let drawPercentage = Math.floor((draws / 300) * 100)

        let embed = new MessageEmbed()

        message.channel.send(embed)
    }

    generateProgressString(message, crystals, tickets, tenTickets) {
        let draws = this.calculateDraws(crystals, tickets, tenTickets)

        let statusString = `You have ${crystals} ${pluralize('crystal', crystals)}, ${tickets} ${pluralize('ticket', tickets)}, and ${tenTickets} ${pluralize('10-ticket', tenTickets)} for a total of **${draws} draws.**`
        
        var numSparks = Math.floor(draws / 300)
        var progressString = ""

        if (numSparks > 0) {
            let remainder = draws - (numSparks * 300)
            let drawPercentage = Math.floor((remainder / 300) * 100)

            progressString = `You have **${numSparks} ${pluralize('spark', numSparks)}**`
            
            if (drawPercentage > 0) {
                progressString = `${progressString} and you've saved **${drawPercentage}%** towards your next spark.`
            } else {
                progressString = `${progressString}.`
            }
        } else {
            let drawPercentage = Math.floor((draws / 300) * 100)

            console.log(draws, drawPercentage)

            if (drawPercentage > 0 && drawPercentage < 25) {
                progressString = `You've got just **${drawPercentage}%** of a spark.`
            } else if (drawPercentage > 25 && drawPercentage < 75) {
                progressString = `You've saved **${drawPercentage}%** of a spark.`
            } else if (drawPercentage > 75 && drawPercentage < 100) {
                progressString = `Wow! You've saved **${drawPercentage}%** towards your spark.`
            } else {
                progressString = `Time to start saving!`
            }
        }
        
        message.reply(`${statusString} ${progressString}`)
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
                let text = 'Sorry, I don\'t recognize that command. Are you sure it\'s the right one?'
                let error = `Unrecognized command: ${message.content}`
               
                common.reportError(this.message, this.userId, this.context, error, text)
               
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    checkGuildAssociation(user, guild) {
        let sql = [
            "SELECT user_id, guild_ids FROM sparks",
            "WHERE user_id = $1",
            "LIMIT 1"
        ].join(" ")

        Client.one(sql, [user.id])
            .then(result => {
                let guilds = result.guild_ids
                if (!guilds.includes(guild.id)) {
                    this.createGuildAssociation(user, guild)
                }
            })
            .catch(error => {
                console.log(error)
            })
    }

    createGuildAssociation(user, guild) {
        let sql = [
            "UPDATE sparks",
            "SET guild_ids = array_cat(guild_ids, $1)",
            "WHERE user_id = $2"
        ].join(" ")

        Client.any(sql, ['{' + guild.id + '}', user.id])
            .then(result => {
                console.log(result)
            })
            .catch(error => {
                console.log(error)
            })
    }
    
    createRowForUser(user, guild, callback) {
        var sql
        var parameters

        if (guild != null) {
            sql = 'INSERT INTO sparks (user_id, guild_ids, username) VALUES ($1, $2, $3)'
            parameters = [user.id, '{' + guild.id + '}', user.username]
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
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
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, this.context, error, text)
            })
    }

    buildSparkTargetEmbed(target) {
        var rarity = common.mapRarity(target.rarity)

        var string = `<${rarity}> ${target.name}`
        if (target.recruits != null) {
            string += ` (${target.recruits})`
        }

        var embed = new MessageEmbed()
        embed.setColor(0xb58900)
        embed.setTitle("Your spark target")
        embed.setDescription("```html\n" + string + "\n```")

        return embed
    }

    updateSpark(crystals, tickets, tenTickets, message) {
        let sql = `UPDATE sparks SET crystals = $1, tickets = $2, ten_tickets = $3, username = $4 WHERE user_id = $5`
        let data = [crystals, tickets, tenTickets, message.author.username, message.author.id]
    
        Client.query(sql, data)
            .then(_ => {
                this.getProgress(message)
            })
            .catch(error => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(message, this.userId, error, text, this.context)
            })
    }
}

module.exports = SparkCommand