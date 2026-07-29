import { randomUUID } from 'node:crypto'
import { Module } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { APP_CONFIG, type AppConfig } from '../../config/app-config'
import { AppConfigModule } from '../../config/app-config.module'
import { GetCatalogQuery } from './application/get-catalog.query'
import { ImportCatalogUseCase } from './application/import-catalog.use-case'
import { CATALOG_READ_REPOSITORY, type CatalogReadRepository } from './application/ports/catalog-read.repository'
import { IMPORT_BATCH_REPOSITORY, type ImportBatchRepository } from './application/ports/import-batch.repository'
import { SOURCE_READERS, type SourceReader } from './application/ports/source-reader'
import { TRANSACTION_MANAGER, type TransactionManager } from './application/ports/transaction-manager'
import { PharmacyAReader } from './infrastructure/sources/pharmacy-a.reader'
import { PharmacyBReader } from './infrastructure/sources/pharmacy-b.reader'
import { PharmacyCReader } from './infrastructure/sources/pharmacy-c.reader'
import { TypeOrmCatalogRepository } from './infrastructure/persistence/typeorm-catalog.repository'
import { TypeOrmImportBatchRepository } from './infrastructure/persistence/typeorm-import-batch.repository'
import { TypeOrmTransactionManager } from './infrastructure/persistence/typeorm-transaction.manager'
import { CatalogResolver } from './presentation/graphql/catalog.resolver'

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: SOURCE_READERS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): SourceReader[] => [
        new PharmacyAReader(config.sourceRoot),
        new PharmacyBReader(config.sourceRoot),
        new PharmacyCReader(config.sourceRoot),
      ],
    },
    {
      provide: CATALOG_READ_REPOSITORY,
      inject: [DataSource],
      useFactory: (dataSource: DataSource): CatalogReadRepository => new TypeOrmCatalogRepository(dataSource.manager),
    },
    {
      provide: IMPORT_BATCH_REPOSITORY,
      inject: [DataSource],
      useFactory: (dataSource: DataSource): ImportBatchRepository => new TypeOrmImportBatchRepository(dataSource.manager),
    },
    {
      provide: TRANSACTION_MANAGER,
      inject: [DataSource],
      useFactory: (dataSource: DataSource): TransactionManager => new TypeOrmTransactionManager(dataSource),
    },
    {
      provide: GetCatalogQuery,
      inject: [CATALOG_READ_REPOSITORY],
      useFactory: (repository: CatalogReadRepository) => new GetCatalogQuery(repository),
    },
    {
      provide: ImportCatalogUseCase,
      inject: [SOURCE_READERS, TRANSACTION_MANAGER, IMPORT_BATCH_REPOSITORY],
      useFactory: (readers: SourceReader[], transactionManager: TransactionManager, importBatchRepository: ImportBatchRepository) =>
        new ImportCatalogUseCase(
          readers,
          transactionManager,
          importBatchRepository,
          () => new Date(),
          () => randomUUID(),
        ),
    },
    CatalogResolver,
  ],
})
export class CatalogModule {}
