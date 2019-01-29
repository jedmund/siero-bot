// Set up environment variables
require('dotenv').config()

// Set up Discord
const Discord = require('discord.js')
const discordClient = new Discord.Client()

// Set up Postgres
const pg = require('pg')
const postgresClient = new pg.Client(process.env.DATABASE_URL)
postgresClient.connect()

// Let us know when Siero has connected to a server
discordClient.on('ready', () => {
    console.log("Connected as " + discordClient.user.tag)
})

// Respond to messages
discordClient.on('message', (receivedMessage) => {
    // Siero shouldn't respond to her own messages
    if (receivedMessage.author == discordClient.user) {
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

    console.log(`Command received from ${receivedMessage.author.id} on ${receivedMessage.guild.id}`)
    console.log("Command received: " + primaryCommand)
    console.log("Arguments: " + arguments)

    authenticate(receivedMessage)

    if (primaryCommand == "spark") {
        sparkCommand(arguments, receivedMessage)
    }
}

function isInt(value) {
  return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
}

function authenticate(receivedMessage) {
    // Save convenience variables for the amount and currency
    let userId = receivedMessage.author.id
    let serverId = receivedMessage.guild.id

    postgresClient.query(
        'SELECT * FROM users WHERE id=($1) AND server_id=($2)',
        [userId, serverId],
        (err, res) => {
            if (err) {
                console.log(err)
            }

            if (res.rows.length == 0) {
                register(userId, serverId)
            }
        }
    )
}

function register(userId, serverId) {
    postgresClient.query(
        'INSERT INTO users(id, server_id) values($1, $2)',
        [userId, serverId],
        (err, res) => {
            if (err) {
                console.log(err)
            }
        }
    )
}

function checkParameters(amount, currency) {
    checkAmount(amount)
    checkCurrency(currency)
}

function checkAmount(amount) {
    // Check if the specified amount is numeric
    if (!isInt(amount)) {
        // receivedMessage.channel.send(`\`${amount}\` isn't a numeric amount.`)
        return
    }
}

function checkCurrency(currency, channel) {
    // Set the currencies for sparking
    let currencies = ["crystals", "tickets", "10tickets"]

    // Check if the specified currency is accepted
    if (!currencies.includes(currency) && !currencies.includes(currency + "s")) {
        // receivedMessage.channel.send(`\`${currency}\` isn't a valid currency. The valid currencies are \`crystal ticket 10ticket\` as well as their pluralized forms.`)
        return
    }
}

function setSpark(id, server_id, amount, currency) {
    postgresClient.query(
        'UPDATE users SET ' + currency + '=($1) WHERE id = ($2) AND server_id = ($3)',
        [amount, id, server_id],
        (err, res) => {
            if (err) {
                console.log(err)
            }
        }
    )
}

function sparkCommand(arguments, receivedMessage) {
    // Save convenience variables for the amount and currency
    let userId = receivedMessage.author.id
    let serverId = receivedMessage.guild.id

    // Save convenience variables for the amount and currency
    let amount = arguments[1]
    let currency = arguments[2]

    // Save convenience variable for the current channel
    let channel = receivedMessage.channel

    if (arguments[0] == "set") {
        checkParameters(amount, currency)
        setSpark(userId, serverId, amount, currency)
        channel.send(`Setting ${amount} ${currency}`)
    }

    else if (arguments[0] == "save") {
        checkParameters(amount, currency)
        channel.send(`Saving ${amount} ${currency}`)
    }

    else if (arguments[0] == "spend") {
        checkParameters(amount, currency)
        channel.send(`Spending ${amount} ${currency}`)
    }

    else if (arguments[0] == null) {
        channel.send("Fetch")
    }

    else {
        receivedMessage.channel.send("That isn't a valid operation for `spark`")
    }
}


// Syntax
// !spark save 100 crystals
// !spark spend 100 crystals

// Log in to Discord with the secret token
discordClient.login(process.env.DISCORD_SECRET)
