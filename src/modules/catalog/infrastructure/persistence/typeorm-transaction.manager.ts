import type { DataSource } from 'typeorm'
import type { CatalogWriteRepository } from '../../application/ports/catalog-write.repository'
import type { TransactionManager } from '../../application/ports/transaction-manager'
import { TypeOrmCatalogRepository } from './typeorm-catalog.repository'

export class TypeOrmTransactionManager implements TransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (repository: CatalogWriteRepository) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (entityManager) => work(new TypeOrmCatalogRepository(entityManager)))
  }
}
