import { Collection, CollectorFilter, Message, MessageEmbed, Snowflake, User } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'
import { spacedString } from '../helpers/common'

const { Client, pgpErrors } = require('../services/connection.js')

type StringResult = { [key: string]: string }
type NumberResult = { [key: string]: number}

interface ProfileArgs {
    operation: string | null
    field: string | null
    value: string | null
}

interface Profile {
    [index: string]: any,
    user_id: string,
    nickname: string,
    pronouns?: string,
    granblue_name?: string,
    granblue_id?: number,
    psn?: string,
    steam?: string,
    xbox?: string,
    gog?: string,
    genshin?: number,
    honkai?: string,
    switch?: string
}

let fieldMapping: StringResult = {
    'nickname'      : 'nickname',
    'pronouns'      : 'pronouns',
    'granblue_name' : 'Granblue Fantasy name',
    'granblue_id'   : 'Granblue Fantasy ID',
    'steam'         : 'Steam username',
    'psn'           : 'Playstation Network username',
    'switch'        : 'Nintendo Switch friend code',
    'honkai'        : 'Honkai Impact 3rd friend code',
    'genshin'       : 'Genshin Impact friend code',
    'xbox'          : 'Xbox Live gamertag',
    'gog'           : 'GOG username'
}

class ProfileCommand extends SieroCommand {
    skipWord: string = '<skip>'

    public constructor() {
        super('profile', {
            aliases: ['profile', 'p'],
            args: [
                { id: 'operation' },
                { id: 'field' },
                { id: 'value' }
            ]
        })
    }

    public exec(message: Message, args: ProfileArgs) {
        this.log(message)

        this.args = args
        this.message = message

        this.commandType = 'profiles'

        this.checkIfUserExists(this.commandType)
            .then((count: number) => {
                if (count == 0) {
                    this.createRowForUser(this.commandType)
                }

                return
            }).then(() => {
                if (message.channel.type !== 'dm') {
                    this.checkGuildAssociation(this.commandType)
                }
            }).then(() => {
                this.switchOperation(args)
            })
    }

    private embedMapping: StringResult = {
        'nickname'      : 'nickname',
        'pronouns'      : 'pronouns',
        'granblue_name' : 'Granblue Fantasy name',
        'granblue_id'   : 'Granblue Fantasy ID',
        'steam'         : 'Steam username',
        'psn'           : 'Playstation Network',
        'switch'        : 'Nintendo Switch',
        'xbox'          : 'Xbox Live',
        'genshin'       : 'Genshin Impact',
        'honkai'        : 'Honkai Impact 3rd',
        'gog'           : 'GOG'
    }


    private switchOperation(args: ProfileArgs) {
        switch(args.operation) {
            case 'set':
                this.set(args)
                break
            case 'show':
                this.show()
                break
            case 'directory':
                this.directory()
                break
            case 'help':
                this.help()
                break
            case 'wizard':
                this.wizard()
                break
            default:
                this.show()
                break
        }
    }

    private async set(args: ProfileArgs) {
        try {
            if (args.field && args.value) {
                let field: string = args.field
                let value: string = args.value

                if (!this.hasField(field)) {
                    let text = `Sorry, we don't currently accept the profile field \`${field}\`.`
                    let error = `[${this.commandType}] invalid profile field`

                    this.reportError(error, text)

                    return
                }

                this.saveField(field, value)
                    .then((result: StringResult) => {
                        if (result.user_id === this.message.author.id && result[field] === value) {
                            this.message.reply(`Your **${fieldMapping[field]}** has been set to \`${value}\``)
                        }
                    })
                    .catch((error) => {
                        console.error(error)
                    })
            } else {
                this.wizard()
            } 
        } catch(error) {
            console.error(error)
        }
    }

    private async show() {
        let target: User = this.extractTarget()

        this.fetchProfileData(target.id)
            .then((data: StringResult) => {
                if (this.message.guild && data.guild_ids.includes(this.message.guild.id)) {
                    let embed = this.renderProfile(target, data)
                    this.message.channel.send(embed)
                } else {
                    let text = 'Sorry, I can\'t show that profile on this server.'
                    let error = `[${this.commandType}] foreign server`
                    this.reportError(error, text)
                }
            })
            .catch((error) => {
                console.error(error)
            })
    }

    private async directory() {
        let game: string = this.args.field

        if (game == undefined) {
            this.message.reply('Please specify what field you want a directory for.')
        } else {
            await this.fetchHandles(game, this.guildmates())
                .then((embed: MessageEmbed) => {
                    this.message.channel.send(embed)
                })
                .catch((error: Error) => {
                    let text = 'Sorry, there was an error communicating with the database for your last request.'
                    this.reportError(error.message, text)
                })
        }
    }
    
