const { Cache } = require('../services/cache.js')
const { ItemType, Festival, Rarity, Season, SSRRate } = require('../services/constants.js')

const cache = new Cache()

class Gacha {
    gala
    season
    rateups

    constructor(gala, season) {
        if (["flash", "ff"].includes(gala)) {
            this.gala = Festival.FLASH
        } else if (["legend", "lf"].includes(gala)) {
            this.gala = Festival.LEGEND
        }

        switch(season) {
            case "summer":
                this.season = Season.SUMMER
                break
            case "halloween":
                this.season = Season.HALLOWEEN
                break
            case "holiday":
                this.season = Season.HOLIDAY
                break
            case "valentine":
                this.season = Season.VALENTINE
                break
        }

        console.log(`in constructor ${this.gala}, ${this.season}`)

        this.rateups = []
    }

    singleRoll() {
        let rarity = this.determineRarity(false)
        let item = this.determineItem(rarity)

        return item
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
        var rateUp = this.gala != null

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
        var rate = (this.gala != null) ? SSRRate * 2 : SSRRate

        this.rateups = [
            {
                item: "Ichigo Hitofuri",
                itemType: ItemType.WEAPON,
                legend: 1,
                rate: 0.300
            }, {
                item: "Taisai Spirit Bow",
                itemType: ItemType.WEAPON,
                legend: 1,
                rate: 0.300
            }, {
                item: "Murgleis",
                itemType: ItemType.WEAPON,
                legend: 1,
                rate: 0.300
            }
        ]

        var remainingWeapons = cache.characterWeapons(Rarity.SSR, this.gala, this.season).length
        var remainingSummons = cache.summons(Rarity.SSR, this.gala, this.season).length 

        // First, subtract the sum of the rates of any rate-up characters from the total rate.
        for (var r in this.rateups) {
            var rateup = this.rateups[r]
            rate = rate - rateup.rate
        }

        // Remove rateups from the total count of character weapons and summons
        remainingWeapons = remainingWeapons - this.rateups.filter(rateup => rateup.itemType == ItemType.WEAPON).length
        remainingSummons = remainingSummons - this.rateups.filter(rateup => rateup.itemType == ItemType.SUMMON).length

        // Divide the difference evenly among all other items in the pool. 
        // The quotient is the summon rate.
        let summonRate = rate / (remainingWeapons + remainingSummons)

        // Remove the combined rate of all summons in the pool from the total rate. 
        rate = rate - (remainingSummons * summonRate)

        // Divide the difference by a+2b, 
        // where a is the number of regular characters in the pool, 
        // and b is the number of limited, non-rate-up characters in the pool.
        if (this.gala != null) {
            let remainingLimiteds = cache.limitedWeapons(this.gala).length - this.rateups.filter(rateup => {
                var isLimited = false

                if (this.gala == Festival.FLASH) {
                    isLimited = rateup.flash === 1
                } else if (this.gala == Festival.LEGEND) {
                    isLimited = rateup.legend === 1
                }

                return isLimited
            }).length

            rate = rate / ((remainingWeapons - remainingLimiteds) + (remainingLimiteds * 2))
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

    determineItem(rarity) {
        let rates = this.ssrRates()
        let rand = Math.random()

        console.log(rates)
        console.log(rand)

        if (rarity.int == Rarity.SSR) {

        } else if (rarity.int == Rarity.SR) {
            console.log(cache.fetchItem(rarity))
        } else {
            console.log("Finding an R")
            console.log(cache.fetchItem(rarity))
        }
    }
}

exports.Gacha = Gacha