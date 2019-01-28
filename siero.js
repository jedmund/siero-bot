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

function isInt(value) {
  return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
}

function sparkCommand(arguments, receivedMessage) {
    // Set the currencies for sparking
    let currencies = ["crystal", "ticket", "10ticket"]

    // Save convenience variables for the amount and currency
    let amount = arguments[1]
    let currency = arguments[2]

    // Check if the specified amount is numeric
    if (!isInt(amount)) {
        receivedMessage.channel.send(`\`${amount}\` isn't a numeric amount.`)
        return
    }

    // Check if the specified currency is accepted
    if (!currencies.includes(currency) && !currencies.includes(currency.slice(0, -1))) {
        receivedMessage.channel.send(`\`${currency}\` isn't a valid currency. The valid currencies are \`crystal ticket 10ticket\` as well as their pluralized forms.`)
        return
    }

    if (arguments[0] == "save") {
        receivedMessage.channel.send(`Saving ${amount} ${currency}`)
    }

    else if (arguments[0] == "spend") {
        receivedMessage.channel.send(`Spending ${amount} ${currency}`)
    }

    else if (arguments[0] == null) {
        receivedMessage.channel.send("Fetch operation")
    }

    else {
        receivedMessage.channel.send("That isn't a valid operation for `spark`")
    }
}


// Syntax
// !spark save 100 crystals
// !spark spend 100 crystals

// Log in to Discord with the secret token
client.login(process.env.DISCORD_SECRET)
