// Exercise real runtime dependencies while suppressing credentials and login.
import { registerHooks } from "node:module"
import { readFile } from "node:fs/promises"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "dotenv/config") {
      return { url: "data:text/javascript,export {}", shortCircuit: true }
    }
    if (
      specifier.endsWith("/services/cache.js") ||
      specifier === "./services/cache.js"
    ) {
      return {
        url: "data:text/javascript,export const catalogueCache={load:async()=>{},startRefresh:()=>{},close:async()=>{}}",
        shortCircuit: true,
      }
    }
    if (specifier === "./services/readiness.js") {
      const source =
        process.env.SMOKE_OLD_RATEUP_SCHEMA === "1"
          ? 'export async function checkRateupSchema() { throw Error("Missing typed rate-up migration: gacha_rateups.drawable_type and drawable_id are required") }'
          : "export async function checkRateupSchema() {}"
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      }
    }
    return nextResolve(specifier, context)
  },
})

const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
)
for (const dependency of Object.keys(manifest.dependencies)) {
  await import(dependency)
}
const { SapphireClient } = await import("@sapphire/framework")
SapphireClient.prototype.login = function (token) {
  if (token !== "smoke-token")
    throw Error("Smoke test must not receive a token")
  if (!this.options.intents.bitfield) throw Error("Missing intents")
  console.log("Compiled startup reached mocked login")
  return Promise.resolve("smoke")
}

process.env.DISCORD_TOKEN = "smoke-token"
process.env.DATABASE_URL = "postgresql://smoke:smoke@localhost/smoke"

process.env.HENSEI_API_URL = "https://api.example.test/v1"
