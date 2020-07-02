import { Message, MessageEmbed } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

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

class StickerCommand extends SieroCommand {
    public constructor() {
        super('sticker', {
            aliases: ['sticker', 'ss'],
            args: [
                { id: 'alias' },
                { id: 'language' }
            ],
            regex: /(?<=\:)(.*?)(?=\:)/
        })
    }

    public exec(message: Message, args: NullableStickerArgs) {
        this.message = message
        this.args = args

        const result: StickerArgs = this.extract()

        if (['list', 'help'].includes(result.alias)) {
            message.reply(this.buildHelpEmbed())
        } else {
            const sticker: Sticker = this.sticker(result.alias, result.language)

            if (sticker) {
                this.log(message)
                message.channel.send(this.buildStickerEmbed(sticker))
            }
        }
    }

    private extract(): StickerArgs {
        let alias: string = ""

        if (!this.args.alias) {
            alias = this.args.match[0]
        } else {
            alias = this.args.alias
        }

        const language: string = alias.startsWith('jp') ? 'jp' : 'en'
        alias = alias.startsWith('jp') ? alias.substring(2).charAt(0).toLowerCase() + alias.substring(2).slice(1) : alias

        return {
            alias: alias, 
            language: language 
        }
    }

    private buildHelpEmbed(): MessageEmbed {
        const link = 'https://github.com/jedmund/siero-bot/wiki/Using-stickers#available-stickers'
        const description = `You can also see a list of stickers with images on my wiki: ${link}`

        return new MessageEmbed({
            title: 'Stickers',
            description: description,
            color: this.embedColor
        })
    }

    private buildStickerEmbed(sticker: string): MessageEmbed {
        return new MessageEmbed({
            image: { url: sticker },
            color: this.embedColor
        })
    }

    private sticker(alias: string, language: string): Sticker {
        return (Object.keys(stickers.list).includes(alias)) ? 
            stickers.list[alias][language] : 
            null
    }
}

module.exports = StickerCommand