    private async wizard() {
        let breath = 650

        let text1 = 'Let\'s set up your profile together!'
        this.message.channel.send(text1)
            .then(() => {
                if (this.message.channel != this.message.author.dmChannel) {
                    return this.sleep(breath)
                } else {
                    return
                }
            })
            .then(() => {
                if (this.message.channel != this.message.author.dmChannel) {
                    let text2 = 'I\'ll try to send you a direct message with the details.'
                    this.message.channel.send(text2)
                }
            })
            .then(() => {
                return this.sleep(breath)
            })
            .then(() => {
                let dmText = `If there\'s anything you want to skip, just let me know by typing \`${this.skipWord}\`.`
                this.message.author.send(dmText)
                    .catch(() => {
                        this.message.reply('It looks like you don\'t accept direct messages! You can set up your profile with `$profile set` instead.')
                    })
            })
            .then(() => {
                return this.sleep(breath)
            })
            .then(() => {
                this.fieldPrompts()
            })
            .catch((error: Error) => {
                console.error(error)
            })
    }

    private help() {
        let profileOptions = [
            '```html\n',
            '<show>',
            'Show your profile, or tag another Discord member to see their profile\n',
            '<set>',
            'Specify a single field to update\n',
            '<wizard>',
            'Set all fields at once with the profile creation wizard',
            '```'
        ].join('\n')

        let embed = new MessageEmbed({
            title: 'Profile',
            description: 'Welcome! You can make a profile here for others in your server to see!',
            color: 0xdc322f,
            fields: [
                {
                    name  : 'Command syntax',
                    value : '```profile <option> <key> <value>```'
                },
                {
                    name: 'Profile options',
                    value: profileOptions
                },
                {
                    name: 'Profile fields',
                    value: '```nickname pronouns granblue_name granblue_id psn steam switch xbox genshin honkai gog```'
                }
            ]
        })
        
        this.message.channel.send(embed)
    }

    private hasField(field: string) {
        let fields = Object.keys(fieldMapping)
        return fields.indexOf(field) != -1
    }

    private async fieldPrompts() {
        let keys = Object.keys(fieldMapping)
        for (var i = 0; i < keys.length; i++) {
            let field = keys[i]

            if (i == 0) {
                await this.promptUser(fieldMapping[field], field, 'First, ')
            } else if (i == keys.length - 1) {
                await this.promptUser(fieldMapping[field], field, 'Finally, ')
            } else {
                await this.promptUser(fieldMapping[field], field)
            }
        }

        this.fetchProfileData(this.message.author.id)
            .then((data: StringResult) => {
                let embed = this.renderProfile(this.message.author, data)
                let completed = 'Great! We\'re all done. Thanks for filling out your profile!'
                
                this.message.author.send({
                    content: completed,
                    embed: embed
                })
            })
    }

    private async promptUser(field: string, key: string, prefix: string = '') {
        let prompts: string[] = [
            'how about we set up your ',
            'what\'s your ',
            'do you have a ',
            'let\'s set your '
        ]

        let filter: CollectorFilter = (response) => {
            return response.author.id == this.message.author.id
        }

        let rand = Math.floor(this.random(0, prompts.length))
        let prompt = (prefix !== '') ? `${prefix}${prompts[rand]}${field}?` : `${this.capitalize(prompts[rand])}${field}?`

        let promptMessage: Message = await this.message.author.dmChannel.send(prompt)

        return promptMessage.channel.awaitMessages(filter, {
            max: 1,
            time: 90000,
            errors: ['time']
        })
        .then((response: Collection<Snowflake, Message>) => {
            if (response && response.size > 0) {
                let value = response.first()!.content

                if (value !== this.skipWord) {
                    this.saveField(key, value)
                } else {
                    promptMessage.channel.send('Okay, we won\'t fill out that field.')
                }
            }
        })
        .catch((_: Collection<Snowflake, Message>) => {
            promptMessage.channel.send(`It looks like you didn\'t send me your ${field} in time. Feel free to try again later!`)
        })
    }

    private extractTarget() {
        let mentions: User[] = this.message.mentions.users.array()
        return (mentions.length > 0) ? mentions[0] : this.message.author
    }

    private guildmates() {
        let memberIds: string[] = []
        this.message.guild?.members.cache.map((member) => memberIds.push(member.id))
        
        return memberIds
    }

    private renderProfile(target: User, profile: StringResult) {
        const embed = new MessageEmbed({
            title: `${target.username}'s profile`,
            color: 0xb58900
        })

        let fields = Object.keys(profile)
        let filteredFields = fields.filter((value) => { 
            return (value != 'user_id' && value != 'guild_ids')
        })

        let inline: boolean = (fields.length > 5) ? true : false

        for (var i = 0; i < filteredFields.length; i++) {
            let entry = filteredFields[i]
            let value = profile[entry]
            let title = this.capitalize(this.embedMapping[entry])

            embed.addField(title, value, inline)
        }

        return embed
    }

