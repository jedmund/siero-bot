const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

class IrasshaiCommand extends Command {
    constructor() {
        super('irasshai', {
            aliases: ['irasshai', 'hello']
        })
    }

    exec(message, args) {
        var embed = new RichEmbed()
        embed.setColor(0xcb4b16)
        embed.setTitle("いらっしゃい！")
        embed.setDescription("旅支度はシェロちゃんにおまかせ〜\nhttp://game-a5.granbluefantasy.jp/assets_en/sound/voice/3050002000_v_206.mp3")
        embed.setImage("https://i.imgur.com/ZTT4uCO.jpg")

        message.channel.send(embed)
    }
}

module.exports = IrasshaiCommand