export class RuntimeLifecycle {
  private controller = new AbortController()
  private tasks = new Set<Promise<unknown>>()
  private cleanups = new Set<() => void | Promise<void>>()
  get signal(): AbortSignal { return this.controller.signal }
  assertAccepting() { if (this.signal.aborted) throw new Error("The bot is shutting down; please try again later") }
  registerCleanup(cleanup: () => void | Promise<void>) { this.cleanups.add(cleanup); return () => { this.cleanups.delete(cleanup) } }
  background(task: Promise<unknown>, context: string) {
    const handled = task.catch((error: unknown) => { console.error(context, error) }).finally(() => { this.tasks.delete(handled) })
    this.tasks.add(handled)
  }
  async shutdown() {
    this.controller.abort()
    await Promise.allSettled([...this.cleanups].map(async cleanup => { await cleanup() }))
    this.cleanups.clear()
    await Promise.allSettled([...this.tasks])
  }
}
export const runtime = new RuntimeLifecycle()
