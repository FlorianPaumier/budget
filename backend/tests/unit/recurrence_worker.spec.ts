import { test } from '@japa/runner'
import { startOverdueWorker } from '../../app/services/recurrence_worker.js'

test.group('overdue worker', () => {
  test('runs at startup and every hour without overlapping runs', async ({ assert }) => {
    let tick: (() => void) | undefined
    let resolveFirst: (() => void) | undefined
    let runs = 0
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const stop = startOverdueWorker(
      async () => {
        runs++
        if (runs === 1) await firstRun
      },
      (callback, interval) => {
        assert.equal(interval, 60 * 60 * 1000)
        tick = callback
        return () => {}
      }
    )
    await Promise.resolve()
    tick!()
    assert.equal(runs, 1)
    resolveFirst!()
    await new Promise((resolve) => setImmediate(resolve))
    tick!()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(runs, 2)
    stop()
  })
})
