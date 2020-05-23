const { DiscordAPIError, MessageEmbed } = require('discord.js')

const common = require('./common.js')

module.exports = {
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
    reportError: function(message, userId, context, error, responseText, showDescription = false, extraSection = null) {                
        let response = this.buildHelpfulResponse(message, responseText, context, showDescription, extraSection)
        
        message.author.send(response)
            .catch(function(error) {
                if (error instanceof DiscordAPIError) {
                    console.log(`Cannot send private messages to this user: ${userId}`)
                    message.reply("There was an error, but it looks like I'm not allowed to send you direct messages! Check your Discord privacy settings if you'd like help with commands via DM.")

                }
            })
        
        console.log(error)
    },
}