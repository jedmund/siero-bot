import { spawnSync } from "node:child_process"

if (!process.env.SPARK_TEST_ADMIN_URL) {
  console.error(
    "SPARK_TEST_ADMIN_URL is required for explicit integration tests",
  )
  process.exit(1)
}
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "tests/*.integration.test.ts"],
  { stdio: "inherit", env: process.env },
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
