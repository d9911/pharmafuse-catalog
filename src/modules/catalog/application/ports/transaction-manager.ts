import type { CatalogWriteRepository } from './catalog-write.repository'

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')

export interface TransactionManager {
  run<T>(work: (repository: CatalogWriteRepository) => Promise<T>): Promise<T>
}
