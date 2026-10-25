export function startOverdueWorker(
  job: () => Promise<void>,
  schedule: (tick: () => void, intervalMs: number) => () => void,
  onError: (error: unknown) => void = console.error
) {
  let running = false
  let stopped = false
  const run = async () => {
    if (running || stopped) return
    running = true
    try {
      await job()
    } catch (error) {
      onError(error)
    } finally {
      running = false
    }
  }
  const cancel = schedule(
    () => {
      void run()
    },
    60 * 60 * 1000
  )
  void run()
  return () => {
    stopped = true
    cancel()
  }
}
