import { Message } from 'discord.js'

const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

const common = require('../helpers/common.js')
const stickers = require('../resources/stickers.js')

interface StickerArgs {
    alias: string | null
    language: string | null
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

    public exec(message: Message, args: StickerArgs) {
        common.storeUser(this, message.author.id)
        common.storeArgs(this, args)

        const alias: string = this.extractAlias()

        if (['list', 'help'].includes(alias)) {
            message.reply(this.buildHelpEmbed())
        } else {
            const sticker: string | null = this.sticker(alias)

            if (sticker != null) {
                message.channel.send(this.buildStickerEmbed(sticker))
            }
        }
    }

    private extractAlias() {
        var alias: string = ""

        if (this.args.alias == null) {
            alias = this.args.match[0]
        } else {
            alias = this.args.alias
        }

        if (alias.startsWith('jp')) {
            this.isJapanese = true
            alias = alias.substring(2).charAt(0).toLowerCase() + alias.substring(2).slice(1)
        }

        return alias
    }

    private buildHelpEmbed() {
        const link: string = 'https://github.com/jedmund/siero-bot/wiki/Using-stickers#available-stickers'
        const description: string = `You can also see a list of stickers with images on my wiki: ${link}`

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

    private sticker(alias: string) {
        var sticker: string | null = null

        if (Object.keys(stickers.list).includes(alias)) {
            if (this.isJapanese) {
                sticker = stickers.list[alias].jp
            } else {
                sticker = stickers.list[alias].en
            }
        }

        return sticker
    }
}

module.exports = StickerCommand
