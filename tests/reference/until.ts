import { setImmediate as yieldTurn } from "node:timers/promises"
import { runtime } from "../../src/services/lifecycle.js"
import { SimulationValidationError } from "../../src/services/simulation.js"
import type DrawableItem from "../../src/interfaces/DrawableItem.js"
export async function rollUntilTarget(
  gacha: {
    canDraw(target: DrawableItem): boolean
    tenPartRoll(): { items: DrawableItem[] }
  },
  target: DrawableItem,
  maximumDraws = 100000,
) {
  if (
    !Number.isInteger(maximumDraws) ||
    maximumDraws < 10 ||
    maximumDraws > 100000 ||
    maximumDraws % 10 !== 0
  )
    throw new SimulationValidationError(
      "Draw limit must be a multiple of ten between 10 and 100000",
    )
  if (!gacha.canDraw(target))
    throw new SimulationValidationError(
      "The target is unavailable in the selected pool or has zero effective probability",
    )
  for (let count = 10; count <= maximumDraws; count += 10) {
    runtime.assertAccepting()
    if (count % 1000 === 0) await yieldTurn()
    runtime.assertAccepting()
    if (
      gacha
        .tenPartRoll()
        .items.some(
          (item) =>
            item.type === target.type && item.item_id === target.item_id,
        )
    )
      return count
  }
  throw new SimulationValidationError(
    `Stopped after ${maximumDraws} draws without finding the target`,
  )
}
