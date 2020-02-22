const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

class HelpCommand extends Command {
    constructor() {
        super('help', {
            aliases: ['help', 'h'],
            args: []
        })
    }

    exec(message, args) {        
        var embed = new RichEmbed()
        embed.setTitle("Help")
        embed.setDescription("Welcome! Here are all the things I can do!")
        embed.setColor(0xdc322f)
        embed.addField("Commands", `\`\`\`html\n
<$gacha>
Roll the virtual gacha\n
<$profile>
Save useful information in your profile or see someone else's\n
<$spark> 
Log your progress while saving a spark\n
<$sticker>
Use a Granblue sticker in Discord\`\`\``)
        embed.addField("Even more help", `You can get help on any of the above commands by typing \`help\` after the command, like so: 
\`\`\`$gacha help\`\`\``)

        message.channel.send(embed)
    }
}

module.exports = HelpCommand