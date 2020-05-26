import { Collection, CollectorFilter, Message, Snowflake, User } from 'discord.js'

const { Client } = require('../services/connection.js')
const { Command } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')

const common = require('../helpers/common.js')

type StringResult = { [key: string]: string }
type NumberResult = { [key: string]: number}

interface ProfileArgs {
    operation: string | null
    field: string | null
    value: string | null
}

// let fieldMapping = [
//     {
//         key: 'nickname',
//         value: 'nickname'
//     },
//     {
//         key: 'pronouns',
//         value: 'pronouns'
//     },
//     {
//         key: 'granblue_name',
//         value: 'Granblue Fantasy name'
//     },
//     {
//         key: 'granblue_id',
//         value: 'Granblue Fantasy ID'
//     },
//     {
//         key: 'steam',
//         value: 'Steam username'
//     },
//     {
//         key: 'psn',
//         value: 'Playstation Network username'
//     },
//     {
//         key: 'switch',
//         value: 'Nintendo Switch friend code'
//     },
//     {
//         key: 'xbox',
//         value: 'Xbox Live gamertag'
//     },
//     {
//         key: 'gog',
//         value: 'GOG username'
//     }
// ]

let fieldMapping: StringResult = {
    'nickname'      : 'nickname',
    'pronouns'      : 'pronouns',
    'granblue_name' : 'Granblue Fantasy name',
    'granblue_id'   : 'Granblue Fantasy ID',
    'steam'         : 'Steam username',
    'psn'           : 'Playstation Network username',
    'switch'        : 'Nintendo Switch friend code',
    'xbox'          : 'Xbox Live gamertag',
    'gog'           : 'GOG username'
}

class ProfileCommand extends Command {
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
        common.storeMessage(this, message)
        common.storeUser(this, message.author.id)

        let table: string = 'profiles'

        this.checkIfUserExists(table)
            .then((count: number) => {
                if (count == 0) {
                    this.createRowForUser(table)
                }

                return
            }).then(() => {
                this.switchOperation(args)
            })
    }

    private switchOperation(args: ProfileArgs) {
        switch(args.operation) {
            case 'set':
                this.set(args)
                break
            case 'show':
                this.show()
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

                // TODO: Check if field is accepted
                this.saveField(field, value)
                    .then((result: StringResult) => {
                        if (result.user_id === this.userId && result[field] === value) {
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
                let embed = this.renderProfile(target, data)
                this.message.channel.send(embed)
            })
            .catch((error) => {

            })
       
        // TODO: Add error messages
        // if (mentions.length > 0 && message.author.id != user.id) {
        //     reply = `Sorry, ${user} hasn't filled out their profile yet.`
        // } else {
        //     reply = `Sorry, you haven't filled out your profile yet.`
        // }
    }
    
    private async wizard() {
        this.skipWord = '<skip>'

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
                // TODO: Check if have DM privileges

                if (this.message.channel != this.message.author.dmChannel) {
                    let text2 = 'I\'ll send you a direct message with the details.'
                    this.message.channel.send(text2)
                }
            })
            .then(() => {
                return this.sleep(breath)
            })
            .then(() => {
                let dmText = `If there\'s anything you want to skip, just let me know by typing \`${this.skipWord}\`.`
                this.message.author.send(dmText)
            })
            .then(() => {
                return this.sleep(breath * 2)
            })
            .then(() => {
                this.fieldPrompts()
            })
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

        let completed = 'Great! We\'re all done. Thanks for filling out your profile!'
        this.message.author.send(completed)
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
        .catch((error) => {
            console.log
        })
    }

    private extractTarget() {
        let mentions: [User] = this.message.mentions.users.array()
        return (mentions.length > 0) ? mentions[0] : this.message.author
    }

    private renderProfile(target: User, profile: StringResult) {
        const embed = new MessageEmbed({
            title: `${target.username} 's profile`,
            color: 0xb58900
        })

        for (const entry in profile) {
            let value = profile[entry]

            if (value && entry != 'user_id') {
                let title = this.capitalize(fieldMapping[entry])
                embed.addField(title, value)
            }
        }

        return embed
    }

    // Database methods
    private async checkIfUserExists(table: string): Promise<number> {
        let sql: string = `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = $1`

        try {
            return await Client.one(sql, this.userId)
                .then((result: NumberResult) => {
                    return result.count
                })
                .catch(error => {
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
            Client.one(sql, this.userId)
                .then((_: StringResult) => {
                    console.log(`[${table}] New user created: ${this.userId}`)
                })
                .catch(error => {
                    console.error(error)
                })
        } catch(error) {
            console.error(error)
        }
    }

    private async saveField(field: string, value: string): Promise<StringResult> {
        let sql: string = `UPDATE profiles SET ${field} = $1 WHERE user_id = $2 RETURNING user_id, ${field}`

        return await Client.one(sql, [value, this.userId])
            .then((result: StringResult) => {
                return result
            })
            .catch((error) => {
                console.error(error)
            })
    }

    private async fetchProfileData(userId: string): Promise<StringResult> {
        let sql = 'SELECT * FROM profiles WHERE user_id = $1 LIMIT 1'
        return await Client.one(sql, userId)
            .then((result: StringResult) => {
                return result
            })
            .catch((error) => {
                console.error(error)
            })
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

//     help(message) {
//         var embed = new MessageEmbed()
//         embed.setTitle("Profile")
//         embed.setDescription("Welcome! You can make a profile here that others can see!")
//         embed.setColor(0xdc322f)
//         embed.addField("Command syntax", "```profile <option> <key> <value>```")
//         embed.addField("Spark options", `\`\`\`html\n
// <show>
// Show your profile, or tag another Discord member to see their profile\n
// <set>
// Run the profile setup wizard, or you can specify a single field from the keys below to update a single key
//     \`\`\``)
//         embed.addField("Settable fields", `You can set the following fields individually: 
//         \`\`\`nickname pronouns granblue_name granblue_id psn steam\`\`\``)
    
//         message.channel.send(embed)
//     }

//     // Helper methods
//     switchOperation(message, args) {
//         switch(args.operation) {
//             case "set":
//                 this.set(message, args)
//                 break
//             case "show":
//                 this.show(message, args)
//                 break
//             case "help":
//                 this.help(message)
//                 break
//             default:
//                 break
//         }
//     }