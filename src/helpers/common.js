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

    sanitize: function(string) {
        let re = /[|;$%@"<>()+]/g
        return string.replace(re, '').toLowerCase()
    },

    intersection(source, destination) {
        return source.filter(x => {
            if (destination.includes(x)) {
                source.splice(source.indexOf(x), 1)
            }
<<<<<<< HEAD

            return destination.includes(x)
        })
    },

    wrap(text) {
        return `(${text})`
    },

    parse: function(request, properties = null) {
        let item = ''

        // Establish keywords
        let galas = ['premium', 'flash', 'legend', 'p', 'ff', 'lf']
        let elements = ['fire', 'water', 'earth', 'wind', 'dark', 'light']
        let seasons = ['halloween', 'holiday', 'summer', 'valentine']
        let suffixes = ['halloween', 'holiday', 'summer', 'valentine', 'themed', 'grand']
        
        // Establish blacklist
        let exceptions = [
            'fire piece', 'fire sword', 'fire baselard', 'fire glaive', 
            'water kukri', 'water rod', 'water balloons', 
            'earth cutlass', 'earth halberd', 'earth zaghnal', 'earth bow',
            'wind axe', 'wind rod',
            'light staff', 'light buckler', 'ghost light',
            'dark angel olivia', 'dark sword', 'dark knife'
        ]

        // Sanitize and split the string
        let string = this.sanitize(request)
        let parts = string.split(' ')

        // Determine if the target is in the exception list
        let excluded = false
        exceptions.forEach(x => {
            if (request.includes(x)) {
                excluded = true
            }
        })

        // Extract keywords from split string using arrays
        // Don't perform an element intersection if the excluded flag is on
        let elementCross = (excluded) ? [] : this.intersection(parts, elements)
        let galaCross = this.intersection(parts, galas)
        let seasonCross = this.intersection(parts, seasons)
        let suffixCross = this.intersection(parts, suffixes)

        // Rebuild the base item name
        const cleanedName = `${this.capitalize(parts.join(' '), true)}`

        // Reconstruct the item name with its suffixes
        let constructedName = cleanedName
        if (suffixCross.length == 1) {
            constructedName = `${cleanedName} ${this.wrap(this.capitalize(suffixCross[0]))}`
        } else if (elementCross.length == 1) {
            constructedName = `${cleanedName} ${this.wrap(this.capitalize(elementCross[0]))}`
        }

=======

            return destination.includes(x)
        })
    },

    wrap(text) {
        return `(${text})`
    },

    parse: function(request, properties = null) {
        let item = ''

        // Establish keywords
        let galas = ['premium', 'flash', 'legend', 'p', 'ff', 'lf']
        let elements = ['fire', 'water', 'earth', 'wind', 'dark', 'light']
        let seasons = ['halloween', 'holiday', 'summer', 'valentine']
        let suffixes = ['halloween', 'holiday', 'summer', 'valentine', 'themed', 'grand']
        
        // Establish blacklist
        let exceptions = [
            'fire piece', 'fire sword', 'fire baselard', 'fire glaive', 
            'water kukri', 'water rod', 'water balloons', 
            'earth cutlass', 'earth halberd', 'earth zaghnal', 'earth bow',
            'wind axe', 'wind rod',
            'light staff', 'light buckler', 'ghost light',
            'dark angel olivia', 'dark sword', 'dark knife'
        ]

        // Sanitize and split the string
        let string = this.sanitize(request)
        let parts = string.split(' ')

        // Determine if the target is in the exception list
        let excluded = false
        exceptions.forEach(x => {
            if (request.includes(x)) {
                excluded = true
            }
        })

        // Extract keywords from split string using arrays
        // Don't perform an element intersection if the excluded flag is on
        let elementCross = (excluded) ? [] : this.intersection(parts, elements)
        let galaCross = this.intersection(parts, galas)
        let seasonCross = this.intersection(parts, seasons)
        let suffixCross = this.intersection(parts, suffixes)

        // Rebuild the base item name
        const cleanedName = `${this.capitalize(parts.join(' '), true)}`

        // Reconstruct the item name with its suffixes
        let constructedName = cleanedName
        if (suffixCross.length == 1) {
            constructedName = `${cleanedName} ${this.wrap(this.capitalize(suffixCross[0]))}`
        } else if (elementCross.length == 1) {
            constructedName = `${cleanedName} ${this.wrap(this.capitalize(elementCross[0]))}`
        }

>>>>>>> Fixed the item parser
        return constructedName
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