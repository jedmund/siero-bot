export class RateupInputError extends Error {}

export function parseRateupPair(
  identifier: string | null,
  percentage: string | null,
  position: number,
) {
  if ((identifier === null) !== (percentage === null))
    throw new RateupInputError(
      `Item ${position} requires both an item and percentage.`,
    )
  if (identifier === null || percentage === null) return null
  if (!identifier.trim())
    throw new RateupInputError(`Item ${position} requires an item name or ID.`)
  if (!/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(percentage))
    throw new RateupInputError(`Invalid percentage for "${identifier}".`)
  const rate = Number(percentage)
  if (!Number.isFinite(rate) || rate <= 0 || rate > 6)
    throw new RateupInputError(
      `Percentage for "${identifier}" must be greater than 0 and no more than 6%.`,
    )
  return { identifier: identifier.trim(), rate }
}
