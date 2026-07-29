import { DataSource } from 'typeorm';
import { CreatePharmacyCatalog1785283200000 } from '@/database/migrations/1785283200000-create-pharmacy-catalog';
import type { NormalizedMedicineCandidate } from '../../domain/catalog.types';
import { entities } from './entities';
import { TypeOrmCatalogRepository } from './typeorm-catalog.repository';
import { TypeOrmImportBatchRepository } from './typeorm-import-batch.repository';
import { TypeOrmTransactionManager } from './typeorm-transaction.manager';

const candidate: NormalizedMedicineCandidate = {
  providerCode: 'pharmacy-a',
  externalId: 'a-100',
  sourceFile: 'pharmacy_a.json',
  canonicalName: 'Nurofen 200 mg tablets',
  normalizedName: 'nurofen',
  manufacturer: 'Reckitt Benckiser',
  normalizedManufacturer: 'reckitt benckiser',
  gtin: '05050123456789',
  gtinValid: false,
  dosageMicrograms: 200_000,
  dosageForm: 'TABLET',
  packageSize: 24,
  prescriptionRequired: false,
  countryCode: 'GB',
  registrationDate: '2023-01-15',
  compositeKey: 'nurofen|reckitt benckiser|200000|TABLET|24|GB',
  rawPayloadJson: '{"id":"a-100"}',
  normalizedPayloadJson: '{"normalizedName":"nurofen"}',
};

const now = '2026-07-29T10:00:00.000Z';

describe('PharmaFuse SQLite persistence', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      migrations: [CreatePharmacyCatalog1785283200000],
      migrationsRun: true,
      synchronize: false,
      prepareDatabase: (database: { pragma(statement: string): unknown }) => {
        database.pragma('foreign_keys = ON');
        database.pragma('journal_mode = MEMORY');
      },
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates every auditable table through a migration', async () => {
    const queryRunner = dataSource.createQueryRunner();

    await expect(queryRunner.hasTable('providers')).resolves.toBe(true);
    await expect(queryRunner.hasTable('import_batches')).resolves.toBe(true);
    await expect(queryRunner.hasTable('medicines')).resolves.toBe(true);
    await expect(queryRunner.hasTable('source_records')).resolves.toBe(true);
    await expect(queryRunner.hasTable('medicine_sources')).resolves.toBe(true);
    await expect(queryRunner.hasTable('import_errors')).resolves.toBe(true);
    await queryRunner.release();
  });

  it('enforces SQLite foreign keys', async () => {
    const rows = await dataSource.query<{ foreign_keys: number }[]>('PRAGMA foreign_keys');

    expect(rows).toEqual([{ foreign_keys: 1 }]);
  });

  it('finds an invalid GTIN only when the composite key corroborates it', async () => {
    const repository = new TypeOrmCatalogRepository(dataSource.manager);
    await repository.createMedicine('medicine-1', candidate, now);

    await expect(repository.findIdentityCandidates(candidate)).resolves.toEqual([
      {
        id: 'medicine-1',
        gtin: '05050123456789',
        gtinValid: false,
        compositeKey: candidate.compositeKey,
      },
    ]);
    await expect(
      repository.findIdentityCandidates({ ...candidate, compositeKey: 'different' }),
    ).resolves.toEqual([]);
  });

  it('persists one source link and returns it in the catalog projection', async () => {
    const batchRepository = new TypeOrmImportBatchRepository(dataSource.manager);
    const repository = new TypeOrmCatalogRepository(dataSource.manager);
    await batchRepository.start('batch-1', now);
    await repository.createMedicine('medicine-1', candidate, now);

    await expect(
      repository.sourceRecordExists('pharmacy-a', 'a-100', 'payload-hash'),
    ).resolves.toBe(false);
    await repository.createSourceAndLink({
      sourceRecordId: 'source-1',
      medicineId: 'medicine-1',
      importBatchId: 'batch-1',
      candidate,
      payloadHash: 'payload-hash',
      matchStrategy: 'NEW_RECORD',
      now,
    });
    await expect(
      repository.sourceRecordExists('pharmacy-a', 'a-100', 'payload-hash'),
    ).resolves.toBe(true);

    await expect(repository.listMedicines()).resolves.toEqual([
      expect.objectContaining({
        id: 'medicine-1',
        canonicalName: 'Nurofen 200 mg tablets',
        sources: [
          expect.objectContaining({
            providerCode: 'pharmacy-a',
            externalId: 'a-100',
            matchStrategy: 'NEW_RECORD',
          }),
        ],
      }),
    ]);
  });

  it('rolls back catalog writes while retaining failed batch audit', async () => {
    const batchRepository = new TypeOrmImportBatchRepository(dataSource.manager);
    const transactionManager = new TypeOrmTransactionManager(dataSource);
    await batchRepository.start('batch-1', now);

    await expect(
      transactionManager.run(async (repository) => {
        await repository.createMedicine('rolled-back', candidate, now);
        throw new Error('reader failed');
      }),
    ).rejects.toThrow('reader failed');
    await batchRepository.fail('batch-1', 'Catalog import failed', now);

    const repository = new TypeOrmCatalogRepository(dataSource.manager);
    await expect(repository.listMedicines()).resolves.toEqual([]);
    await expect(repository.listImportBatches()).resolves.toEqual([
      expect.objectContaining({
        id: 'batch-1',
        status: 'FAILED',
        failureMessage: 'Catalog import failed',
      }),
    ]);
  });
});
