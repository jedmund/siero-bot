require('dotenv').config()

const sqlite = require('sqlite');
const { AkairoClient, SQLiteProvider } = require('discord-akairo')

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

let db = sqlite.open('./db/siero.db', (err) => {
    if (err) {
        console.log(err.message)
    }

    console.log('Connected to the Knickknack Shack')
})

const client = new SieroClient()
client.login(process.env.DISCORD_SECRET)