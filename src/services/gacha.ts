import { Chance } from "chance"
import Cache from "./cache"

import type DrawableItem from "../interfaces/DrawableItem"

import { CategoryMap, RateMap } from "../utils/types"
import {
  Rarity,
  Promotion,
  Season,
  DrawableItemType,
  GachaBucket,
} from "../utils/enums"
import { ROLLS_IN_SPARK, ROLLS_IN_TENPART, SSR_RATE } from "../utils/constants"

const cache = new Cache()
const chance = new Chance()

export default class Gacha {
  gala: Promotion = Promotion.PREMIUM
  season: Season | undefined = undefined
  rateups: DrawableItem[] = []
  rates: CategoryMap = {}

  constructor(rateups: DrawableItem[], gala: Promotion, season?: Season) {
    this.gala = gala
    this.season = season

    this.rateups = rateups.filter((item) =>
      this.filterItems(item, this.gala, this.season)
    )
    this.rates = this.ssrRates()
  }

  public singleRoll() {
    const rarity = this.determineRarity(false)
    return this.determineItem(rarity)
  }

  public tenPartRoll(times = 1, fetchAllItems = true) {
    // Create an object to store counts
    let count: RarityCount = {
      R: 0,
      SR: 0,
      SSR: 0,
    }

    let items: DrawableItem[] = []

    for (let i = 0; i < times; i++) {
      for (let j = 0; j < ROLLS_IN_TENPART; j++) {
        let rarity: Rarity | undefined

        if (j != ROLLS_IN_TENPART - 1) {
          rarity = this.determineRarity(false)
        } else {
          rarity = this.determineRarity(true)
        }

        count[this.mapRarity(rarity)] += 1

        if (
          rarity == Rarity.SSR ||
          ((rarity == Rarity.R || rarity == Rarity.SR) && fetchAllItems)
        ) {
          items.push(this.determineItem(rarity))
        }
      }
    }

    return {
      count: count,
      items: items,
    }
  }

  public spark() {
    let maxRolls = ROLLS_IN_SPARK / 10
    return this.tenPartRoll(maxRolls, false)
  }

  private currentRates(final = false) {
    let rates: RateMap = {}
    const rateUp = ![Promotion.PREMIUM, Promotion.CLASSIC].includes(this.gala)

    if (rateUp && !final) {
      rates = {
        R: 0.76,
        SR: 0.15,
        SSR: 0.06,
      }
    }

    if (rateUp && final) {
      rates = {
        SR: 0.94,
        SSR: 0.06,
      }
    }

    if (!rateUp && !final) {
      rates = {
        R: 0.82,
        SR: 0.15,
        SSR: 0.03,
      }
    }

    if (!rateUp && final) {
      rates = {
        SR: 0.97,
        SSR: 0.03,
      }
    }

    return rates
  }

  private ssrRates() {
    let rate = this.gala ? SSR_RATE * 2 : SSR_RATE

    let remainingWeapons = cache.characterWeapons(
      Rarity.SSR,
      this.gala,
      this.season
    ).length
    let remainingSummons = cache.summons(
      Rarity.SSR,
      this.gala,
      this.season
    ).length

    // First, subtract the sum of the rates of any rate-up items (characters or summons) from the total rate.
    for (let i in this.rateups) {
      const item = this.rateups[i]
      rate = rate - (item.rate as number)
    }

    // Remove the quantity of rateups from the total count of character weapons and summons
    // prettier-ignore
    remainingWeapons = remainingWeapons - this.rateups.filter(rateup => rateup.itemType == DrawableItemType.WEAPON).length
    // prettier-ignore
    remainingSummons = remainingSummons - this.rateups.filter(rateup => rateup.itemType == DrawableItemType.SUMMON).length

    // Divide the difference evenly among all other items in the pool.
    // The quotient is the summon rate.
    let summonRate = rate / (remainingWeapons + remainingSummons)

    // Remove the combined rate of all summons in the pool from the total rate.
    rate = rate - remainingSummons * summonRate

    // Divide the difference by a+2b,
    // where a is the number of regular characters in the pool,
    // and b is the number of limited, non-rate-up characters in the pool.
    let remainingLimiteds = 0

    if (this.gala) {
      remainingLimiteds =
        cache.limitedWeapons(this.gala).length -
        this.rateups.filter((rateup) => {
          let isLimited

          if (this.gala === Promotion.FLASH) {
            isLimited = rateup.flash === true
          } else if (this.gala === Promotion.LEGEND) {
            isLimited = rateup.legend === true
          }

          return isLimited
        }).length

      rate =
        rate / (remainingWeapons - remainingLimiteds + remainingLimiteds * 2)
    } else {
      rate = rate / remainingWeapons
    }

    let rates = {
      weapon: {
        rate: rate,
        count: remainingWeapons - remainingLimiteds,
      },
      limited: {
        rate: rate * 2,
        count: remainingLimiteds,
      },
      summon: {
        rate: summonRate,
        count: remainingSummons,
      },
    }

    return rates
  }

  private mapRarity(number: number) {
    let rarity = ""

    switch (number) {
      case Rarity.R:
        rarity = "R"
        break
      case Rarity.SR:
        rarity = "SR"
        break
      case Rarity.SSR:
        rarity = "SSR"
        break
    }

    return rarity
  }

