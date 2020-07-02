import { Message, MessageEmbed } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

class IrasshaiCommand extends SieroCommand {
    constructor() {
        super('irasshai', {
            aliases: ['irasshai', 'hello']
        })
    }

    exec(message: Message) {
        this.irasshai(message)
    }

    irasshai(message: Message) {
        const image = 'https://i.imgur.com/ZTT4uCO.jpg'
        const sound = 'http://game-a5.granbluefantasy.jp/assets_en/sound/voice/3050002000_v_206.mp3'

        const embed = new MessageEmbed({
            title: 'いらっしゃい！',
            description: '旅支度はシェロちゃんにおまかせ〜',
            color: this.embedColor,
            image: { url: image },
            fields: [
                {
                    name: 'Sound',
                    value: sound
                }
            ]
        })

        message.channel.send(embed)
    }
}

module.exports = IrasshaiCommand
