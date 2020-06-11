require('dotenv').config()

const { Client } = require('./services/connection.js')
const { AkairoClient, CommandHandler, ListenerHandler } = require('discord-akairo')
const pluralize = require('pluralize')

class SieroClient extends AkairoClient {
    constructor() {
        super({
            ownerID: process.env.OWNER_ID,
            allowMention: true,
            handleEdits: true,
            partials: ['MESSAGE']
        }, {
            disableEveryone: true
        })

        // Set up command handler
        this.commandHandler = new CommandHandler(this, {
            directory: './build/dist/commands/',
            loadFilter: filepath => filepath.slice(-3) === '.js',
            prefix: async message => {
                if (message.guild) {
                    return await this.fetchPrefix(message.guild.id)
                }

                return '$'
            }
        })

        this.commandHandler.loadAll()
    }

    async fetchPrefix(guildId) {
        const sql = 'SELECT prefix FROM guilds WHERE id = $1 LIMIT 1'

        return await Client.oneOrNone(sql, guildId)
            .then((result) => {
                if (result && result.prefix) {
                    return result.prefix
                } else {
                    return '$'
                }
            })
            .catch((error) => {
                console.error(`There was an error fetching a prefix for ${guildId}: ${error}`)
            })
    }
}

const client = new SieroClient()
client.login(process.env.DISCORD_SECRET)

client.once('ready', () => {
    console.log('Siero is online!')
    console.log(`Currently running for ${client.users.cache.size} ${pluralize('user', client.users.cache.size)} in ${client.guilds.cache.size} ${pluralize('server', client.guilds.cache.size)}.`)
})

// const utility = require('./helpers/exportStickers.js')
// utility.exportListForGithub()
