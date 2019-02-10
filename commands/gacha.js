const { Client } = require('pg')
const { Command } = require('discord-akairo')

const client = new Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DB,
    password: process.env.PG_PASSWORD,
    port: 5432,
})
const pluralize = require('pluralize')

client.connect()

class GachaCommand extends Command {
    constructor() {
        super('gacha', {
            aliases: ['gacha', 'g'],
            args: [
                {
                    id: 'operation',
                    type: 'string',
                    default: 'status'
                },
                {
                    id: 'gala',
                    type: 'string',
                    default: 'premium'
                },
                {
                    id: 'season',
                    type: 'string',
                    default: 'none'
                }
            ]
        })
    }

    exec(message, args) {
        switch(args.operation) {
            case "yolo":
                yolo(message, args)
                break
            case "pull":
                ten_pull(message, args)
                break
            case "spark":
                spark(message, args)
                break
            default:
                break
        }
    }
}

// Command methods
function yolo(message, args) {
    var rarity = determineRarity(args.gala, false)

    let sql = sqlString(1, args.gala, args.season)
    client.query(sql, [rarity.int], (err, res) => {
        if (err) {
            console.log(err.message)
        }

        message.reply(responseString(res.rows[0]))
    })
}

function ten_pull(message, args) {
    // Determine which pull will guarantee an SR or above
    let guaranteedRateUpPull = randomIntFromInterval(1, 10)

    // Create an object to store counts
    var count = { 
        R: 0, 
        SR: 0, 
        SSR: 0 
    }

    // Determine how many items of each rarity to retrieve
    for (var i = 0; i < 10; i++) {
        if (i == guaranteedRateUpPull) {
            var rarity = determineRarity(args.gala, true)
        } else {
            var rarity = determineRarity(args.gala, false)
        }

        count[rarity.string] += 1
    }
    
    var sql = multiSqlString(count, args.gala, args.season)
    client.query(sql, (err, res) => {
        if (err) {
            console.log(err.message)
        }

        var string = "You got these 10 things: ```"
        for (row in res.rows) {
            string += responseString(res.rows[row], true) + "\n"
        }
        string += "```"

        message.reply(string)
    })




    // return count
}

function spark(message, args) {
    var count = { 
        'R': 0, 
        'SR': 0, 
        'SSR': 0 
    }

    for (var i = 0; i < 30; i++) {
        var result = pull(message, args)

        count.R = count.R + result.R
        count.SR = count.SR + result.SR
        count.SSR = count.SSR + result.SSR
    }

    message.reply(`You got ${count.SSR} SSRs, ${count.SR} SRs and ${count.R} Rs.`)
}

function help(message) {
    return message.reply(`Welcome! I can help you save your money!

\`status\`: See how much you've saved
\`set\`: Save an absolute value for a currency
\`add\` \`save\`: Add an amount of currency to your total
\`remove\` \`spend\`: Remove an amount of currency from your total
\`reset\`: Reset your spark
\`quicksave\`: Quickly save all currencies in this order: \`crystals\` \`tickets\` \`10 tickets\``)
}

// Helper methods
function determineRarity(gala, isRateUp = false) {
    let rates = currentRates(gala)
    var rNum = Math.random()

    var rarity = {
        integer: 0,
        string: ""
    }

    if (rNum < rates.SSR) {
        rarity.int = 3
        rarity.string = "SSR"
    } else if (rNum < rates.SR) {
        rarity.int = 2
        rarity.string = "SR"
    } else {
        if (isRateUp) {
            rarity.int = 2
            rarity.string = "SR"
        } else {
            rarity.int = 1
            rarity.string = "R"
        }
    }

    return rarity
}

function sqlString(times, gala, season) {
    return `SELECT * FROM gacha WHERE rarity = $1 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${times};`
}

function multiSqlString(counts, gala, season) {
    rSql = `(SELECT * FROM gacha WHERE rarity = 1 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.R})`
    srSql = `(SELECT * FROM gacha WHERE rarity = 2 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.SR})`
    ssrSql = `(SELECT * FROM gacha WHERE rarity = 3 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.SSR})`

    return [rSql, srSql, ssrSql].join(" UNION ALL ")
}

function responseString(result, combined = false) {
    var response = ""

    var rarityString = ""
    if (result.rarity == 1) {
        rarityString = "R"
    } else if (result.rarity == 2) {
        rarityString = "SR"
    } else if (result.rarity == 3) {
        rarityString = "SSR"
    }

    if (result.recruits != null) {
        var response = response + `[${rarityString}] ${result.name} – You recruited ${result.recruits.trim()}!`
    } else {
        if (result.item_type == 0) {
            var response = response + `[${rarityString}] ${result.name}`
        } else {
            var response = response + `[${rarityString} Summon] ${result.name}`
        }
    }

    if (!combined) {
        response = `\`\`\`${response}\`\`\``
    }

    return response
}

function currentRates(gala) {
    var rates = {}
    if (["flash", "ff", "legend", "lf"].includes(gala)) {
        rates = {
            "R":   0.76,
            "SR":  0.15,
            "SSR": 0.06
        }
    } else {
        rates = {
            "R":   0.82,
            "SR":  0.15,
            "SSR": 0.03
        }
    }

    return rates
}

function limitBanner(gala, season) {
    var additionalSql = "AND (premium = 1"

    // Test the gala
    if (["flash", "ff"].includes(gala)) {
        additionalSql += " OR flash = 1"
    } 
    
    else if (["legend", "lf"].includes(gala)) {
        additionalSql += " OR legend = 1"
    }

    // Test the season
    if (season == "valentine") {
        additionalSql += " OR valentine = 1"
    }

    else if (season == "summer") {
        additionalSql += " OR summer = 1"
    }

    else if (season == "halloween") {
        additionalSQL += " OR halloween = 1"
    }

    else if (season == "holiday") {
        additionalSql += " OR holiday = 1"
    }

    return additionalSql + ")"
}

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = GachaCommand