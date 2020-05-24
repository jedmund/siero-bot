const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

class IrasshaiCommand extends Command {
    constructor() {
        super('irasshai', {
            aliases: ['irasshai', 'hello']
        })
    }

    exec(message) {
        this.irasshai(message.channel)
    }

    irasshai(channel) {
        var embed = new MessageEmbed()

        var image = 'https://i.imgur.com/ZTT4uCO.jpg'
        var description = '旅支度はシェロちゃんにおまかせ〜'
        var sound = 'http://game-a5.granbluefantasy.jp/assets_en/sound/voice/3050002000_v_206.mp3'

        embed.setColor(0xcb4b16)
        embed.setTitle('いらっしゃい！')
        embed.setDescription(description)
        embed.setImage(image)
        embed.addField('Sound', sound)

        channel.send(embed)
    }
}

module.exports = IrasshaiCommand
