require('dotenv').config()

const sqlite = require('sqlite');
const { AkairoClient } = require('discord-akairo')

class SieroClient extends AkairoClient {
    constructor() {
        super({
            ownerID: '139468879008235520',
            prefix:  '$',
            commandDirectory: './commands/' 
        }, {
            disableEveryone: true
        })
    }
}

const client = new SieroClient()
client.login(process.env.DISCORD_SECRET)