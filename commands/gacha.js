const { Client } = require('../services/connection.js')
const { Command } = require('discord-akairo')
const { Gacha } = require('../services/gacha.js')
const { RichEmbed } = require('discord.js')

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

    async exec(message, args) {
        this.storeMessage(message)
        this.storeUser(message.author.id)
        await this.storeRateups()

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
            case "rateup":
                this.rateup(message)
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
        let gacha = new Gacha(args.gala, args.season, this.rateups)
        let item = gacha.singleRoll()
        let response = this.responseString(item)

        message.reply(response)
    }

    ten_pull(message, args) {
        let gacha = new Gacha(args.gala, args.season, this.rateups)
        let items = gacha.tenPartRoll()
        var response = `You got these 10 things!\`\`\`html\n${this.multilineResponseString(items.items)}\n\`\`\``
        
        message.reply(response)
    }

    spark(message, args) {
        let gacha = new Gacha(args.gala, args.season, this.rateups)
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
        embed.addField("Using Rateups", `\`\`\`html\n
<rateup set>
Set a new rateup\n
<rateup copy @user>
Copy another user's current rateup\n
<rateup check>
Check your current rateup\n
<rateup clear>
Clear your current rateup\`\`\``)
        embed.addField("Setting Rateups", `\`\`\`html\n
<rateup set Sky Ace 0.300, Elil 0.500>
You can set rateups with the weapon or summon name, followed by the desired rate separated by a space. You can add multiple rateups by separating them with a comma, as seen above.\`\`\``)
        message.channel.send(embed)
    }

    // Rate-up methods
    rateup(message, args) {
        let command = message.content.substring("$g rateup ".length).split(" ")[0]
        
        if (command == "check") {
            this.checkRateUp(message, args)
        }

        if (command == "clear") {
            this.clearRateUp()
            message.reply("Your rate-up has been cleared.")
        }

        if (command.includes("set")) {
            this.setRateUp(command)
        }

        if (command == "copy") {
            this.copyRateUp(message)
        }
    }

    copyRateUp(message) {
        let sourceUser = message.mentions.users.array()[0]
        let destinationUser = message.author
        let sql = 'INSERT INTO rateup (gacha_id, rate, user_id) SELECT gacha_id, rate, $1 FROM rateup WHERE user_id = $2'

        Client.any(sql, [destinationUser.id, sourceUser.id])
            .then(data => {
                message.channel.send(`You successfully copied ${sourceUser}'s rate up!`)
            })
            .catch(error => {
                console.log(error)
            })

    }

    checkRateUp(message) {
        let sql = 'SELECT rateup.gacha_id, rateup.rate, gacha.name, gacha.recruits FROM rateup LEFT JOIN gacha ON rateup.gacha_id = gacha.id WHERE rateup.user_id = $1 ORDER BY rateup.rate DESC'
        Client.any(sql, [message.author.id])
            .then(data => {
                if (data.length > 0) {
                    var rateUpDict = []
                    
                    for (var i = 0; i < data.length; i++) {
                        var dict = {}
                        var result = data[i]

                        dict.gacha_id = result.gacha_id
                        dict.name = result.name
                        dict.recruits = result.recruits
                        dict.rate = result.rate

                        rateUpDict.push(dict)
                    }

                    let embed = this.generateRateUpString(rateUpDict)
                    message.channel.send(embed)
                } else {
                    message.reply("It looks like you don't have any rate-ups set right now!")
                }
            })
            .catch(error => {
                console.log(error)
            })
    }

    generateRateUpString(rateups) {
        var string = ""
        for (var i in rateups) {
            let rateup = rateups[i]
            if (rateup.recruits != null) {
                string += `${rateup.name} - ${rateup.recruits}: ${rateup.rate}%\n`
            } else {
                string += `${rateup.name}: ${rateup.rate}%\n`
            }
        }

        var embed = new RichEmbed()
        embed.setColor(0xb58900)
        embed.setTitle("Your current rate-up")
        embed.setDescription("```html\n" + string + "\n```")
        embed.setFooter(`These rate ups will only take effect on your gacha simulations.`)

        return embed
    }

    setRateUp(command, message) {
        // First, clear the existing rate up
        this.clearRateUp(message)

        // Then, save the new rate up
        var rateups = this.extractRateUp(command)
        this.saveRateUps(rateups)
    }

    saveRateUps(dictionary) {
        let list = dictionary.map(rateup => rateup.item)

        let sql = 'SELECT id, name, recruits FROM gacha WHERE name IN ($1:csv) OR recruits IN ($1:csv)'
        Client.any(sql, [list])
            .then(data => {
                let embed = this.createRateUpEmbed(data)
                this.message.channel.send(embed)
            })
            .catch(error => {
                console.log(error)
            })
    }

    createRateUpEmbed(data) {
        var rateups = []
        for (var i in data) {
            // Fetch the rateup from the passed-in dictionary
            let rateup = this.joinRateUpData(data[i], dictionary)

            // Save the rate up data
            this.saveRateUp(rateup.id, rateup.rate)

            // Push to array
            rateups.push(rateup)
        }

        // Fetch the data for missing rate-ups
        // These will be items that don't exist in the game or typos
        let missing = this.findMissingRateUpData(list, data)

        // Create the embed displaying rate-up data
        let embed = this.generateRateUpString(rateups)

        if (missing.length > 0) {
            embed.addField('The following items could not be found and were not added to your rateup',  `\`\`\`${missing.join("\n")}\`\`\``)
        }

        return embed
    }

    joinRateUpData(dict1, dict2) {
        var rateup = {}

        rateup.id = dict1.id
        rateup.name = dict1.name
        rateup.recruits = dict1.recruits

        for (var i in dict2) {
            let entry = dict2[i]

            if (entry.item == rateup.name || entry.item == rateup.recruits) {
            rateup.rate = entry.rate
            }
        }

        return rateup
    }

        findMissingRateUpData(original, result) {
        let resultNames = result.map(result => result.name)
        let resultRecruits = result.map(result => result.recruits)
            
        return original.filter(e => !resultNames.includes(e) && !resultRecruits.includes(e))
    }

    saveRateUp(id, rate) {
        let sql = 'INSERT INTO rateup (gacha_id, user_id, rate) VALUES ($1, $2, $3)'
        Client.query(sql, [id, this.userId, rate])
            .catch(error => {
                console.log(error)
            })
    }

    extractRateUp() {
        let rateupString = this.message.content.substring("$g rateup set ".length)
        let rawRateUps = rateupString.split(",").map(item => item.trim())

        var rateups = []
        for (var i in rawRateUps) {
            let splitRateup = rawRateUps[i].split(" ")

            var rateup = {}
            rateup.rate = splitRateup.pop()
            rateup.item = splitRateup.join(" ")

            rateups.push(rateup)
        }

        return rateups
    }

    clearRateUp() {
        let sql = 'DELETE FROM rateup WHERE user_id = $1'
        Client.any(sql, [this.userId])
            .catch(error => {
                console.log(error)
            })
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

    storeMessage(message) {
        this.message = message
    }

    storeUser(id) {
        this.userId = id
    }

    async storeRateups() {
        let sql = 'SELECT rateup.gacha_id, rateup.rate, gacha.name, gacha.recruits, gacha.rarity, gacha.item_type, gacha.premium, gacha.legend, gacha.flash, gacha.halloween, gacha.holiday, gacha.summer, gacha.valentine FROM rateup LEFT JOIN gacha ON rateup.gacha_id = gacha.id WHERE rateup.user_id = $1 ORDER BY rateup.rate DESC'

        try {
            this.rateups = await Client.any(sql, [this.userId])
        } catch {
            console.log("Error")
        }
    }
}

module.exports = GachaCommand