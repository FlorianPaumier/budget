import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { processOverdueHouseholds } from '#services/recurrence_store'
import { startOverdueWorker } from '#services/recurrence_worker'

// Code generation warms up routes without starting background financial processing.
if (app.getMode() === 'run') {
  const workerKey = Symbol.for('budget.overdueWorker.stop')
  type WorkerGlobal = typeof globalThis & { [workerKey]?: () => void }
  const workerGlobal = globalThis as WorkerGlobal
  workerGlobal[workerKey]?.()
  workerGlobal[workerKey] = startOverdueWorker(
    async () => {
      const count = await processOverdueHouseholds(
        db.connection().getWriteClient(),
        new Date().toISOString()
      )
      if (count) logger.info({ count }, 'Automatically confirmed overdue bills')
    },
    (tick, interval) => {
      const timer = setInterval(tick, interval)
      timer.unref()
      return () => clearInterval(timer)
    },
    (error) => logger.error({ err: error }, 'Overdue bill processing failed')
  )
}
