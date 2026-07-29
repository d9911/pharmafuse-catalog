import { createHash } from 'node:crypto';
import type { ImportBatchResult, ImportStats } from './import-catalog.types';
import type { CatalogWriteRepository } from './ports/catalog-write.repository';
import type { ImportBatchRepository } from './ports/import-batch.repository';
import type { SourceReader, SourceRecordFailure, SourceRecordSuccess } from './ports/source-reader';
import type { TransactionManager } from './ports/transaction-manager';
import { normalizeMedicine } from '../domain/medicine-normalizer';
import { selectMatch } from '../domain/medicine-matcher';

export class CatalogImportFailedError extends Error {
  constructor() {
    super('Catalog import failed');
    this.name = 'CatalogImportFailedError';
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  const stable = stableValue(value);
  if (stable === undefined) {
    throw new Error('VALUE_IS_NOT_JSON_SERIALIZABLE');
  }
  return JSON.stringify(stable);
}

function payloadHash(record: SourceRecordSuccess['record']): string {
  return createHash('sha256')
    .update(`${record.providerCode}\n${record.externalId}\n${stableJson(record.rawPayload)}`)
    .digest('hex');
}

function emptyStats(): ImportStats {
  return {
    providerRecordsRead: 0,
    medicinesCreated: 0,
    sourceRecordsLinked: 0,
    duplicatesMerged: 0,
    recordErrors: 0,
  };
}

export class ImportCatalogUseCase {
  constructor(
    private readonly readers: readonly SourceReader[],
    private readonly transactionManager: TransactionManager,
    private readonly importBatchRepository: ImportBatchRepository,
    private readonly clock: () => Date,
    private readonly createId: () => string,
  ) {}

  async execute(): Promise<ImportBatchResult> {
    const batchId = this.createId();
    const startedAt = this.clock().toISOString();
    await this.importBatchRepository.start(batchId, startedAt);

    let stats: ImportStats;
    try {
      stats = await this.transactionManager.run(async (repository) => {
        const currentStats = emptyStats();

        for (const reader of this.readers) {
          const results = await reader.read();
          for (const result of results) {
            currentStats.providerRecordsRead += 1;

            if (!result.ok) {
              await this.persistSourceFailure(repository, batchId, result);
              currentStats.recordErrors += 1;
              continue;
            }

            const hash = payloadHash(result.record);
            if (
              await repository.sourceRecordExists(
                result.record.providerCode,
                result.record.externalId,
                hash,
              )
            ) {
              continue;
            }

            try {
              const candidate = normalizeMedicine(result.record);
              const identities = await repository.findIdentityCandidates(candidate);
              const decision = selectMatch(candidate, identities);
              const medicineId = decision.medicineId ?? this.createId();

              if (decision.strategy === 'NEW_RECORD') {
                await repository.createMedicine(medicineId, candidate, this.clock().toISOString());
                currentStats.medicinesCreated += 1;
              } else {
                currentStats.duplicatesMerged += 1;
              }

              await repository.createSourceAndLink({
                sourceRecordId: this.createId(),
                medicineId,
                importBatchId: batchId,
                candidate,
                payloadHash: hash,
                matchStrategy: decision.strategy,
                now: this.clock().toISOString(),
              });
              currentStats.sourceRecordsLinked += 1;
            } catch (error) {
              await repository.createImportError({
                id: this.createId(),
                importBatchId: batchId,
                providerCode: result.record.providerCode,
                externalId: result.record.externalId,
                sourceFile: result.record.sourceFile,
                errorCode: 'NORMALIZATION_FAILED',
                message: error instanceof Error ? error.message : 'Normalization failed',
                rawPayloadJson: stableJson(result.record.rawPayload),
                now: this.clock().toISOString(),
              });
              currentStats.recordErrors += 1;
            }
          }
        }

        return currentStats;
      });
    } catch {
      await this.importBatchRepository.fail(
        batchId,
        'Catalog import failed',
        this.clock().toISOString(),
      );
      throw new CatalogImportFailedError();
    }

    const finishedAt = this.clock().toISOString();
    await this.importBatchRepository.complete(batchId, stats, finishedAt);
    return {
      id: batchId,
      status: 'COMPLETED',
      startedAt,
      finishedAt,
      ...stats,
    };
  }

  private async persistSourceFailure(
    repository: CatalogWriteRepository,
    batchId: string,
    failure: SourceRecordFailure,
  ): Promise<void> {
    await repository.createImportError({
      id: this.createId(),
      importBatchId: batchId,
      providerCode: failure.providerCode,
      externalId: failure.externalId,
      sourceFile: failure.sourceFile,
      errorCode: failure.errorCode,
      message: failure.message,
      rawPayloadJson: stableJson(failure.rawPayload),
      now: this.clock().toISOString(),
    });
  }
}
