const { Client } = require('pg')
const { Command } = require('discord-akairo')
const { MessageCollector, RichEmbed } = require('discord.js')
const pluralize = require('pluralize')

const client = getClient()
client.connect()

class ProfileCommand extends Command {
    constructor() {
        super('profile', {
            aliases: ['profile', 'p'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: null
                },
                {
                    id: 'field',
                    type: 'string',
                    default: null
                },
                {
                    id: 'value',
                    type: 'string',
                    default: null
                }
            ]
        })
    }

    exec(message, args) {        
        if (args.operation == null || args.operation.includes("@")) {
            this.show(message)
        }

        this.checkIfUserExists(message.author.id, () => {
            this.switchOperation(message, args)
        })
    }

    // Command methods
    show(message) {
        this.getProfile(message)
    }

    set(message, args) {
        console.log(args)
        if (args.field == null) {
            this.directSet(message)
        } else {
            this.singleSet(message, args)
        }
    }

    async directSet(message) {
        message.author.send("Hello! Let's set up your profile. Type <skip> to skip a field.")
        
        let nickname = "Let's start with your nickname. **What should people call you?**"
        let pronouns = "What are your **preferred pronouns?**"
        let profileName = "Okay, what is your **in-game name** in Granblue Fantasy?"
        let profileID = "What is your **ID** in Granblue Fantasy? You can find this in `Menu` → `Friends` → `Search` → `ID`."
        let psnName = "Do you have a **Playstation Network** account? What is your username?"
        let steamName = "Do you have a **Steam** account? What is your username?"

        await this.promptField(message, nickname, "nickname", "nickname");
        await this.promptField(message, pronouns, "pronouns", "pronoun preference");
        await this.promptField(message, profileName, "granblue_name", "Granblue Fantasy name");
        await this.promptField(message, profileID, "granblue_id", "Granblue Fantasy ID");
        await this.promptField(message, psnName, "psn", "Playstation Network username");
        await this.promptField(message, steamName, "steam", "Steam username");

        message.author.send("That's all for now. Thanks for filling out your profile!");
    }

    async promptField(message, prompt, key, readable_key) {
        let firstMessage = await message.author.send(prompt)

        let filter = (response) => {
            return response.author.id == message.author.id
        }
        
        let collected = await firstMessage.channel.awaitMessages(filter, {
            maxMatches: 1,
            time: 60000
        }).catch(console.log)

        if (collected && collected.size > 0) {
            let value = collected.first().content
            this.saveField(message.author.id, key, value)
            message.author.send(`Your ${readable_key} has been set to \`${value}\`.`)
        } else await firstMessage.edit("Sorry, this command timed out.")
    }

    saveField(user_id, field, value, message = null) {
        let sql = `UPDATE profiles SET ${field} = $1 WHERE user_id = $2`
        let data = [value, user_id]

        var readableField = ""
        switch(field) {
            case "nickname":
                readableField = "nickname"
                break
            case "pronouns":
                readableField = "pronoun preference"
                break
            case "granblue_name":
                readableField = "Granblue Fantasy name"
                break
            case "granblue_id":
                readableField = "Granblue Fantasy ID"
                break
            case "psn":
                readableField = "Playstation Network username"
                break
            case "steam":
                readableField = "Steam username"
                break
        }


        client.query(sql, data, (err, res) => {
            if (err) {
                console.log(err.message)
            }

            if (res && message != null) {
                message.reply(`Successfully updated your ${readableField} to ${value}.`)
            }
        })
    }

    singleSet(message, args) {
        this.saveField(message.author.id, args.field, args.value, message)
    }

    help(message) {
        var embed = new RichEmbed()
        embed.setTitle("Profile")
        embed.setDescription("Welcome! You can make a profile here that others can see!")
        embed.setColor(0xdc322f)
        embed.addField("Command syntax", "```profile <option> <key> <value>```")
        embed.addField("Spark options", `\`\`\`html\n
<show>
Show your profile, or tag another Discord member to see their profile\n
<set>
Specify a field on your own profile to set it, or if you don't specify a field, we can fill it all out together!
    \`\`\``)
        embed.addField("Settable fields", `You can set the following fields individually: 
        \`\`\`nickname pronouns granblue_name granblue_id psn steam\`\`\``)
    
        message.channel.send(embed)
    }

    // Helper methods
    switchOperation(message, args) {
        switch(args.operation) {
            case "set":
                this.set(message, args)
                break
            case "show":
                this.show(message, args)
                break
            case "help":
                this.help(message)
                break
            default:
                break
        }
    }
    
    // Database methods
    checkIfUserExists(userId, callback) {
        let sql = 'SELECT COUNT(*) AS count FROM profiles WHERE user_id = $1'
    
        client.query(sql, [userId], (err, res) => {
            if (res.rows[0].count == 0) {
                this.createRowForUser(userId, callback)
            } else {
                callback()
            }
        })  
    }
    
    createRowForUser(userId, callback) {
        let sql = 'INSERT INTO profiles (user_id) VALUES ($1)'
        
        client.query(sql, [userId], function(err, res) {
            if (err) {
                console.log(err.message)
            }
    
            callback()
        })
    }
    
    getProfile(message) {
        var user

        let mentions = message.mentions.users.array()
        let sql = 'SELECT * FROM profiles WHERE user_id = $1'

        if (mentions.length > 0) {
            user = mentions[0]
        } else {
            user = message.author
        }

        client.query(sql, [user.id], (err, res) => {
            if (res.rows.length > 0) {
                let profile = {
                    "nickname": res.rows[0].nickname,
                    "pronouns": res.rows[0].pronouns,
                    "granblueName": res.rows[0].granblue_name,
                    "granblueId": res.rows[0].granblue_id,
                    "psn": res.rows[0].psn,
                    "steam": res.rows[0].steam
                }

                this.generateProfile(message, user, profile)
            } else {
                var reply = ""

                if (mentions.length > 0 && message.author.id != user.id) {
                    reply = `Sorry, ${user} hasn't filled out their profile yet.`
                } else {
                    reply = `Sorry, you haven't filled out your profile yet.`
                }

                message.channel.send(reply)
            }
        })
    }

    generateProfile(message, user, dict) {
        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        embed.setTitle(user.username)

        const fieldToDisplayStr = {
            nickname: 'Nickname',
            pronouns: 'Pronouns',
            granblueName: 'Granblue Fantasy name',
            granblueId: 'Granblue Fantasy ID',
            psn: 'Playstation Network',
            steam: 'Steam',
        }

        for (const field in dict) {
            if (dict[field]) {
                embed.addField(fieldToDisplayStr[field], dict[field])
            }
        }

        message.channel.send(embed)
    }
}

function getClient() {
    var c
    if (process.env.NODE_ENV == "development") {
        c = new Client({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DB,
            password: process.env.PG_PASSWORD,
            port: 5432,
        })
    } else {
        c = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: true
        })
    }

    return c
}

module.exports = ProfileCommand