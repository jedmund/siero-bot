// import { Category } from "discord-akairo"

const { Cache } = require('./cache.js')
const { Chance } = require('chance')
import { GachaBucket, ItemType, Festival, Rarity, Item, RollsInSpark, Season, SSRRate } from './constants.js'

const cache = new Cache()
const chance = new Chance()

type RateMap = { [key: string]: number }

interface RarityCount {
    [index: string]: number
    R: number
    SR: number
    SSR: number
}

interface RollResult {
    count: RarityCount,
    items: Item[]
}

type CategoryMap = { [key: string]: Category }

interface Category {
    rate: number,
    count: number
}

export class Gacha {
    gala: string = 'premium'
    season: string | null = null
    rateups: Item[]
    rates: CategoryMap

    constructor(gala: string, season: string, rateups: Item[]) {
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
            case 'valentine':
                this.season = Season.VALENTINE
                break
        }

        this.rateups = rateups.filter(item => this.filterItems(item, this.gala, this.season))
        this.rates = this.ssrRates()
    }

    public singleRoll(): Item {
        const rarity: Rarity = this.determineRarity(false)
        return this.determineItem(rarity)
    }

    public tenPartRoll(times = 1, fetchAllItems = true): RollResult {
        // Create an object to store counts
        let count: RarityCount = {
            R: 0, 
            SR: 0, 
            SSR: 0 
        }

        let maxPulls = 10
        var items: Item[] = []

        for (let i = 0; i < times; i++) {
            for (let j = 0; j < maxPulls; j++) {
                var rarity

                if (j != maxPulls - 1) {
                    rarity = this.determineRarity(false)
                } else {
                    rarity = this.determineRarity(true)
                }

                count[this.mapRarity(rarity)] += 1

                if (rarity == Rarity.SSR || ((rarity == Rarity.R || rarity == Rarity.SR) && fetchAllItems)) {
                    items.push(this.determineItem(rarity))
                }
            }
        }

        return {
            count: count,
            items: items
        }
    }

    public spark(): RollResult {
        let maxRolls = RollsInSpark / 10
        return this.tenPartRoll(maxRolls, false)
    }

    private currentRates(final = false): RateMap {
        let rates: RateMap = {}
        const rateUp = (this.gala !== 'premium')

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

    private ssrRates(): CategoryMap {
        let rate = (this.gala != null) ? SSRRate * 2 : SSRRate

        let remainingWeapons = cache.characterWeapons(Rarity.SSR, this.gala, this.season).length
        let remainingSummons = cache.summons(Rarity.SSR, this.gala, this.season).length 

        // First, subtract the sum of the rates of any rate-up characters from the total rate.
        for (let i in this.rateups) {
            const item: Item = this.rateups[i]
            rate = rate - (item.rate as number)
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

    private mapRarity(number: number) {
        let rarity = ''

        switch(number) {
            case Rarity.R:
                rarity = 'R'
                break
            case Rarity.SR:
                rarity = 'SR'
                break
            case Rarity.SSR:
                rarity = 'SSR'
                break
        }

        return rarity
    }

    private determineRarity(final = false): Rarity {
        let rates = this.currentRates(final)

        let r: number
        if (final) {
            r = chance.weighted([Rarity.SR, Rarity.SSR], [rates.SR, rates.SSR])
        } else {
            r = chance.weighted([Rarity.R, Rarity.SR, Rarity.SSR], [rates.R, rates.SR, rates.SSR])
        }

        return r
    }

    private determineItem(rarity: Rarity): Item {
        var item: Item

        if (rarity === Rarity.SSR) {
            item = this.determineSSRItem()
        } else {
            item = cache.fetchItem(rarity, this.gala, this.season)
        }

        return item
    }

    private determineSSRItem(): Item {
        // Fixed rarity that matches the output of determineRarity
        const rarity = Rarity.SSR

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
            let rateupRates = this.rateups.map(item => parseFloat(item.rate as string))
            let result = chance.weighted(rateupItems, rateupRates)
            item = this.rateups.find(item => item.name == result)!
        }

        return item
    }

    private filterItems(item: Item, gala: string | null, season: string | null): boolean {
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

    public isLimited(item: Item): boolean {
        return (item.flash == true || item.legend == true) && item.premium == false
    }

    public isSeasonal(item: Item): boolean {
        return (item.halloween == true || item.holiday == true || item.summer == true || item.valentine == true) && item.premium == false
    }

    public getGala(item: Item): string {
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

    public getSeason(item: Item): string {
        var string = ''

        if (item.summer == true) {
            string = 'summer'
        } else if (item.holiday == true) {
            string = 'holiday'
        } else if (item.halloween == true) {
            string = 'halloween'
        } else if (item.valentine == true) {
            string = 'valentine'
        } else {
            string = 'all seasons'
        }
        
        return string
    }

    private determineSSRBucket(rates: CategoryMap): number {
        // Calculate the total rate of all rateup items
        let rateupSum: number = 0
        for (let i in this.rateups) {
            // TODO: Why won't these add as numbers if they are technically numbers?
            let item: Item = this.rateups[i]
            rateupSum = rateupSum + parseFloat(item.rate as string)
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