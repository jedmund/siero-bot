const { Client } = require('pg')
const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

const client = getClient()
client.connect()

class GachaCommand extends Command {
    constructor(gala, season) {
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
        this.storeBanner(args)

        switch(args.operation) {
            case "yolo":
                this.yolo(message, args)
                break
            case "ten":
                this.ten_pull(message)
                break
            case "spark":
                this.spark(message)
                break
            case "help":
                this.help(message)
                break
            default:
                break
        }
    }

    // Command methods
    yolo(message, args) {
        var rarity = this.determineRarity(false)

        let sql = this.sqlString(1)
        client.query(sql, [rarity.int], (err, res) => {
            if (err) {
                console.log(err.message)
            }

            let response = this.responseString(res.rows[0])
            message.reply(response)
        })
    }

    ten_pull(message) {
        // Determine which pull will guarantee an SR or above
        let guaranteedRateUpPull = this.randomIntFromInterval(1, 10)

        // Roll the gacha to determine rarity
        var roll = this.tenPartRoll()
        
        var sql = this.multiSqlString(roll)
        client.query(sql, (err, res) => {
            if (err) {
                console.log(err.message)
            }

            var string = `You got these 10 things! \`\`\`html\n${this.multilineResponseString(res.rows)}\n\`\`\``

            message.reply(string)
        })
    }

    spark(message) {
        // Roll the gacha to determine rarity
        let rollsInSpark = 30
        var rolls = this.tenPartRoll(rollsInSpark)
        
        var sql = this.multiSqlString(rolls, true)
        client.query(sql, (err, res) => {
            if (err) {
                console.log(err.message)
           }

            var embed = new RichEmbed()
            embed.setColor(0xb58900)
            
            var result = ""
            for (var i in res.rows) {
                result += this.responseString(res.rows[i], true)
            }
            
            let rate = Math.floor((rolls.SSR / 300) * 100)
            
            embed.setDescription("```html\n" + result + "\n```")
            embed.addField("Summary", `\`\`\`${this.summaryString(res.rows, rolls)}\`\`\``)
            embed.setFooter(`Your SSR rate is ${rate}%`)
            
            result += `\nYour SSR rate is ${rate}%!`

            message.channel.send(embed)
        })
    }

    tenPartRoll(times = 1) {
        // Create an object to store counts
        var count = { 
            R: 0, 
            SR: 0, 
            SSR: 0 
        }

        for (var i = 0; i < times; i++) {
            // Determine which pull will guarantee an SR or above
            let guaranteedRateUpPull = this.randomIntFromInterval(1, 10)

            // Determine how many items of each rarity to retrieve
            for (var j = 0; j < 10; j++) {
                if (i == guaranteedRateUpPull) {
                    var rarity = this.determineRarity(true)
                } else {
                    var rarity = this.determineRarity(false)
                }

                count[rarity.string] += 1
            }
        }

        return count
    }

    help(message) {
        var embed = new RichEmbed()
        embed.setTitle("Gacha")
        embed.setDescription("Welcome! I can help you save your money!")
        embed.setColor(0xdc322f)
        embed.addField("Command syntax", "```gacha spark <gala> <season>```")
        embed.addField("Gacha options", `\`\`\`html\n
<yolo>
A single Premium Draw pull\n
<ten>
A 10-part Premium Draw pull\n
<spark> 
A whole spark\`\`\``)
        embed.addField("Galas and Seasons", `\`\`\`html\n
<gala: premium flash legend ff lf>
The <gala> you choose will determine the SSR rate

<season: valentine summer halloween holiday>
The <season> you choose adds seasonal SSRs to the pool\`\`\``)

        message.channel.send(embed)
    }

    // Gacha methods
    currentRates() {
        var rates = {}
        if (["flash", "ff", "legend", "lf"].includes(this.gala)) {
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

    determineRarity(isRateUp = false) {
        let rates = this.currentRates()
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

    filterSSRWeapons(el) {
        return el.rarity == 3 && el.item_type == 0
    }
    
    filterSSRSummons(el) {
        return el.rarity == 3 && el.item_type == 1
    }

    limitBanner() {
        var additionalSql = "AND (premium = 1"
    
        // Test the gala
        if (["flash", "ff"].includes(this.gala)) {
            additionalSql += " OR flash = 1"
        } 
        
        else if (["legend", "lf"].includes(this.gala)) {
            additionalSql += " OR legend = 1"
        }
    
        // Test the season
        if (this.season == "valentine") {
            additionalSql += " OR valentine = 1"
        }
    
        else if (this.season == "summer") {
            additionalSql += " OR summer = 1"
        }
    
        else if (this.season == "halloween") {
            additionalSql += " OR halloween = 1"
        }
    
        else if (this.season == "holiday") {
            additionalSql += " OR holiday = 1"
        }
    
        return additionalSql + ")"
    }
    
    sortCharacterWeapons(results) {
        var characterWeapons = []
    
        for (var item in results) {
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

    // String methods
    sqlString(times) {
        let constraints = this.limitBanner()
        return `SELECT * FROM gacha WHERE rarity = $1 ${constraints} ORDER BY RANDOM() LIMIT ${times};`
    }
    
    multiSqlString(counts, isSpark = false) {
        var sql = ""
        var constraints = this.limitBanner()

        let ssrSql = `(SELECT * FROM gacha WHERE rarity = 3 ${constraints} ORDER BY RANDOM() LIMIT ${counts.SSR})`
    
        if (!isSpark) {
            let rSql = `(SELECT * FROM gacha WHERE rarity = 1 ${constraints} ORDER BY RANDOM() LIMIT ${counts.R})`
            let srSql = `(SELECT * FROM gacha WHERE rarity = 2 ${constraints} ORDER BY RANDOM() LIMIT ${counts.SR})`
            sql = [rSql, srSql, ssrSql].join(" UNION ALL ")
        } else {
            sql = ssrSql
        }
    
        return sql
    }
    
    responseString(result, combined = false) {
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
    
    multilineResponseString(results) {
        let characterWeapons = this.sortCharacterWeapons(results)
        var gachaItems = results.filter(x => !characterWeapons.includes(x)).concat(characterWeapons.filter(x => !results.includes(x)))
    
        let items = this.shuffle(gachaItems).concat(characterWeapons)
    
        var string = ""
        for (var item in items) {
            string += this.responseString(items[item], true)
        }
    
        return string
    }
    
    summaryString(results, count) {
        let ssrWeapons = results.filter(this.filterSSRWeapons)
        let ssrSummons = results.filter(this.filterSSRSummons)
    
        var ssrWeaponString = `SSR Weapons: ${ssrWeapons.length}`
        var ssrSummonString = `SSR Summons: ${ssrSummons.length}`
        var srString = `SR: ${count.SR}`
        var rString = `R: ${count.R}`
    
        return [ssrWeaponString, ssrSummonString, srString, rString].join("\n")
    }

    // Helper methods
    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    
    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    shuffle(array) {
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

    storeBanner(args) {
        this.gala = args.gala
        this.season = args.season
    }
}

function getClient() {
    var c
    if (process.env.NODE_ENV == "development") {
        c = new Client({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DB,
            password: process.env.PG_PASSWORD,
            port: 5432,
        })
    } else {
        c = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: true
        })
    }

    return c
}

module.exports = GachaCommand