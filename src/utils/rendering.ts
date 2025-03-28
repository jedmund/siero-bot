import { EmbedBuilder } from "discord.js"
import { readableRarity } from "./readable"
import { DrawableItemType, Rarity } from "./enums"
import type DrawableItem from "../interfaces/DrawableItem"
import type SparkResult from "../interfaces/SparkResult"
import { ItemRateMap } from "./types"

export class RenderingUtils {
  public static renderItems(results: DrawableItem[]) {
    const characterWeapons = this.sortCharacterWeapons(results)
    const gachaItems = results
      .filter((x) => !characterWeapons.includes(x))
      .concat(characterWeapons.filter((x) => !results.includes(x)))

    const items = this.shuffle(gachaItems).concat(characterWeapons)

    let string = ""
    for (const item in items) {
      string += this.renderItem(items[item], true)
    }

    return string
  }

  public static renderSpark(results: SparkResult, rateups: ItemRateMap) {
    const rate = Math.floor((results.count.SSR / 300) * 100)
    const summary = `\`\`\`${this.renderSummary(results, rateups)}\`\`\``

    let details = "```html\n"
    results.items.forEach((item: DrawableItem) => {
      details += this.renderItem(item, true)
    })
    details += "\n```"

    return new EmbedBuilder()
      .setDescription(details)
      .addFields(
        { name: "Summary", value: summary },
        { name: "Rate", value: `Your SSR rate is **${rate}%**` }
      )
  }

  public static renderItem(result: DrawableItem, combined: boolean = false) {
    const rarity: string = readableRarity(result.rarity)
    let response: string

    if (result.name && result.recruits) {
      response = `<${rarity}> ${
        result.name.en
      } – You recruited ${result.recruits.name.en.trim()}!`
    } else if (
      result.name &&
      !result.recruits &&
      result.type === DrawableItemType.SUMMON
    ) {
      response = `<${rarity} Summon> ${result.name.en}`
    } else {
      response = `<${rarity}> ${result.name.en}`
    }

    return !combined ? `\`\`\`html\n${response}\n\`\`\`` : `${response}\n`
  }

  public static renderSummary(results: SparkResult, rateups: ItemRateMap) {
    const ssrWeapons = results.items.filter(this.filterSSRWeapons)
    const ssrSummons = results.items.filter(this.filterSSRSummons)
    const numRateupItems = this.filterRateUpItems(results, rateups)

    // TODO: Extract into helper method
    // let targetsAcquired = results.items.filter((item: Item) => {
    //   if (this.sparkTarget != null) {
    //     return (
    //       item.name == this.sparkTarget.name ||
    //       (item.recruits != null && item.recruits == this.sparkTarget.recruits)
    //     )
    //   } else {
    //     return null
    //   }
    // })

    // let targetAcquiredString = ""
    // if (targetsAcquired != null) {
    //   targetAcquiredString =
    //     targetsAcquired.length > 0
    //       ? `You got your spark target! (${targetsAcquired.length})`
    //       : ""
    // }

    return [
      // targetAcquiredString,
      rateups.length > 0 ? `Rate-up Items: ${numRateupItems}` : "",
      `SSR Weapons: ${ssrWeapons.length}`,
      `SSR Summons: ${ssrSummons.length}`,
      `SR: ${results.count.SR}`,
      `R: ${results.count.R}`,
    ].join("\n")
  }

  private static filterSSRWeapons(item: DrawableItem) {
    return item.rarity === Rarity.SSR && item.type === DrawableItemType.WEAPON
  }

  private static filterSSRSummons(item: DrawableItem) {
    return item.rarity === Rarity.SSR && item.type === DrawableItemType.SUMMON
  }

  private static filterRateUpItems(spark: SparkResult, rateups: ItemRateMap) {
    let totalCount = 0
    for (const i in rateups) {
      const rateupItem: DrawableItem = rateups[i].item
      totalCount += spark.items.reduce((n: number, item: DrawableItem) => {
        return n + (rateupItem.id == item.id ? 1 : 0)
      }, 0)
    }
    return totalCount
  }

  private static sortCharacterWeapons(results: DrawableItem[]) {
    const weapons: DrawableItem[] = []

    results.forEach((item: DrawableItem) => {
      let hasPlacedSR = false
      let lastSRPos = 0
      let placedSSRCount = 0

      if (item.recruits) {
        // If an R is drawn, put it at the front of the list.
        if (item.rarity == Rarity.R) {
          weapons.unshift(item)
          lastSRPos = !hasPlacedSR ? weapons.length : lastSRPos
        }

        // If an SR is drawn, put it at the last SR position,
        // then record a new position.
        if (item.rarity == Rarity.SR) {
          weapons.splice(lastSRPos, 0, item)
          hasPlacedSR = !hasPlacedSR ? true : false
        }

        // If an SSR is drawn, put it at the end of the list.
        if (item.rarity == Rarity.SSR) {
          weapons.push(item)

          if (!hasPlacedSR) {
            placedSSRCount += 1
            lastSRPos = weapons.length - placedSSRCount
          }
        }
      }
    })

    return weapons
  }

  // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  private static shuffle(array: DrawableItem[]) {
    let currentIndex = array.length
    let temporaryValue, randomIndex

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
}
