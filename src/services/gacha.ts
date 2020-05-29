// import { Category } from "discord-akairo"

const { Cache } = require('./cache.js')
const { Chance } = require('chance')
import { GachaBucket, ItemType, Festival, Rarity, Result, RollsInSpark, Season, SSRRate } from './constants.js'

const cache = new Cache()
const chance = new Chance()

type RateMap = { [key: string]: number }

interface RarityMap {
    string: string
    number: number
}

interface RarityCount {
    [index: string]: number
    R: number
    SR: number
    SSR: number
}

interface RollResult {
    count: RarityCount,
    items: Result[]
}

type CategoryMap = { [key: string]: Category }

interface Category {
    rate: number,
    count: number
}

class Gacha {
    gala: string = 'premium'
    season: string | null = null
    rateups: Result[]
    rates: CategoryMap

    constructor(gala: string, season: string, rateups: Result[]) {
        if (['flash', 'flashfest', 'ff'].includes(gala)) {
            this.gala = Festival.FLASH
        } else if (['legend', 'legfest', 'lf'].includes(gala)) {
            this.gala = Festival.LEGEND
        }

        switch(season) {
            case 'summer':
                this.season = Season.SUMMER
                break
            case 'halloween':
                this.season = Season.HALLOWEEN
                break
            case 'holiday':
                this.season = Season.HOLIDAY
                break
            case 'valentines':
                this.season = Season.VALENTINES
                break
        }

        this.rateups = rateups.filter(item => this.filterItems(item, this.gala, this.season))
        this.rates = this.ssrRates()
    }

    singleRoll(): Result {
        const rarity: RarityMap = this.determineRarity(false)
        return this.determineItem(rarity)
    }

    tenPartRoll(times = 1, fetchAllItems = true): RollResult {
        // Create an object to store counts
        let count: RarityCount = {
            R: 0, 
            SR: 0, 
            SSR: 0 
        }

        let maxPulls = 10
        var items: Result[] = []

        for (let i = 0; i < times; i++) {
            for (let j = 0; j < maxPulls; j++) {
                var rarity

                if (j != maxPulls - 1) {
                    rarity = this.determineRarity(false)
                } else {
                    rarity = this.determineRarity(true)
                }

                count[rarity.string] += 1

                if (rarity.number == Rarity.SSR || (rarity.number != Rarity.SSR && fetchAllItems)) {
                    items.push(this.determineItem(rarity))
                }
            }
        }

        return {
            count: count,
            items: items
        }
    }

    spark(): RollResult {
        let maxRolls = RollsInSpark / 10
        return this.tenPartRoll(maxRolls, false)
    }

    currentRates(final = false): RateMap {
        let rates: RateMap = {}
        const rateUp = (this.gala != null)

        if (rateUp && !final) {
            rates = {
                'R':   0.76,
                'SR':  0.15,
                'SSR': 0.06
            }
        }

        if (rateUp && final) {
            rates = {
                'SR':  0.94,
                'SSR': 0.06
            }
        }

        if (!rateUp && !final) {
            rates = {
                'R':   0.82,
                'SR':  0.15,
                'SSR': 0.03
            }
        }

        if (!rateUp && final) {
            rates = {
                'SR':  0.97,
                'SSR': 0.03
            }
        }
    
        return rates
    }

    ssrRates(): CategoryMap {
        let rate = (this.gala != null) ? SSRRate * 2 : SSRRate

        let remainingWeapons = cache.characterWeapons(Rarity.SSR, this.gala, this.season).length
        let remainingSummons = cache.summons(Rarity.SSR, this.gala, this.season).length 

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
                    isLimited = rateup.flash == true
                } else if (this.gala == Festival.LEGEND) {
                    isLimited = rateup.legend == true
                }

                return isLimited
            }).length

            rate = rate / ((remainingWeapons - remainingLimiteds) + (remainingLimiteds * 2))
        } else {
            rate = rate / remainingWeapons
        }

        return {
            'weapon'  : {
                'rate'  : rate,
                'count' : remainingWeapons - remainingLimiteds
            },
            'limited' : {
                'rate'  : rate * 2,
                'count' : remainingLimiteds
            },
            'summon'  : {
                'rate'  : summonRate,
                'count' : remainingSummons
            }
        }
    }

    determineRarity(final = false): RarityMap {
        let rates = this.currentRates(final)

        let r: number
        if (final) {
            r = chance.weighted(['SR', 'SSR'], [rates.SR, rates.SSR])
        } else {
            r = chance.weighted(['R', 'SR', 'SSR'], [rates.R, rates.SR, rates.SSR])
        }

        return {
            string: Rarity[r],
            number: r
        }
    }

    determineItem(rarity: RarityMap) {
        var item: Result

        if (rarity.number === Rarity.SSR) {
            item = this.determineSSRItem()
        } else {
            item = cache.fetchItem(rarity, this.gala, this.season)
        }

        return item
    }

    determineSSRItem() {
        // Fixed rarity that matches the output of determineRarity
        const rarity = {
            int: 3,
            string: 'SSR'
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
            let rateupRates = this.rateups.map(item => item.rate)
            
            let result = chance.weighted(rateupItems, rateupRates)
            return this.rateups.find(item => item.name == result)
        }

        return item
    }

    filterItems(item: Result, gala: string | null, season: string | null) {
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

    isLimited(item: Result) {
        return (item.flash == true || item.legend == true) && item.premium == false
    }

    isSeasonal(item: Result) {
        return (item.halloween == true || item.holiday == true || item.summer == true || item.valentines == true) && item.premium == false
    }

    getGala(item: Result) {
        let string = ''

        if (item.flash == true) {
            string = 'flash'
        } else if (item.legend == true) {
            string = 'legend'
        } else {
            string = 'premium'
        }

        return string
    }

    getSeason(item: Result) {
        var string = ''

        if (item.summer == true) {
            string = 'summer'
        } else if (item.holiday == true) {
            string = 'holiday'
        } else if (item.halloween == true) {
            string = 'halloween'
        } else if (item.valentines == true) {
            string = 'valentines'
        } else {
            string = 'all seasons'
        }
        
        return string
    }

    determineSSRBucket(rates: CategoryMap) {
        // Calculate the total rate of all rateup items
        var rateupSum = 0
        for (var i in this.rateups) {
            rateupSum += this.rateups[i].rate
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