export function validateConfiguration(environment: NodeJS.ProcessEnv) {
  for (const key of ["DATABASE_URL", "DISCORD_TOKEN"]) {
    if (!environment[key]?.trim()) throw new Error(`Missing required configuration: ${key}`)
  }
  try {
    const url = new URL(environment.DATABASE_URL!)
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error()
  } catch { throw new Error("DATABASE_URL must be a PostgreSQL URL") }
  if (environment.DEFAULT_RATEUP_USER_ID && !/^\d+$/.test(environment.DEFAULT_RATEUP_USER_ID)) throw new Error("DEFAULT_RATEUP_USER_ID must be a Discord user ID")
  if (environment.DISCORD_CLIENT_ID && !/^\d+$/.test(environment.DISCORD_CLIENT_ID)) throw new Error("DISCORD_CLIENT_ID must be a Discord user ID for the default rate-up source")
}
