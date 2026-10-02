import { Chance } from "chance"
import Cache from "./cache.js"

import type DrawableItem from "../interfaces/DrawableItem.js"
import type { RarityCount } from "../interfaces/RarityCount.js"

import { CategoryMap, ItemRateMap, RarityRateMap } from "../utils/types.js"
import {
  Rarity,
  Promotion,
  Season,
  DrawableItemType,
  GachaBucket,
} from "../utils/enums.js"
import { ROLLS_IN_SPARK, ROLLS_IN_TENPART, SSR_RATE } from "../utils/constants.js"

const cache = new Cache()
const chance = new Chance()

export class SimulationValidationError extends Error {}

export default class Gacha {
  gala: Promotion = Promotion.PREMIUM
  season: Season | undefined = undefined
  rateups: ItemRateMap = []
  rates: CategoryMap = {}
  private zeroRateIdentities = new Set<string>()

  public static async create(rateups: ItemRateMap, gala: Promotion, season?: Season) {
    await cache.load()
    return new Gacha(rateups, gala, season)
  }

  constructor(rateups: ItemRateMap, gala: Promotion, season?: Season, private catalogue: Cache = cache) {
    if (!Object.values(Promotion).includes(gala)) throw new SimulationValidationError(`Unsupported promotion: ${gala}`)
    if ([Promotion.CLASSIC, Promotion.CLASSIC_II, Promotion.CLASSIC_III].includes(gala) && season) throw new SimulationValidationError("Classic pools do not support seasonal filters")
    this.gala = gala
    this.season = season

    // You need to get the gala and season from the db i guess

    this.rateups = rateups.filter((rateup) =>
      this.filterItems(rateup.item, this.gala, this.season)
    )
    const identities = new Set<string>()
    let budget = 0
    for (const rateup of this.rateups) {
      if (rateup.item.rarity !== Rarity.SSR) throw new SimulationValidationError("Only SSR items support custom rate-ups")
      const identity = `${rateup.item.type}:${rateup.item.item_id}`
      if (identities.has(identity)) throw new SimulationValidationError("Duplicate rate-up drawable identity")
      identities.add(identity)
      if (!Number.isFinite(rateup.rate) || rateup.rate < 0) throw new SimulationValidationError("Rate-up rates must be finite and nonnegative")
      budget += rateup.rate
    }
    this.zeroRateIdentities = new Set(this.rateups.filter(rateup => rateup.rate === 0).map(rateup => `${rateup.item.type}:${rateup.item.item_id}`))
    const ssrBudget = [Promotion.FLASH, Promotion.LEGEND].includes(gala) ? SSR_RATE * 2 : SSR_RATE
    if (budget > ssrBudget) throw new SimulationValidationError(`Rate-up rates exceed the ${ssrBudget}% SSR budget`)
    for (const rarity of [Rarity.R, Rarity.SR, Rarity.SSR]) {
      if (this.catalogue.characterWeapons(rarity, gala, season).length + this.catalogue.summons(rarity, gala, season).length === 0) throw new SimulationValidationError(`Catalogue pool ${gala} has no rarity ${rarity} items; deploy complete promotion metadata before simulation`)
    }
    this.rates = this.ssrRates()
  }

  public canDraw(item: DrawableItem) {
    const identity = `${item.type}:${item.item_id}`
    if (this.zeroRateIdentities.has(identity)) return false
    const pool = [...this.catalogue.characterWeapons(item.rarity, this.gala, this.season), ...this.catalogue.summons(item.rarity, this.gala, this.season)]
    if (!pool.some(candidate => candidate.type === item.type && candidate.item_id === item.item_id)) return false
    if (item.rarity !== Rarity.SSR) return true
    if (this.rateups.some(rateup => rateup.item.type === item.type && rateup.item.item_id === item.item_id)) return true
    const category = item.type === DrawableItemType.SUMMON ? this.rates.summon : this.rates.weapon
    return category.rate > 0
  }

  public singleRoll() {
    const rarity = this.determineRarity(false)
    return this.determineItem(rarity)
  }

  public tenPartRoll(times = 1, fetchAllItems = true) {
    // Create an object to store counts
    const count: RarityCount = {
      R: 0,
      SR: 0,
      SSR: 0,
    }

    const items: DrawableItem[] = []

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
    const maxRolls = ROLLS_IN_SPARK / 10
    return this.tenPartRoll(maxRolls, false)
  }

