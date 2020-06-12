const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')
const common = require('../helpers/common.js')
const dayjs = require('dayjs')

class HelpCommand extends Command {
    constructor() {
        super('help', {
            aliases: ['help'],
            args: []
        })
    }

    async exec(message, args) {        
        console.log(`(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${message.author.id}] ${message.content}`)
        
        let embed = new MessageEmbed({
            title: 'Help',
            description: 'Welcome! How can I help you?',
            color: 0xdc322f
        })

        const discord = 'Come help with development or get support in Siero\'s Discord:\nhttps://discord.gg/37u2uz7'

        if (message.channel.type !== 'dm') {
            await common.fetchPrefix(message.guild.id)
                .then((prefix) => {
                    const commands = this.helpContent(prefix)
                    const ownerCommands = this.adminHelpContent(prefix)
                    embed.addField('Commands', commands)
                    embed.addField('Owner Commands', ownerCommands)
                    embed.addField('Even more help', `You can get help on any of the above commands by typing \`help\` after the command, like so: 
\`\`\`${prefix}gacha help\`\`\``)
                    embed.addField('Support Discord', discord)
                    message.channel.send(embed)
                })
        } else {
            const commands = this.helpContent()
            embed.addField('Commands', commands)
            embed.addField('Even more help', `You can get help on any of the above commands by typing \`help\` after the command, like so: 
\`\`\`$gacha help\`\`\``)
            embed.addField('Support Discord', discord)
            message.channel.send(embed)
        }
    }

    helpContent(prefix = '$') {
        return [
            '```html',
            `<${prefix}gacha> or <${prefix}g>`,
            'Simulate gacha pulls\n',
            `<${prefix}profile> or <${prefix}p>`,
            'Save a profile with your gaming usernames, or see someone else\'s\n',
            `<${prefix}schedule> or <${prefix}sc>`,
            'Show the upcoming schedule for Granblue Fantasy\n',
            `<${prefix}spark> or <${prefix}s>`,
            'Log your spark progress, or see someone else\'s\n',
            `<${prefix}sticker> or <${prefix}ss>`,
            'Use a Granblue Fantasy sticker in Discord',
            '```'
        ].join('\n')
    }

    adminHelpContent(prefix = '$') {
        return [
            '```html',
            `<${prefix}prefix>`,
            'Set the command prefix for your server',
            '```'
        ].join('\n')
    }
}

module.exports = HelpCommand