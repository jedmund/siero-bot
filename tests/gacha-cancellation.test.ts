import assert from "node:assert/strict"
import { setImmediate as nextTurn } from "node:timers/promises"
import test from "node:test"
import { GachaApiError, GachaClient } from "../src/services/gachaClient.js"
import { RuntimeLifecycle } from "../src/services/lifecycle.js"

function isCancellation(error: unknown) {
  assert.ok(error instanceof GachaApiError)
  assert.match(error.message, /cancelled.*restarting/)
  assert.doesNotMatch(error.message, /private reason|HENSEI_API_URL/)
  return true
}

await test("an already aborted client sends no catalogue or simulation request", async () => {
  const controller = new AbortController()
  controller.abort(new Error("private reason"))
  let requests = 0
  const client = new GachaClient(
    "http://test",
    async () => {
      requests++
      return Response.json({})
    },
    controller.signal,
  )
  await assert.rejects(client.catalogue({ mode: "premium" }), isCancellation)
  await assert.rejects(client.run("draw", { mode: "premium" }), isCancellation)
  assert.equal(requests, 0)
})

await test("runtime shutdown cancels in-flight API requests and drains tracked work", async () => {
  const runtime = new RuntimeLifecycle()
  let requestSignal: AbortSignal | undefined
  const client = new GachaClient(
    "http://test",
    (_url, init) => {
      requestSignal = init?.signal ?? undefined
      return new Promise((_resolve, reject) => {
        requestSignal!.addEventListener(
          "abort",
          () => reject(requestSignal!.reason),
          { once: true },
        )
      })
    },
    runtime.signal,
  )
  const pending = assert.rejects(
    client.run("until", { mode: "premium" }),
    isCancellation,
  )
  runtime.background(pending, "cancelled request assertion")
  assert.equal(requestSignal?.aborted, false)
  await runtime.shutdown()
  assert.equal(requestSignal?.aborted, true)
  await pending
})

await test("cancellation during response-body reading is not reported as malformed JSON", async () => {
  const controller = new AbortController()
  let bodyStarted!: () => void
  const reading = new Promise<void>((resolve) => {
    bodyStarted = resolve
  })
  const client = new GachaClient(
    "http://test",
    async (_url, init) => {
      const response = new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(new TextEncoder().encode('{"items":'))
            init!.signal!.addEventListener(
              "abort",
              () => stream.error(init!.signal!.reason),
              { once: true },
            )
          },
          pull() {
            bodyStarted()
          },
        }),
      )
      return response
    },
    controller.signal,
  )
  const pending = assert.rejects(
    client.catalogue({ mode: "premium" }),
    isCancellation,
  )
  await reading
  controller.abort(new Error("private reason"))
  await pending
})

await test("shutdown immediately interrupts queued polling delays without another request", async () => {
  const controller = new AbortController()
  let requests = 0
  const client = new GachaClient(
    "http://test",
    async () => {
      requests++
      return Response.json({ token: "queued-token", status: "queued" })
    },
    controller.signal,
  )
  let settled = false
  const pending = assert
    .rejects(
      client.run("draw", { mode: "premium", draws: "20000" }),
      isCancellation,
    )
    .then(() => {
      settled = true
    })
  await nextTurn()
  controller.abort()
  await nextTurn()
  assert.equal(
    settled,
    true,
    "polling should stop before its one-second delay elapses",
  )
  assert.equal(requests, 1)
  await pending
})

await test("request timeouts remain connection errors when shutdown has not started", async () => {
  const controller = new AbortController()
  const client = new GachaClient(
    "http://test",
    async () => {
      throw new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      )
    },
    controller.signal,
  )
  await assert.rejects(
    client.run("odds", { mode: "premium" }),
    (error: unknown) => {
      assert.ok(error instanceof GachaApiError)
      assert.match(error.message, /Cannot reach the gacha service/)
      assert.doesNotMatch(error.message, /restarting|cancelled/)
      return true
    },
  )
})
