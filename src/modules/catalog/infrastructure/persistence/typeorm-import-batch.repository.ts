import type { EntityManager } from 'typeorm';
import type { ImportStats } from '../../application/import-catalog.types';
import type { ImportBatchRepository } from '../../application/ports/import-batch.repository';
import { ImportBatchOrmEntity } from './entities';

export class TypeOrmImportBatchRepository implements ImportBatchRepository {
  constructor(private readonly manager: EntityManager) {}

  async start(batchId: string, startedAt: string): Promise<void> {
    await this.manager.getRepository(ImportBatchOrmEntity).insert({
      id: batchId,
      status: 'RUNNING',
      startedAt,
      finishedAt: null,
      providerRecordsRead: 0,
      medicinesCreated: 0,
      sourceRecordsLinked: 0,
      duplicatesMerged: 0,
      recordErrors: 0,
      failureMessage: null,
    });
  }

  async complete(batchId: string, stats: ImportStats, finishedAt: string): Promise<void> {
    await this.manager.getRepository(ImportBatchOrmEntity).update(
      { id: batchId },
      {
        status: 'COMPLETED',
        finishedAt,
        providerRecordsRead: stats.providerRecordsRead,
        medicinesCreated: stats.medicinesCreated,
        sourceRecordsLinked: stats.sourceRecordsLinked,
        duplicatesMerged: stats.duplicatesMerged,
        recordErrors: stats.recordErrors,
        failureMessage: null,
      },
    );
  }

  async fail(batchId: string, message: string, finishedAt: string): Promise<void> {
    await this.manager.getRepository(ImportBatchOrmEntity).update(
      { id: batchId },
      {
        status: 'FAILED',
        finishedAt,
        failureMessage: message,
      },
    );
  }
}
