import { DiscordAPIError, Message, MessageEmbed } from 'discord.js'
import { Command } from 'discord-akairo'
import { Client } from '../services/connection'

const dayjs = require('dayjs')

type NullableStringDictionary = { [key: string]: string } | null

export class SieroCommand extends Command {
    args: { [key: string]: any } = {}
    commandType: string = ''
    message!: Message

    embedColor: number = 0xcb4b16

    // Utility methods
    public log(message: Message): void {
        const string = `(${this.timestamp()}) [${message.author.id}] ${message.content}`
        console.log(string)
    }

    public timestamp(): string {
        return dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    // Database methods
    public async fetchPrefix(guildId: string): Promise<string> {
        const sql = 'SELECT prefix FROM guilds WHERE id = $1 LIMIT 1'

        return await Client.oneOrNone(sql, guildId)
            .then((result: any) => {
                if (result && result.prefix) {
                    return result.prefix
                } else {
                    return '$'
                }
            })
            .catch(() => {
                console.error(`There was an error fetching a prefix for ${guildId}`)
            })
    }

    // Error methods
    public reportError(errorString: string, responseString: string, showDocumentationLink: boolean = false, targetedHelp: NullableStringDictionary = null) {
        const response = this.buildHelpfulResponse(responseString, showDocumentationLink, targetedHelp)
        
        const that = this
        this.message.author.send(response)
            .catch(function(error) {
                if (error instanceof DiscordAPIError) {
                    console.error(`Cannot send private messages to this user: ${that.message.author.id}`)
                    that.message.reply("There was an error, but it looks like I'm not allowed to send you direct messages! Check your Discord privacy settings if you'd like help with commands via DM.")

                }
            })
        
        console.error(errorString)
    }

    public buildHelpfulResponse(text: string, showDocumentationLink: boolean = false, targetedHelp: NullableStringDictionary = null) {
        var embed = new MessageEmbed({
            color: 0xb58900
        })

        if (showDocumentationLink) {
            embed.setDescription(`You can find the documentation for \`\$${this.commandType}\` at ${this.getLinkForContext()}, or you can type \`\$${this.commandType} help\``)
        }

        if (targetedHelp) {
            embed.addField(targetedHelp.title, targetedHelp.content)
        }

        embed.addField("You sent...", this.message.content)

        return {
            content: text,
            embed: embed
        }
    }

    public getLinkForContext() {
        var link = ""

        switch(this.commandType) {
            case 'gacha':
                link = "https://github.com/jedmund/siero-bot/wiki/Pulling-gacha"
                break
            case 'spark':
                link = "https://github.com/jedmund/siero-bot/wiki/Saving-sparks"
                break
            default:
                return false
        }

        return link
    }
}