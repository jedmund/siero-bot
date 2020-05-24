require('dotenv').config()

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
            prefix: '$'
        })

        this.commandHandler.loadAll()
    }
}

const client = new SieroClient()
client.login(process.env.DISCORD_SECRET)

client.once('ready', () => {
    console.log('Siero is online!')
    console.log(`Currently running for ${client.users.cache.size} ${pluralize('user', client.users.cache.size)} in ${client.guilds.cache.size} ${pluralize('server', client.guilds.cache.size)}.`)
})