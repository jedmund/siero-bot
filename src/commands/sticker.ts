import { Message } from 'discord.js'

const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

const common = require('../helpers/common.js')
const stickers = require('../resources/stickers.js')

type Sticker = string | null
interface NullableStickerArgs {
    alias: string | null
    language: string | null
}
interface StickerArgs {
    alias: string
    language: string
}

class StickerCommand extends Command {
    public constructor() {
        super('sticker', {
            aliases: ['sticker', 'ss'],
            args: [
                { id: 'alias' },
                { id: 'language' }
            ],
            regex: ['(?<=\:)(.*?)(?=\:)']
        })
    }

    public exec(message: Message, args: NullableStickerArgs) {
        common.storeUser(this, message.author.id)
        common.storeArgs(this, args)

        console.log(`[${message.author.id}] ${message.content}`)

        const result: StickerArgs = this.extract()

        if (['list', 'help'].includes(result.alias)) {
            message.reply(this.buildHelpEmbed())
        } else {
            const sticker: Sticker = this.sticker(result.alias, result.language)

            if (sticker != null) {
                message.channel.send(this.buildStickerEmbed(sticker))
            }
        }
    }

    private extract() {
        let alias: string = ""

        if (!this.args.alias) {
            alias = this.args.match[0]
        } else {
            alias = this.args.alias
        }

        const language = alias.startsWith('jp') ? 'jp' : 'en'
        alias = alias.startsWith('jp') ? alias.substring(2).charAt(0).toLowerCase() + alias.substring(2).slice(1) : alias

        return { 
            alias: alias, 
            language: language 
        }
    }

    private buildHelpEmbed() {
        const link = 'https://github.com/jedmund/siero-bot/wiki/Using-stickers#available-stickers'
        const description = `You can also see a list of stickers with images on my wiki: ${link}`

        return new MessageEmbed({
            title: 'Stickers',
            description: description,
            color: 0xb58900
        })
    }

    private buildStickerEmbed(sticker: string) {
        return new MessageEmbed({
            image: { url: sticker },
            color: 0xb58900
        })
    }

    private sticker(alias: string, language: string): Sticker {
        let sticker: Sticker = null

        if (Object.keys(stickers.list).includes(alias)) {
            sticker = stickers.list[alias][language]
        }

        return sticker
    }
}

module.exports = StickerCommand
