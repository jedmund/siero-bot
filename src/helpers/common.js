const { Client } = require('../services/connection.js')
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

            return destination.includes(x)
        })
    },

    wrap(text) {
        return `(${text})`
    },

    parse: function(request) {
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

        // TODO: How can we prevent race conditions and 
        // match element and prefixes before the word OR after the word
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

        return {
            name: constructedName,
            gala: galaCross[0],
            season: seasonCross[0]
        }
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

    // Database methods
    fetchPrefix: async function(guildId) {
        const sql = 'SELECT prefix FROM guilds WHERE id = $1 LIMIT 1'

        return await Client.oneOrNone(sql, guildId)
            .then((result) => {
                if (result && result.prefix) {
                    return result.prefix
                } else {
                    return '$'
                }
            })
            .catch((error) => {
                console.error(`There was an error fetching a prefix for ${guildId}`)
            })
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

        return {
            text: text,
            error: error,
            section: section
        }
    }
}