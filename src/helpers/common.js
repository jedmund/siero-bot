const { DiscordAPIError, MessageEmbed } = require('discord.js')
const { pgpErrors } = require('../services/connection.js')

const common = require('./common.js')

module.exports = {
    capitalize: function(string, allWords = false) {
        const blacklist = ['of', 'the', 'for', 'and']
        if (allWords) {
            return string.split(' ').map((item) => {
                if (!blacklist.includes(item)) { 
                    return item.charAt(0).toUpperCase() + item.slice(1) 
                } else {
                    return item
                }
            }).join(' ')
        } else {
            return string.charAt(0).toUpperCase() + string.slice(1)
        }
    },

    parse: function(request, properties = null) {
        let rq = request

        if (properties) {
            const splitRequest = request.split(' ')
            const reducedRequest = [splitRequest, [properties.gala, properties.season]].reduce((a, c) => a.filter(i => !c.includes(i)))
            rq = reducedRequest.join(' ')
        }

        let target = this.capitalize(rq, true)

        // match unwrapped 'grand'
        // ex: $g until io grand lf
        const re1 = /(?!\()grand(?!\))/ig
        if (target.match(re1)) {
            const match = target.match(re1)
            target = target.replace(match, '(Grand)')
        }

        // match lowercase wrapped 'grand'
        // ex: $g until io (grand) lf
        const re2 = /\(grand\)/g
        if (target.match(re2)) {
            const match = target.match(re2)
            target = target.replace(match, '(Grand)')
        }
        
        return target
    },

    mapRarity: function(rarity) {
        var rarityString = ""

        if (rarity == 1) {
            rarityString = "R"
        } else if (rarity == 2) {
            rarityString = "SR"
        } else if (rarity == 3) {
            rarityString = "SSR"
        }

        return rarityString
    },

    spacedString: function(string, maxNumChars) {
        let numSpaces = maxNumChars - string.length
        var spacedString = string

        for (var i = 0; i < numSpaces; i++) {
            spacedString += " "
        }

        return spacedString
    },

    // Property persistance methods
    storeArgs: function(that, args) {
        that.args = args
    },
    storeMessage: function(that, message) {
        that.message = message
    },
    storeUser: function(that, id) {
        that.userId = id
    },

    // Error methods
    buildHelpfulResponse: function(message, errorText, context, description = false, extraSection = null) {
        var embed = new MessageEmbed({
            color: 0xb58900
        })

        if (description) {
            embed.setDescription(`You can find the documentation for \`\$${context}\` at ${this.getLinkForContext(context)}, or you can type \`\$${context} help\``)
        }

        if (extraSection != null) {
            embed.addField(extraSection.title, extraSection.content)
        }

        embed.addField("You sent...", message.content)

        return {
            content: errorText,
            embed: embed
        }
    },
    calculateDraws: function(crystals, tickets, tenTickets) {
        let ticketValue = tickets * 300
        let tenTicketValue = tenTickets * 3000
        let totalCrystalValue = crystals + ticketValue + tenTicketValue
    
        return Math.floor(totalCrystalValue / 300)
    },
    getLinkForContext: function(context) {
        var link = ""

        switch(context) {
            case "gacha":
                link = "https://github.com/jedmund/siero-bot/wiki/Pulling-gacha"
                break
            case "spark":
                link = "https://github.com/jedmund/siero-bot/wiki/Saving-sparks"
                break
            default:
                return false
        }

        return link
    },
    missingItem: function(message, userId, context, name) {
        var text = ""
        var section = {
            title: "Did you mean...",
            content: ""
        }

        let error = `[Item not found] ${userId}: ${message.content}`
        text = `We couldn\'t find \`${name}\` in our database. Double-check that you're using the correct item name and that the name is properly capitalized.`
        
        let hasUpperCase = /[A-Z]/.test(name)
        if (!hasUpperCase) {
            let prediction = name.split(' ').map(function(word) {
                return word.charAt(0).toUpperCase() + word.slice(1)
            }).join(' ')

            let command = message.content.substring(0, message.content.indexOf(name))

            section.content = `\`\`\`${command}${prediction}\`\`\``
        } else {
            section = null
        }
        
        this.reportError(message, userId, context, error, text, false, section)
    },
    reportError: function(message, userId, context, error, responseText, showDescription = false, extraSection = null) {                
        let response = this.buildHelpfulResponse(message, responseText, context, showDescription, extraSection)
        
        message.author.send(response)
            .catch(function(error) {
                if (error instanceof DiscordAPIError) {
                    console.error(`Cannot send private messages to this user: ${userId}`)
                    message.reply("There was an error, but it looks like I'm not allowed to send you direct messages! Check your Discord privacy settings if you'd like help with commands via DM.")

                }
            })
        

        console.error(error)
    },
}