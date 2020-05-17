const { Client } = require('../services/connection.js')
const { MessageEmbed } = require('discord.js')

const common = require('./common.js')
const pluralize = require('pluralize')

module.exports = {
    addOptions: function(message, count) {
        for (var i = 0; i < count; i++) {
            switch (i + 1) {
                case 1:
                    message.react("1️⃣")
                    break
                case 2:
                    message.react("2️⃣")
                    break
                case 3:
                    message.react("3️⃣")
                    break
                case 4:
                    message.react("4️⃣")
                    break
                case 5:
                    message.react("5️⃣")
                    break
                case 6:
                    message.react("6️⃣")
                    break
                case 7:
                    message.react("7️⃣")
                    break
                case 8:
                    message.react("8️⃣")
                    break
                case 9:
                    message.react("9️⃣")
                    break
                default:
                    message.react("❓")
                    break
            }
        }
    },
    generateOptions: function(data, target) {
        var options = ""

        for (const [i, item] of data.entries()) {
            var string = `${i + 1}. `

            if (item.item_type == 0) {
                string += `(${common.mapRarity(item.rarity)} Weapon) `
            } else {
                string += `(${common.mapRarity(item.rarity)} Summon) `
            }

            if (item.recruits != null) {
                if (item.name === target) {
                    string += `<${item.name}> - ${item.recruits}`
                } else if (item.recruits === target) {
                    string += `${item.name} - <${item.recruits}>`
                }
            } else {
                if (item.name === target) {
                    string += `<${item.name}>`
                } else {
                    string += `${item.name}`
                }
            }

            options += `${string}\n`
        }

        return options
    },
    receiveSelection: async function(message, userId) {
        console.log("Receive selection")
        let possibleOptions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '❓']
        const filter = (reaction, user) => {
            return possibleOptions.includes(reaction.emoji.name) && user.id === userId
        }

        try {
            console.log("Awaiting...")
            return await message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();
                
                    if (reaction.emoji.name === '1️⃣') {
                        return 0
                    } else if (reaction.emoji.name === '2️⃣') {
                        return 1
                    } else if (reaction.emoji.name === '3️⃣') {
                        return 2
                    } else if (reaction.emoji.name === '4️⃣') {
                        return 3
                    } else if (reaction.emoji.name === '5️⃣') {
                        return 4
                    } else if (reaction.emoji.name === '6️⃣') {
                        return 5
                    } else if (reaction.emoji.name === '7️⃣') {
                        return 6
                    } else if (reaction.emoji.name === '8️⃣') {
                        return 7
                    } else if (reaction.emoji.name === '9️⃣') {
                        return 8
                    } else {
                        return -1
                    }
                })
                .catch(error => {
                    console.log(error)
                    message.reply('You didn\'t react with a valid emoji.');
                })
        } catch (error) {
            console.log(error)
        }
    },
    buildDuplicateEmbed: function(data, target) {
        var options = this.generateOptions(data, target)
        let count = data.length

        var embed = new MessageEmbed()
        embed.setColor(0xb58900)
        embed.setTitle(`${count} ${pluralize('result', count)} found`)
        embed.setDescription("```html\n" + options + "\n```")

        return embed
    }
}