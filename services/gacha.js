const { Cache } = require('../services/cache.js')
const { Chance } = require('chance')
const { GachaBucket, ItemType, Festival, Rarity, RollsInSpark, Season, SSRRate } = require('../services/constants.js')

const cache = new Cache()
const chance = new Chance()

class Gacha {
    gala
    season
    rateups
    rates

    constructor(gala, season, rateups) {
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

        this.rateups = rateups.filter(item => this.filterItems(item, this.gala, this.season))
        this.rates = this.ssrRates()
    }

    singleRoll() {
        let rarity = this.determineRarity(false)
        return this.determineItem(rarity)
    }

    tenPartRoll(times = 1, fetchAllItems = true) {
        // Create an object to store counts
        var count = { 
            R: 0, 
            SR: 0, 
            SSR: 0 
        }

        let maxPulls = 10
        var items = []

        for (var i = 0; i < times; i++) {
            for (var j = 0; j < maxPulls; j++) {
                var rarity

                if (j != maxPulls - 1) {
                    rarity = this.determineRarity(false)
                } else {
                    rarity = this.determineRarity(true)
                }

                count[rarity.string] += 1

                if (rarity.int == Rarity.SSR || (rarity != Rarity.SSR && fetchAllItems)) {
                    items.push(this.determineItem(rarity))
                }
            }
        }

        return {
            count: count,
            items: items
        }
    }

    spark() {
        let maxRolls = RollsInSpark / 10
        var items = this.tenPartRoll(maxRolls, false)

        return items
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

        var remainingWeapons = cache.characterWeapons(Rarity.SSR, this.gala, this.season).length
        var remainingSummons = cache.summons(Rarity.SSR, this.gala, this.season).length 

        // First, subtract the sum of the rates of any rate-up characters from the total rate.
        for (var r in this.rateups) {
            rate = rate - this.rateups[r].rate
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
        var remainingLimiteds = 0
        if (this.gala != null) {
            remainingLimiteds = cache.limitedWeapons(this.gala).length - this.rateups.filter(rateup => {
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
            "weapon"  : {
                "rate"  : rate,
                "count" : remainingWeapons - remainingLimiteds
            },
            "limited" : {
                "rate"  : rate * 2,
                "count" : remainingLimiteds
            },
            "summon"  : {
                "rate"  : summonRate,
                "count" : remainingSummons
            }
        }
    }

    determineRarity(final = false) {
        let rates = this.currentRates(final)

        var r
        if (final) {
            r = chance.weighted(["SR", "SSR"], [rates.SR, rates.SSR])
        } else {
            r = chance.weighted(["R", "SR", "SSR"], [rates.R, rates.SR, rates.SSR])
        }

        return {
            int    : Rarity[r],
            string : r
        }
    }

    determineItem(rarity) {
        var item

        if (rarity.int === Rarity.SSR) {
            item = this.determineSSRItem()
        } else {
            item = cache.fetchItem(rarity, this.gala, this.season)
        }

        return item
    }

    determineSSRItem() {
        // Fixed rarity that matches the output of determineRarity
        let rarity = {
            int     : 3,
            string  : "SSR"
        }

        // Fetch the rates and determine a bucket
        let bucket = this.determineSSRBucket(this.rates)

        var item
        if ([GachaBucket.WEAPON, GachaBucket.SUMMON, GachaBucket.LIMITED].includes(bucket)) {
            // pick a random item from that bucket
            switch(bucket) {
                case GachaBucket.WEAPON:
                    item = cache.fetchWeapon(rarity, this.season) 
                    break
                case GachaBucket.SUMMON:
                    item = cache.fetchSummon(rarity, this.season)
                    break
                case GachaBucket.LIMITED:
                    item = cache.fetchLimited(this.gala)
                    break
            }
        } else {
            let rateupItems = this.rateups.map(item => item.name)
            let rateupRates = this.rateups.map(item => parseFloat(item.rate))

            console.log(rateupItems, rateupRates)
            
            let result = chance.weighted(rateupItems, rateupRates)
            return this.rateups.find(item => item.name == result)
        }

        return item
    }

    filterItems(item, gala, season) {
        // If both a gala and a season are specified, 
        // and the item appears in both
        if (
            (gala != null && season != null) && 
            (this.isLimited(item) || this.isSeasonal(item)) &&
            (item[gala] == 1 || item[season] == 1) 
        ) {
            return true
        }

        // If there is no gala specified, but this is a limited item
        if (gala == null && this.isLimited(item)) {
            return false
        }

        // If there is a gala specified, but this item doesn't appear in the gala
        if (gala != null && item[gala] == 0) {
            return false
        }

        // If there is no season specified, but this is a seasonal item
        if (season == null && this.isSeasonal(item)) {
            return false
        }

        // If there is a season specified, but this item doesn't appear in that season
        if (season != null && item[season] == 0) {
            return false
        }

        return true
    }

    isLimited(item) {
        return (item.flash == 1 || item.legend == 1) && item.premium == 0
    }

    isSeasonal(item) {
        return (item.halloween == 1 || item.holiday == 1 || item.summer == 1 || item.valentine == 1) && item.premium == 0
    }

    determineSSRBucket(rates) {
        // Calculate the total rate of all rateup items
        var rateupSum = 0
        for (var i in this.rateups) {
            rateupSum += parseFloat(this.rateups[i].rate)
        }

        // Store all the rates
        let bucketRates = [
            rateupSum, 
            rates.limited.rate * rates.limited.count, 
            rates.summon.rate * rates.summon.count, 
            rates.weapon.rate * rates.weapon.count
        ]
        let bucketKeys = [GachaBucket.RATEUP, GachaBucket.LIMITED, GachaBucket.SUMMON, GachaBucket.WEAPON]

        // Use Chance.js to determine a bucket
        return chance.weighted(bucketKeys, bucketRates)
    }
}

exports.Gacha = Gacha