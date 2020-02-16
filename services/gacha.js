const { Cache } = require('../services/cache.js')

const Festival = {
    LEGEND : 0,
    FLASH  : 1
}

const Season = {
    VALENTINE : 0,
    SUMMER    : 1,
    HALLOWEEN : 2,
    HOLIDAY   : 3
}

class Gacha {
    festival
    season

    singleRoll() {
        return this.determineRarity(false)
    }

    tenPartRoll(times = 1) {
        let maxPulls = 10
        var count = { 
            R: 0, 
            SR: 0, 
            SSR: 0 
        }

        for (var i = 0; i < times; i++) {
            for (var j = 0; j < maxPulls; j++) {
                var rarity

                if (j != maxPulls - 1) {
                    rarity = this.determineRarity(false)
                } else {
                    rarity = this.determineRarity(true)
                }

                count[rarity.string] += 1
            }
        }

        return count
    }

    spark() {
        let maxRolls = 30
        return this.tenPartRoll(maxRolls)
    }

    currentRates(final = false) {
        var rates = {}
        var rateUp = this.festival != null

        if (rateUp && !final) {
            rates = {
                "R":   0.76,
                "SR":  0.15,
                "SSR": 0.06
            }
        }

        if (rateUp && final) {
            rates = {
                "SR":  0.94,
                "SSR": 0.06
            }
        }

        if (!rateUp && !final) {
            rates = {
                "R":   0.82,
                "SR":  0.15,
                "SSR": 0.03
            }
        }

        if (!rateUp && final) {
            rates = {
                "SR":  0.97,
                "SSR": 0.03
            }
        }
    
        return rates
    }

    determineRarity(final = false) {
        let rates = this.currentRates(final)
        var rand = Math.random()

        var rarity = {
            integer: 0,
            string: ""
        }

        if (rand < rates.SSR) {
            rarity.int = 3
            rarity.string = "SSR"
        } else {
            if (final) {
                rarity.int = 2
                rarity.string = "SR"
            } else {
                if (rand < rates.SR) {
                    rarity.int = 2
                    rarity.string = "SR"
                } else {
                    rarity.int = 1
                    rarity.string = "R"
                }
            }
        }

        return rarity
    }
}

exports.Gacha = Gacha