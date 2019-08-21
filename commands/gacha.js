const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

const pgPromise = require('pg-promise')
const initOptions = {
  promiseLib: Promise
}

const pgp = pgPromise(initOptions)
const client = pgp(getConnection())

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

  rateup(message, args) {
    let command = message.content.substring("$g rateup ".length)

    if (command == "check") {
      this.checkRateUp(message, args)
    }

    if (command == "clear") {
      this.clearRateUp(message)
    }

    if (command.includes("set")) {
      this.setRateUp(command, message)
    }
  }

  checkRateUp(message) {
    let sql = 'SELECT rateup.gacha_id, rateup.rate, gacha.name, gacha.recruits FROM rateup LEFT JOIN gacha ON rateup.gacha_id = gacha.id WHERE rateup.user_id = $1'

    client.query(sql, [message.author.id], (err, res) => {
      if (err) {
        console.log(err.message)
      }

      if (res.rowCount > 0) {
        var rateUpDict = []
        for (var i = 0; i < res.rowCount; i++) {
          var dict = {}
          dict.gacha_id = res.rows[i].gacha_id
          dict.name = res.rows[i].name
          dict.recruits = res.rows[i].recruits
          dict.rate = res.rows[i].rate

          rateUpDict.push(dict)
        }

        this.generateRateUpString(rateUpDict, message)
      } else {
        message.reply(`It looks like ${message.author} hasn't saved a rate up yet.`)
      }
    })
  }

  generateRateUpString(rateups, message) {
    var embed = new RichEmbed()
    embed.setColor(0xb58900)

    var string = ""

    for (var i in rateups) {
      let rateup = rateups[i]
      string += `${rateup.name} (${rateup.recruits}): ${rateup.rate}\n`
    }

    embed.setTitle("Your current rate-up")
    embed.setDescription("```html\n" + string + "\n```")
    embed.setFooter(`These rate ups will only take effect on your gacha simulations.`)
    message.channel.send(embed)
  }

  setRateUp(command, message) {
    var rateups = this.extractRateUp(command)
    this.saveRateUps(rateups, message)
    message.channel.send("Your rate-up has been updated")
  }

  saveRateUps(dictionary, message) {
    for (var i in dictionary) {
      let rateup = dictionary[i]

      let sql = 'SELECT id FROM gacha WHERE name = $1 OR recruits = $1'
      client.query(sql, [rateup.item], (err, res) => {
        if (err) {
          console.log(err.message)
        }

        if (res.rowCount > 0) {
          this.saveRateUp(res.rows[0].id, message.author.id, rateup.rate)
        } else {
          message.reply(`The desired item couldn't be found: ${rateup.item}`)
        }
      })
    }
  }

  saveRateUp(id, user_id, rate) {
    let sql = 'INSERT INTO rateup (gacha_id, user_id, rate) VALUES ($1, $2, $3)'
    client.query(sql, [id, user_id, rate], (err, res) => {
      if (err) {
        console.log(err.message)
      }
    })
  }

  extractRateUp(message) {
    let rateupString = message.substring("set ".length)
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

  clearRateUp(message) {
    let sql = 'DELETE FROM rateup WHERE user_id = $1'
    client.query(sql, [message.author.id], (err, res) => {
      if (err) {
        console.log(err.message)
      }

      if (res.rowCount > 0) {
        message.reply("Your rate-up has been cleared.")
      }
    })
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
        if (position == guaranteedRateUpPull) {
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
    embed.addField("Gacha options", `\`\`\`yolo: A single Premium Draw pull
    ten: A 10-part Premium Draw pull
    spark: A whole spark\`\`\``)
    embed.addField("Galas and Seasons", `\`\`\`premium/flash/legend/ff/lf: The <gala> you choose will determine the SSR rate

    valentine/summer/halloween/holiday: The <season> you choose adds seasonal SSRs to the pool\`\`\``)

    message.channel.send(embed)
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