const { Client } = require('pg')
const { Command } = require('discord-akairo')
const { Gacha } = require('../services/gacha.js')
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
        switch(args.operation) {
            case "yolo":
                this.yolo(message, args)
                break
            case "ten":
                this.ten_pull(message, args)
                break
            case "spark":
                this.spark(message, args)
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
        let gacha = new Gacha(args.gala, args.season)
        let item = gacha.singleRoll()
        let response = this.responseString(item)

        message.reply(response)
    }

    ten_pull(message, args) {
        let gacha = new Gacha(args.gala, args.season)
        let items = gacha.tenPartRoll()
        var response = `You got these 10 things!\`\`\`html\n${this.multilineResponseString(items.items)}\n\`\`\``
        
        message.reply(response)
    }

    spark(message, args) {
        let gacha = new Gacha(args.gala, args.season)
        let items = gacha.spark()

        let embed = this.buildEmbed(items)
        message.channel.send(embed)
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

    // Filter methods
    filterSSRWeapons(el) {
        return el.rarity == 3 && el.item_type == 0
    }
    
    filterSSRSummons(el) {
        return el.rarity == 3 && el.item_type == 1
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

    buildEmbed(results) {
        console.log(results)
        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        var response = ""
        for (var i in results.items) {
            response += this.responseString(results.items[i], true)
        }
            
        let rate = Math.floor((results.count.SSR / 300) * 100)
            
        embed.setDescription("```html\n" + response + "\n```")
        embed.addField("Summary", `\`\`\`${this.summaryString(results.items, results.count)}\`\`\``)
        embed.setFooter(`Your SSR rate is ${rate}%`)

        return embed
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