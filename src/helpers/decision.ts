import { Client } from '../services/connection.js'
import { Collection, Message, MessageEmbed, MessageReaction, User } from 'discord.js'
import { Item, PromptResult } from '../services/constants.js'

const common = require('./common.js')
const pluralize = require('pluralize')

export class Decision {
    public static addOptions(message: Message, count: number): void {
        for (let i = 0; i < count; i++) {
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
    }

    public static generateOptions(data: Item[], target: string): string {
        let options: string = ""

        for (let [i, item] of data.entries()) {
            let string: string = `${i + 1}. `

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
    }

    public static async receiveSelection(message: Message, userId: string): Promise<number> {
        let possibleOptions: string[] = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '❓']

        const filter = (reaction: MessageReaction, user: User) => {
            return possibleOptions.includes(reaction.emoji.name) && user.id === userId
        }

        let value: number = -1
        
        await message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
            .then((collected: Collection<string, MessageReaction>) => {
                if (collected.first()) {
                    const reaction = collected.first()!
            
                    if (reaction.emoji.name === '1️⃣') {
                        value = 0
                    } else if (reaction.emoji.name === '2️⃣') {
                        value = 1
                    } else if (reaction.emoji.name === '3️⃣') {
                        value = 2
                    } else if (reaction.emoji.name === '4️⃣') {
                        value = 3
                    } else if (reaction.emoji.name === '5️⃣') {
                        value = 4
                    } else if (reaction.emoji.name === '6️⃣') {
                        value = 5
                    } else if (reaction.emoji.name === '7️⃣') {
                        value = 6
                    } else if (reaction.emoji.name === '8️⃣') {
                        value = 7
                    } else if (reaction.emoji.name === '9️⃣') {
                        value = 8
                    }
                }
            })
            .catch(error => {
                console.log(error)
                message.reply('You didn\'t react with a valid emoji.');
            })

        return value
    }
    
    public static buildDuplicateEmbed(data: Item[], target: string): MessageEmbed {
        const options: string = Decision.generateOptions(data, target)
        const count: number = data.length

        return new MessageEmbed({
            title:`${count} ${pluralize('result', count)} found`,
            description: `\`\`\`html\n${options}\n\`\`\``,
            color: 0xb58900
        })
    }

    public static async resolveDuplicate(targetName: string, message: Message, promptMessage: Message | null, userId: string): Promise<PromptResult> {
        const sql = [
            'SELECT id, name, recruits, rarity, item_type',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1'
        ].join(' ')

        let results: Item[] = []
        let newPromptMessage: Message | null
        return await Client.any(sql, targetName)
            .then((data: Item[]) => {
                results = data
                return Decision.buildDuplicateEmbed(data, targetName)
            })
            .then((embed: MessageEmbed) => {
                if (promptMessage) {
                    return promptMessage.edit(embed)
                } else {
                    return message.channel.send(embed)
                }
            })
            .then((newMessage: Message) => {
                newPromptMessage = newMessage
                Decision.addOptions(newMessage, results.length)
                
                return Decision.receiveSelection(newMessage, userId)
            })
            .then((selection: number) => {
                return {
                    message: newPromptMessage,
                    selection: results[selection]
                }
            })
    }
}