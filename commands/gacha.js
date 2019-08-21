// NOTES: Individual item percentages add up to their rarity's total
// So then if you have 221 items at 3%, 16 with 0.018% rate and 24 with 0.050% rate,
// the rest of the pool has 0.008% rate. 
//
// This all adds up to 3%.
//
// If you normalize the rate to be out of 100% (which is what we would need since we 
// calculate rarity then rate up), then the rate is 1.66% (repeating)

const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

const pgPromise = require('pg-promise')
const initOptions = {
  promiseLib: Promise
}

const pgp = pgPromise(initOptions)
const client = pgp(getConnection())

class GachaCommand extends Command {
  constructor(gala, season, message, userId) {
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
    this.storeMessage(message)
    this.storeUser(message.author.id)

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
    var rarity = this.determineRarity(false)

    let sql = this.sqlString(1)
    client.one(sql, [rarity.int])
      .then(data => {
        let response = this.responseString(data)
        message.reply(response)
      })
      .catch(error => {
        console.log(error)
      })
  }

  ten_pull(message) {
    // Determine which pull will guarantee an SR or above
    let guaranteedRateUpPull = this.randomIntFromInterval(1, 10)

    // Roll the gacha to determine rarity
    var roll = this.tenPartRoll()

    let sql = this.multiSqlString(roll)
    client.any(sql)
      .then(data => {
        var string = `You got these 10 things! \`\`\`html\n${this.multilineResponseString(data)}\n\`\`\``
        message.reply(string)
      })
      .catch(error => {
        console.log(error)
      })
  }

  spark(message) {
    // Roll the gacha to determine rarity
    let rollsInSpark = 30
    var rolls = this.tenPartRoll(rollsInSpark)

    var sql = this.multiSqlString(rolls, true)
    client.any(sql)
      .then(data => {
        let response = this.buildSparkResponse(rolls, data)
        message.channel.send(response)
      })
      .catch(error => {
        console.log(error)
      })
  }

  buildSparkResponse(rolls, data) {
    var embed = new RichEmbed()
    embed.setColor(0xb58900)

    var result = ""
    for (var i in data) {
      result += this.responseString(data[i], true)
    }

    embed.setDescription("```html\n" + result + "\n```")
    embed.addField("Summary", `\`\`\`${this.summaryString(data, rolls)}\`\`\``)

    let rate = Math.floor((rolls.SSR / 300) * 100)
    embed.setFooter(`Your SSR rate is ${rate}%`)

    return embed
  }

  tenPartRoll(times = 1) {
    // Create an object to store counts
    var count = { 
      R: 0, 
      SR: 0, 
      SSR: 0 
    }

    for (var roll = 0; roll < times; roll++) {
      // Determine which pull will guarantee an SR or above
      let guaranteedRateUpPull = this.randomIntFromInterval(1, 10)

      // Determine how many items of each rarity to retrieve
      for (var position = 0; position < 10; position++) {
        var rarity

        if (position == guaranteedRateUpPull) {
            rarity = this.determineRarity(true)
        } else {
            rarity = this.determineRarity(false)
        }

        if (rarity.int == 3) {
          var rateup = this.determineRateUp(rarity.int)
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
    embed.addField("Gacha options", `\`\`\`yolo: A single Premium Draw pull
    ten: A 10-part Premium Draw pull
    spark: A whole spark\`\`\``)
    embed.addField("Galas and Seasons", `\`\`\`premium/flash/legend/ff/lf: The <gala> you choose will determine the SSR rate

    valentine/summer/halloween/holiday: The <season> you choose adds seasonal SSRs to the pool\`\`\``)

    message.channel.send(embed)
  }

  // Rate-up methods
  rateup(message, args) {
    let command = message.content.substring("$g rateup ".length)

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
  }

  checkRateUp(message) {
    let sql = 'SELECT rateup.gacha_id, rateup.rate, gacha.name, gacha.recruits FROM rateup LEFT JOIN gacha ON rateup.gacha_id = gacha.id WHERE rateup.user_id = $1 ORDER BY rateup.rate DESC'
    client.any(sql, [message.author.id])
      .then(data => {
        if (data.length > 0) {
          var rateUpDict = []
          for (var i = 0; i < data.count; i++) {
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
    var embed = new RichEmbed()
    embed.setColor(0xb58900)

    var string = ""

    for (var i in rateups) {
      let rateup = rateups[i]
      string += `${rateup.name} - ${rateup.recruits}: ${rateup.rate}%\n`
    }

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
    client.any(sql, [list])
      .then(data => {
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
        embed.addField('The following items could not be found and were not added to your rateup',  `\`\`\`${missing.join("\n")}\`\`\``)
        this.message.channel.send(embed)
      })
      .catch(error => {
        console.log(error)
      })
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
    client.query(sql, [id, this.userId, rate])
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
    client.any(sql, [this.userId])
      .catch(error => {
        console.log(error)
      })
  }

  // Gacha methods
  currentRates() {
    var rates = {}
    if (["flash", "ff", "legend", "lf"].includes(this.gala)) {
      rates = {
        "R": 0.76,
        "SR":	0.15,
        "SSR": 0.06
      }
    } else {
      rates = {
        "R": 0.82,
        "SR":	0.15,
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

  determineRateUp(rarity) {
    let sql = 'SELECT rateup.gacha_id, rateup.rate, gacha.name, gacha.recruits FROM rateup LEFT JOIN gacha ON rateup.gacha_id = gacha.id WHERE rateup.user_id = $1 AND gacha.rarity = $2 ORDER BY rateup.rate ASC'
    client.any(sql, [this.userId, rarity])
      .then(data => {
        console.log("Determining rate up...")
        if (data.length > 0) {
          let currentRates = this.currentRates()
          let rateForRarity = currentRates[Object.keys(currentRates)[rarity - 1]]
          let rNum = Math.random() * 100

          for (var i in data) {
            let rateup = data[i]
            let rate = (rateup.rate * (100 / rateForRarity)) / 100

            console.log(`Rate: ${rate}%, Random: ${rNum}`)
            if (rNum < rate) {
              console.log("Rate up hit!!!")
              break
            }
          }
          console.log("\n")
        }
      })
      .catch(error => {
        console.log(error)
      })
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

  storeUser(id) {
    this.userId = id
  }

  storeMessage(message) {
    this.message = message
  }
}

function getConnection() {
  var connection

  if (process.env.NODE_ENV == "development") {
    connection = {
      host: process.env.PG_HOST,
      port: 5432,
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD
    }
  } else {
    connection = process.env.DATABASE_URL
  }

  return connection
}

module.exports = GachaCommand