  private determineRarity(final = false) {
    let rates = this.currentRates(final)

    let r: number
    if (final) {
      r = chance.weighted([Rarity.SR, Rarity.SSR], [rates.SR, rates.SSR])
    } else {
      r = chance.weighted(
        [Rarity.R, Rarity.SR, Rarity.SSR],
        [rates.R, rates.SR, rates.SSR]
      )
    }

    return r
  }

  private determineItem(rarity: Rarity) {
    let item: DrawableItem

    if (rarity === Rarity.SSR) {
      item = this.determineSSRItem()
    } else {
      item = cache.fetchItem(rarity, this.gala, this.season)
    }

    return item
  }

  private determineSSRItem(): DrawableItem {
    // Fix the value of rarity to ensure the output of determineRarity
    const rarity = Rarity.SSR

    // Fetch the rates and determine a bucket
    let bucket = this.determineSSRBucket(this.rates)

    let item: DrawableItem
    if (
      [GachaBucket.WEAPON, GachaBucket.SUMMON, GachaBucket.LIMITED].includes(
        bucket
      )
    ) {
      // Pick a random item from the appropriate bucket
      switch (bucket) {
        case GachaBucket.WEAPON:
          item = cache.fetchWeapon(rarity, this.rateups, this.season)
          break
        case GachaBucket.SUMMON:
          item = cache.fetchSummon(rarity, this.rateups, this.season)
          break
        case GachaBucket.LIMITED:
          item = cache.fetchLimited(this.gala, this.rateups)
          break
        default:
          item = cache.fetchWeapon(rarity, this.rateups, this.season)
          break
      }
    } else {
      let rateupItems = this.rateups.map((item) => item.name)
      let rateupRates = this.rateups.map((item) =>
        parseFloat(item.rate as string)
      )

      let result = chance.weighted(rateupItems, rateupRates)
      // NOTE: Why is this forced?
      item = this.rateups.find((item) => item.name === result)!
    }

    return item
  }

  private determineSSRBucket(rates: CategoryMap) {
    let allRateups: number
    let bucketKeys: number[]
    let bucketRates: number[]

    let limitedRate = rates.limited.rate * rates.limited.count
    let summonRate = rates.summon.rate * rates.summon.count
    let weaponRate = rates.weapon.rate * rates.weapon.count

    if (this.rateups.length > 0) {
      allRateups = 0

      for (let i in this.rateups) {
        let item = this.rateups[i]
        allRateups = allRateups + parseFloat(item.rate as string)
      }

      bucketKeys = [
        GachaBucket.RATEUP,
        GachaBucket.LIMITED,
        GachaBucket.SUMMON,
        GachaBucket.WEAPON,
      ]

      bucketRates = [
        1,
        limitedRate / allRateups,
        summonRate / allRateups,
        weaponRate / allRateups,
      ]
    } else {
      allRateups = 1

      bucketKeys = [GachaBucket.LIMITED, GachaBucket.SUMMON, GachaBucket.WEAPON]

      bucketRates = [
        limitedRate / allRateups,
        summonRate / allRateups,
        weaponRate / allRateups,
      ]
    }

    // Use chance.js to determine a bucket
    return chance.weighted(bucketKeys, bucketRates)
  }

  private filterItems(item: DrawableItem, gala?: Promotion, season?: Season) {
    // If both a gala and a season are specified,
    // and the item appears in both
    if (
      gala &&
      season &&
      (this.isLimited(item) || this.isSeasonal(item)) &&
      (item.promotions[gala] || item.seasons[season])
    )
      return true
    // If there is no gala specified, but this is a limited item
    else if (!gala && this.isLimited(item)) return false
    // If there is no season specified, but this is a seasonal item
    else if (!season && this.isSeasonal(item)) return false
    // If there is a gala and season specified, but this item doesn't appear in either
    else if (gala && !item.promotions[gala] && season && !item.seasons[season])
      return false
    // If there is a season specified, but this item doesn't appear in that season
    else if (season && !item.seasons[season]) return false
    // If there is a gala specified, but this item doesn't appear in that gala
    else if (gala && !item.promotions[gala]) return false

    return true
  }

  public isLimited(item: DrawableItem) {
    return (
      (item.promotions.flash || item.promotions.legend) &&
      !item.promotions.premium &&
      !item.promotions.classic
    )
  }

  public isSeasonal(item: DrawableItem) {
    return (
      (item.seasons.halloween ||
        item.seasons.holiday ||
        item.seasons.summer ||
        item.seasons.valentines) &&
      !item.promotions.premium &&
      !item.promotions.classic
    )
  }

  public isClassic(item: DrawableItem) {
    return item.promotions.classic && !item.promotions.premium
  }

  public getSeason(item: DrawableItem) {
    let string = ""

    if (item.seasons.summer) string = "summer"
    else if (item.seasons.holiday) string = "holiday"
    else if (item.seasons.halloween) string = "halloween"
    else if (item.seasons.valentines) string = "valentines"
    else string = "all seasons"

    return string
  }
}
