import { Message, MessageEmbed } from 'discord.js'
const { SieroCommand } = require('../helpers/SieroCommand')

class HelpCommand extends SieroCommand {
    discordString = 'Come help with development or get support in Siero\'s Discord:\nhttps://discord.gg/37u2uz7'

    public constructor() {
        super('help', { aliases: ['help'] })
    }

    async exec(message: Message) {        
        this.log(message)

        this.message = message
        
        let embed = new MessageEmbed({
            title: 'Help',
            description: 'Welcome! How can I help you?',
            color: this.embedColor
        })
        
        if (message.channel.type !== 'dm') {
            await this.publicHelp(embed)
                .then((embed: MessageEmbed) => {
                    message.channel.send(embed)
                })
                .catch((error: any) => {
                    console.error(`(${this.timestamp()}) ${error}`)
                })
        } else {
            message.channel.send(this.dmHelp(embed))
        }
    }

    private dmHelp(embed: MessageEmbed): MessageEmbed {
        const commands = this.helpContent()
        const moreHelp = `You can get help on any of the above commands by typing \`help\` after the command, like so: 
                    \`\`\`$gacha help\`\`\``

        embed.addField('Commands', commands)
        embed.addField('Even more help', moreHelp)
        embed.addField('Support Discord', this.discordString)

        return embed
    }

    private async publicHelp(embed: MessageEmbed): Promise<MessageEmbed> {
        return await this.fetchPrefix(this.message.guild.id)
                .then((prefix: string) => {
                    const commands = this.helpContent(prefix)
                    const ownerCommands = this.adminHelpContent(prefix)
                    const moreHelp = `You can get help on any of the above commands by typing \`help\` after the command, like so: 
                    \`\`\`${prefix}gacha help\`\`\``

                    embed.addField('Commands', commands)
                    embed.addField('Owner Commands', ownerCommands)
                    embed.addField('Even more help', moreHelp)
                    embed.addField('Support Discord', this.discordString)

                    return embed
                })
                .catch(() => {
                    console.error('There was a problem fetching this server\'s prefix')
                })
    }

    private helpContent(prefix = '$') {
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

    private adminHelpContent(prefix = '$') {
        return [
            '```html',
            `<${prefix}prefix>`,
            'Set the command prefix for your server',
            '```'
        ].join('\n')
    }
}

module.exports = HelpCommand