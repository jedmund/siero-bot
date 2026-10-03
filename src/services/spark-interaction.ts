import { SparkInputError, SparkOverflowError } from "./sparks.js"

/** A response failure after commit must never be reported as a failed save. */
export async function replyAfterSparkMutation<T>(
  save: () => Promise<T>,
  replySuccess: (committed: T) => Promise<void>,
  replyError: (message: string) => Promise<void>,
): Promise<void> {
  let committed: T
  try {
    committed = await save()
  } catch (error) {
    if (
      error instanceof SparkInputError ||
      error instanceof SparkOverflowError
    ) {
      await replyError(error.message)
      return
    }
    await replyError(
      "I couldn’t confirm your spark update. Check /spark progress before trying again.",
    )
    throw error
  }
  await replySuccess(committed)
}
