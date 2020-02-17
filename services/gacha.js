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

const ItemType = {
	WEAPON : 0,
	SUMMON : 1
}

const SSRRate = 3.0

class Gacha {
    festival
    season
    rateups

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

    ssrRates() {
        var rate = (festival != null) ? SSRRate * 2 : SSRRate
        
        // First, subtract the sum of the rates of any rate-up characters from the total rate.
        for (var r in this.rateups) {
            var rateup = this.rateups[r]
            rate - rateup.rate
        }

        // Remove rateups from the total count of character weapons and summons
        let remainingWeapons = cache.characterWeapons[Rarity.SSR] - this.rateups.filter(rateup => rateup.itemType == ItemType.WEAPON)
        let remainingSummons = cache.summons[Rarity.SSR] - this.rateups.filter(rateup => rateup.itemType == ItemType.SUMMON)

        // Divide the difference evenly among all other items in the pool. 
        // The quotient is the summon rate.
        let summonRate = rate / (remainingWeapons + remainingSummons)

        // Remove the combined rate of all summons in the pool from the total rate. 
        rate = rate - (remainingSummons * summonRate)

        // Divide the difference by a+2b, 
        // where a is the number of regular characters in the pool, 
        // and b is the number of limited, non-rate-up characters in the pool.
        if (festival != null) {
            let remainingLimiteds = cache.limitedWeapons(festival) - this.rateups.filter(rateup => {
                var isLimited = false

                if (festival == Festival.FLASH) {
                    isLimited = rateup.flash == true
                } else if (festival == Festival.LEGEND) {
                    isLimited = rateup.legend == true
                }

                return isLimited
            })

            rate = rate / (remainingWeapons - remainingLimiteds) + (remainingLimiteds * 2)
        } else {
            rate = rate / remainingWeapons
        }

        return {
            "weapon"  : rate,
            "limited" : rate * 2,
            "summon"  : summonRate
        }
    }

    determineRarity(final = false) {
        let rates = this.currentRates(final)
        let rand = Math.random()

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

    determineItem() {
        let rates = this.ssrRates()
        let rand = Math.random()
    }
}

exports.Gacha = Gacha