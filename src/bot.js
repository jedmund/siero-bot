require('dotenv').config()

const { AkairoClient, CommandHandler, ListenerHandler } = require('discord-akairo')

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

// const utility = require('./helpers/exportStickers.js')
// utility.exportListForGithub()