  private currentRates(final = false) {
    let rates: RarityRateMap = {}
    const rateUp = [Promotion.FLASH, Promotion.LEGEND].includes(this.gala)

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
    let rate = [Promotion.FLASH, Promotion.LEGEND].includes(this.gala) ? SSR_RATE * 2 : SSR_RATE

    let remainingWeapons = this.catalogue.characterWeapons(
      Rarity.SSR,
      this.gala,
      this.season
    ).length
    let remainingSummons = this.catalogue.summons(
      Rarity.SSR,
      this.gala,
      this.season
    ).length

    // First, subtract the sum of the rates of any rate-up items (characters or summons) from the total rate.
    for (const i in this.rateups) {
      const rateup = this.rateups[i]
      rate = rate - rateup.rate
    }

    // Remove the quantity of rateups from the total count of character weapons and summons
    // prettier-ignore
    remainingWeapons = remainingWeapons - this.rateups.filter(rateup => rateup.item.type == DrawableItemType.WEAPON).length
    // prettier-ignore
    remainingSummons = remainingSummons - this.rateups.filter(rateup => rateup.item.type == DrawableItemType.SUMMON).length

    // Divide the difference evenly among all other items in the pool.
    // The quotient is the summon rate.
    const remainingCount = remainingWeapons + remainingSummons
    if (remainingCount === 0 && rate > 0) throw new SimulationValidationError("No eligible items remain for the residual SSR budget")
    const summonRate = remainingCount === 0 ? 0 : rate / remainingCount

    // Remove the combined rate of all summons in the pool from the total rate.
    rate = rate - remainingSummons * summonRate

    // Divide the difference by a+2b,
    // where a is the number of regular characters in the pool,
    // and b is the number of limited, non-rate-up characters in the pool.
    let remainingLimiteds = 0

    if (this.gala) {
      remainingLimiteds =
        this.catalogue.limitedWeapons(this.gala).length -
        this.rateups.filter((rateup) => {
          let isLimited

          if (this.gala === Promotion.FLASH) {
            isLimited = rateup.item.promotions.flash === true
          } else if (this.gala === Promotion.LEGEND) {
            isLimited = rateup.item.promotions.legend === true
          }

          return isLimited
        }).length

      rate =
        (remainingWeapons + remainingLimiteds === 0 ? 0 : rate / (remainingWeapons + remainingLimiteds))
    } else {
      rate = rate / remainingWeapons
    }

    const rates = {
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
    const rates = this.currentRates(final)

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
      item = this.catalogue.fetchItem(rarity, this.gala, this.season)
    }

    return item
  }

  private determineSSRItem(): DrawableItem {
    // Fix the value of rarity to ensure the output of determineRarity
    const rarity = Rarity.SSR

    // Fetch the rates and determine a bucket
    const bucket = this.determineSSRBucket(this.rates)

    let item: DrawableItem
    if (
      [GachaBucket.WEAPON, GachaBucket.SUMMON, GachaBucket.LIMITED].includes(
        bucket
      )
    ) {
      // Pick a random item from the appropriate bucket
      switch (bucket) {
        case GachaBucket.WEAPON:
          item = this.catalogue.fetchWeapon(
            rarity,
            this.rateups.map((rateup) => rateup.item),
            this.season,
            this.gala
          )
          break
        case GachaBucket.SUMMON:
          item = this.catalogue.fetchSummon(
            rarity,
            this.rateups.map((rateup) => rateup.item),
            this.season,
            this.gala
          )
          break
        case GachaBucket.LIMITED:
          item = this.catalogue.fetchLimited(
            this.gala,
            this.rateups.map((rateup) => rateup.item)
          )
          break
        default:
          item = this.catalogue.fetchWeapon(
            rarity,
            this.rateups.map((rateup) => rateup.item),
            this.season,
            this.gala
          )
          break
      }
    } else {
      const rateupItems = this.rateups.map((rateup) => rateup.item.name.en)
      const rateupRates = this.rateups.map((rateup) => rateup.rate)

      const result = chance.weighted(rateupItems, rateupRates)

      // NOTE: Why is this forced?
      const found = this.rateups.find((rateup) => rateup.item.name.en === result)
      item = found!.item
    }

    return item
  }

  private determineSSRBucket(rates: CategoryMap) {
    const limitedRate = rates.limited.rate * rates.limited.count
    const summonRate = rates.summon.rate * rates.summon.count
    const weaponRate = rates.weapon.rate * rates.weapon.count
    const allRateups = this.rateups.reduce((total, rateup) => total + rateup.rate, 0)
    const keys = [GachaBucket.RATEUP, GachaBucket.LIMITED, GachaBucket.SUMMON, GachaBucket.WEAPON]
    const weights = [allRateups, limitedRate, summonRate, weaponRate]
    const eligible = keys.map((key, index) => ({key, weight: weights[index]})).filter(entry => entry.weight > 0)
    return chance.weighted(eligible.map(entry => entry.key), eligible.map(entry => entry.weight))
  }

  private filterItems(item: DrawableItem, gala?: Promotion, season?: Season) {
    if (gala && [Promotion.CLASSIC, Promotion.CLASSIC_II, Promotion.CLASSIC_III].includes(gala)) return !!item.promotions[gala]
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
