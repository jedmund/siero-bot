const Discord = require('discord.js')
const client = new Discord.Client()

client.on('ready', () => {
    console.log("Connected as " + client.user.tag)
})

bot_secret_token = ""

// Log in to Discord with the secret token
client.login(bot_secret_token)
