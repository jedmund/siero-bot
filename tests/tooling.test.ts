import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { ESLint } from "eslint"

void test("lint rejects an unhandled promise in TypeScript", async () => {
  const fixture = join(import.meta.dirname, "promise-fixture.ts")
  try {
    await writeFile(fixture, "Promise.resolve(1)\n")
    const results = await new ESLint().lintFiles([fixture])
    assert.ok(
      results[0].messages.some(
        (message) =>
          message.ruleId === "@typescript-eslint/no-floating-promises",
      ),
    )
  } finally {
    await rm(fixture, { force: true })
  }
})

void test("test runner rejects a broken behavioral assertion", async () => {
  const directory = await mkdtemp(join(tmpdir(), "siero-test-runner-"))
  try {
    const fixture = join(directory, "broken.test.mjs")
    await writeFile(
      fixture,
      'import test from "node:test"; import assert from "node:assert/strict"; test("broken behavior", () => assert.equal(1 + 1, 3));',
    )
    const environment = { ...process.env }
    delete environment.NODE_TEST_CONTEXT
    const result = spawnSync(process.execPath, ["--test", fixture], {
      env: environment,
      encoding: "utf8",
    })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stdout, /broken behavior/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

void test("production entry point loads from compiled deployment layout", () => {
  const environment = { ...process.env }
  delete environment.DISCORD_TOKEN
  delete environment.DATABASE_URL
  const result = spawnSync(
    process.execPath,
    ["--import", "./scripts/startup-smoke.mjs", "./build/dist/index.js"],
    { encoding: "utf8", env: environment },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Compiled startup reached mocked login/)
})
