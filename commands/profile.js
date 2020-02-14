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
                    default: 'status'
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
            this.singleSet(message)
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

    saveField(user_id, field, value) {
        let sql = `UPDATE profiles SET ${field} = $1 WHERE user_id = $2`
        let data = [value, user_id]

        client.query(sql, data, (err) => {
            if (err) {
                console.log(err.message)
            }
        })
    }

    singleSet(message, args) {

    }

    help(message) {
        var embed = new RichEmbed()
        embed.setTitle("Profile")
        embed.setDescription("Welcome! You can make a profile here that others can see!")
        embed.setColor(0xdc322f)
        embed.addField("Command syntax", "```profile <option> <key> <value>```")
        embed.addField("Spark options", `\`\`\`show: Show your profile, or tag another Discord member to see their profile
    set: Specify a field on your own profile to set it, or if you don't specify a field, we can fill it all out together!
    \`\`\``)
        embed.addField("Currencies", `You can use both singular and plural words for currencies
    \`\`\`crystals tickets tenticket\`\`\``)
        embed.addField("Quicksave", `This is the proper formatting for quicksave:
    \`\`\`spark quicksave <crystals> <tickets> <tentickets>\`\`\``)
    
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
        let sql = 'SELECT granblue_name, granblue_id, psn, steam FROM profiles WHERE user_id = $1'

        var user
        let mentions = message.mentions.users.array()

        if (mentions.count > 0) {
            user = mentions[0]
        } else {
            user = message.author
        }

        client.query(sql, [user.id], (err, res) => {
            if (res.rowCount > 0) {
                let granblueName = res.rows[0].granblue_name
                let granblueID = res.rows[0].granblue_id
                let psn = res.rows[0].psn
                let steam = res.rows[0].steam
        
                this.generateProfile(message, user, granblueName, granblueID, psn, steam)
            } else {
                var id = message.mentions.users.values().next().value
                message.reply(`It looks like ${id} hasn't filled out their profile yet.`)
            }
        })
    }

    generateProfile(message, user, granblueName, granblueID, psn, steam) {
        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        embed.setTitle(user.username)
        embed.addField("Granblue Fantasy name", granblueName)
        embed.addField("Granblue Fantasy ID", granblueID)
        embed.addField("Playstation Network", psn)
        embed.addField("Steam", steam)

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