    // Database methods
    private async checkIfUserExists(table: string): Promise<number> {
        let sql: string = `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = $1`

        try {
            return await Client.one(sql, this.message.author.id)
                .then((result: NumberResult) => {
                    return result.count
                })
                .catch((error: Error) => {
                    console.error(error)
                })
        } catch(error) {
            console.error(error)
            return -1
        }
    }

    private async createRowForUser(table: string) {
        let sql: string = `INSERT INTO ${table} (user_id) VALUES ($1) RETURNING user_id`
        
        try {
            Client.one(sql, this.message.author.id)
                .then((_: StringResult) => {
                    console.log(`[${this.commandType}] New user created: ${this.message.author.id}`)
                })
                .catch((error: Error) =>  {
                    console.error(error)
                })
        } catch(error) {
            console.error(error)
        }
    }

    checkGuildAssociation(table: string) {
        let sql = [
            `SELECT user_id, guild_ids FROM ${table}`,
            'WHERE user_id = $1',
            'LIMIT 1'
        ].join(" ")

        Client.one(sql, this.message.author.id)
            .then((result: StringResult) => {
                let guilds = result.guild_ids
                if (!guilds || guilds && this.message.guild && !guilds.includes(this.message.guild.id)) {
                    this.createGuildAssociation(table)
                }
            })
            .catch((error: Error) => {
                console.error(error)
            })
    }

    createGuildAssociation(table: string) {
        let sql = [
            `UPDATE ${table}`,
            'SET guild_ids = array_cat(guild_ids, $1)',
            'WHERE user_id = $2'
        ].join(" ")

        if (this.message.guild) {
            Client.any(sql, ['{' + this.message.guild.id + '}', this.message.author.id])
                .catch((error: Error) => {
                    console.error(error)
                })
        } else {
            console.error('There was a problem fetching the guild')
        }
    }

    private async saveField(field: string, value: string): Promise<StringResult> {
        let sql: string = `UPDATE profiles SET ${field} = $1 WHERE user_id = $2 RETURNING user_id, ${field}`

        return await Client.one(sql, [value, this.message.author.id])
            .then((result: StringResult) => {
                return result
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database to save your profile.'
                this.reportError(error.message, text)
            })
    }

    private async fetchProfileData(userId: string): Promise<StringResult> {
        let sql = 'SELECT * FROM profiles WHERE user_id = $1 LIMIT 1'
        return await Client.one(sql, userId)
            .then((result: StringResult) => {
                return result
            })
            .catch((error: Error) => {
                if (error instanceof pgpErrors.QueryResultError) {
                    var reply = ''

                    const mentions: User[] = [...this.message.mentions.users.values()]
                    if (mentions.length > 0 && this.message.author.id != userId) {
                        reply = `It looks like ${mentions[0].username} hasn't filled out their profile yet.`
                    } else {
                        reply = 'Oops, you haven\'t filled out your profile yet.'
                    }

                    this.message.reply(reply)
                } else {
                    let text = 'Sorry, there was an error communicating with the database to fetch that profile.'
                    this.reportError(error.message, text)
                }
            })
    }

    private async fetchHandles(game: string, members: string[]): Promise<MessageEmbed> {
        let sql = `SELECT user_id, nickname, ${game} FROM profiles WHERE user_id IN ($1:csv) AND ${game} IS NOT NULL`
        return await Client.any(sql, [members])
            .then((result: Profile[]) => {
                return this.renderDirectory(game, result)
            })
    }

    private async renderDirectory(game: string, data: Profile[]) {
        let title = this.embedMapping[game]

        if (data.length == 0) {
            return `No one has set ${title} in their profile yet.`
        } else {
            let usernameMaxChars = 14
            let targetMaxChars = 14

            let divider = '+-----+' + '-'.repeat(usernameMaxChars + 2) + '+' + '-'.repeat(targetMaxChars + 2) + '+\n'
            var result = divider

            for (let item in data) {
                const user = await this.client.users.fetch(data[item].user_id)
                let spacedUsername = spacedString(user.username, usernameMaxChars)
                let spacedTarget = spacedString(data[item][game], targetMaxChars)

                result += `| ${spacedUsername} | ${spacedTarget}\n`
                result += divider
            }
            
            return new MessageEmbed({
                title: title,
                description: `\`\`\`html\n${result}\n\`\`\``,
                color: 0xb58900
            })
        }
    }

    private capitalize(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1)
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private random(min: number, max: number) {
        return min + Math.random() * (max - min);
    }
}

module.exports = ProfileCommand