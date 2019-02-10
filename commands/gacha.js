const { Client } = require('pg')
const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
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

        var string = `You got these 10 things! \`\`\`html\n${multilineResponseString(res.rows)}\n\`\`\``

        message.reply(string)
    })
}

function spark(message, args) {
    // Create an object to store counts
    var count = { 
        R: 0, 
        SR: 0, 
        SSR: 0 
    }

    for (var i = 0; i < 30; i++) {
        // Determine which pull will guarantee an SR or above
        let guaranteedRateUpPull = randomIntFromInterval(1, 10)

        // Determine how many items of each rarity to retrieve
        for (var j = 0; j < 10; j++) {
            if (i == guaranteedRateUpPull) {
                var rarity = determineRarity(args.gala, true)
            } else {
                var rarity = determineRarity(args.gala, false)
            }

            count[rarity.string] += 1
        }
    }
    
    var sql = multiSqlString(count, args.gala, args.season, true)
    client.query(sql, (err, res) => {
        if (err) {
            console.log(err.message)
        }

        var embed = new RichEmbed()
        embed.setColor(0xb58900)
        
        var result = ""
        for (i in res.rows) {
            result += responseString(res.rows[i], true)
        }
        
        let rate = Math.floor((count.SSR / 300) * 100)

        
        embed.setDescription("```html\n" + result + "\n```")
        embed.addField("Summary", `\`\`\`${summaryString(res.rows, count)}\`\`\``)
        embed.setFooter(`Your SSR rate is ${rate}%`)
        
        result += `\nYour SSR rate is ${rate}%!`

        message.channel.send(embed)
    })
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

function multiSqlString(counts, gala, season, isSpark = false) {
    var sql = ""
    let ssrSql = `(SELECT * FROM gacha WHERE rarity = 3 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.SSR})`

    if (!isSpark) {
        let rSql = `(SELECT * FROM gacha WHERE rarity = 1 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.R})`
        let srSql = `(SELECT * FROM gacha WHERE rarity = 2 ${limitBanner(gala, season)} ORDER BY RANDOM() LIMIT ${counts.SR})`
        sql = [rSql, srSql, ssrSql].join(" UNION ALL ")
    } else {
        sql = ssrSql
    }

    return sql
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
        var response = response + `<${rarityString}> ${result.name} – You recruited ${result.recruits.trim()}!`
    } else {
        if (result.item_type == 0) {
            var response = response + `<${rarityString}> ${result.name}`
        } else {
            var response = response + `<${rarityString} Summon> ${result.name}`
        }
    }

    if (!combined) {
        response = `\`\`\`html\n${response}\n\`\`\``
    } else {
        response = `${response}\n`
    }

    return response
}

function multilineResponseString(results) {
    let characterWeapons = sortCharacterWeapons(results)
    var gachaItems = results.filter(x => !characterWeapons.includes(x)).concat(characterWeapons.filter(x => !results.includes(x)))

    let items = shuffle(gachaItems).concat(characterWeapons)

    var string = ""
    for (item in items) {
        string += responseString(items[item], true)
    }

    return string
}

function summaryString(results, count) {
    let ssrWeapons = results.filter(filterSSRWeapons)
    let ssrSummons = results.filter(filterSSRSummons)

    var ssrWeaponString = `SSR Weapons: ${ssrWeapons.length}`
    var ssrSummonString = `SSR Summons: ${ssrSummons.length}`
    var srString = `SR: ${count.SR}`
    var rString = `R: ${count.R}`

    return [ssrWeaponString, ssrSummonString, srString, rString].join("\n")
}

function filterSSRWeapons(el) {
    return el.rarity == 3 && el.item_type == 0
}

function filterSSRSummons(el) {
    return el.rarity == 3 && el.item_type == 1
}

function sortCharacterWeapons(results) {
    var characterWeapons = []

    for (item in results) {
        var hasPlacedSR = false
        var lastSRPos = 0
        var placedSSRCount = 0

        if (results[item].recruits != null) {
            // If you get an R, put it at the front of the list
            if (results[item].rarity == 1) {
                characterWeapons.unshift(results[item])

                if (!hasPlacedSR) {
                    lastSRPos = characterWeapons.length
                }
            }

            // If you get an SR, put it at the last SR position and record a new position
            if (results[item].rarity == 2) {
                characterWeapons.splice(lastSRPos, 0, results[item])

                if (!hasPlacedSR) {
                    hasPlacedSR = true
                }
            }

            // If you get an SSR, put it at the end of the list
            if (results[item].rarity == 3) {
                characterWeapons.push(results[item])

                if (!hasPlacedSR) {
                    placedSSRCount += 1
                    lastSRPos = characterWeapons.length - placedSSRCount
                }
            }
        }
    }

    return characterWeapons
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex -= 1
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex]
      array[currentIndex] = array[randomIndex]
      array[randomIndex] = temporaryValue
    }
  
    return array
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
        additionalSql += " OR halloween = 1"
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