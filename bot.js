require('dotenv').config()

const { AkairoClient, CommandHandler, ListenerHandler } = require('discord-akairo')

class SieroClient extends AkairoClient {
    constructor() {
        super({
            ownerID: '139468879008235520',
            allowMention: true,
            handleEdits: true
        }, {
            disableEveryone: true
        })

        // Set up command handler
        this.commandHandler = new CommandHandler(this, {
            directory: './commands/',
            prefix: '$'
        })

        this.commandHandler.loadAll()

        // Set up listener handler
        this.listenerHandler = new ListenerHandler(this, {
            directory: './listeners/'
        })

        this.listenerHandler.loadAll()
    }
}

const client = new SieroClient()
client.login(process.env.DISCORD_SECRET)