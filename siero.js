// Set up environment variables
require('dotenv').config()

// Set up Discord
const Discord = require('discord.js')
const client = new Discord.Client()

// Let us know when Siero has connected to a server
client.on('ready', () => {
    console.log("Connected as " + client.user.tag)
})

// Respond to messages
client.on('message', (receivedMessage) => {
    // Siero shouldn't respond to her own messages
    if (receivedMessage.author == client.user) {
        return
    }

    if (receivedMessage.content.startsWith("!")) {
        processCommand(receivedMessage)
    }
})

function processCommand(receivedMessage) {
    // Remove the leading exclamation mark
    let fullCommand = receivedMessage.content.substr(1)

    // Split the message up into pieces for each space
    let splitCommand = fullCommand.split(" ")

    // Get the first word directly after the exclamation mark
    let primaryCommand = splitCommand[0]

    // Separate all other arguments or parameters
    let arguments = splitCommand.slice(1)

    console.log("Command received: " + primaryCommand)
    console.log("Arguments: " + arguments)

    if (primaryCommand == "spark") {
        sparkCommand(arguments, receivedMessage)
    }
}

// Log in to Discord with the secret token
client.login(process.env.DISCORD_SECRET)
