// Exercise real runtime dependencies while suppressing credentials and login.
import { registerHooks } from "node:module"
import { readFile } from "node:fs/promises"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "dotenv/config") {
      return { url: "data:text/javascript,export {}", shortCircuit: true }
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
  if (token !== undefined) throw Error("Smoke test must not receive a token")
  if (!this.options.intents.bitfield) throw Error("Missing intents")
  console.log("Compiled startup reached mocked login")
  return Promise.resolve("smoke")
}
