// Set up environment variables
require('dotenv').config()

// Set up Discord
const Discord = require('discord.js')
const client = new Discord.Client()

// Let us know when Siero has connected to a server
client.on('ready', () => {
    console.log("Connected as " + client.user.tag)
})

// Log in to Discord with the secret token
client.login(process.env.DISCORD_SECRET)
