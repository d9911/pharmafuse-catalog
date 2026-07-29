import type { ImportStats } from '../import-catalog.types'

export const IMPORT_BATCH_REPOSITORY = Symbol('IMPORT_BATCH_REPOSITORY')

export interface ImportBatchRepository {
  start(batchId: string, startedAt: string): Promise<void>
  complete(batchId: string, stats: ImportStats, finishedAt: string): Promise<void>
  fail(batchId: string, message: string, finishedAt: string): Promise<void>
}
