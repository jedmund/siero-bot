const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

class HelpCommand extends Command {
    constructor() {
        super('help', {
            aliases: ['help', 'h'],
            args: []
        })
    }

    exec(message, args) {        
        var embed = new MessageEmbed()
        embed.setTitle("Help")
        embed.setDescription("Welcome! Here are all the things I can do!")
        embed.setColor(0xdc322f)
        embed.addField("Commands", `\`\`\`html\n
<$gacha $g>
Roll the virtual gacha\n
<$profile $p>
Save useful information in your profile or see someone else's\n
<$spark $s> 
Log your progress while saving a spark\n
<$sticker $ss>
Use a Granblue sticker in Discord\`\`\``)
        embed.addField("Even more help", `You can get help on any of the above commands by typing \`help\` after the command, like so: 
\`\`\`$gacha help\`\`\``)
        embed.addField("Support Discord", 'Come help with development or get support in Siero\'s Discord:\nhttps://discord.gg/37u2uz7')

        message.channel.send(embed)
    }
}

module.exports = HelpCommand