import { join } from 'node:path'
import type { ImportStats } from './import-catalog.types'
import { CatalogImportFailedError, ImportCatalogUseCase } from './import-catalog.use-case'
import type { CreateImportErrorInput, CreateSourceAndLinkInput, CatalogWriteRepository } from './ports/catalog-write.repository'
import type { ImportBatchRepository } from './ports/import-batch.repository'
import { SourceReadError, type SourceReader, type SourceRecordFailure } from './ports/source-reader'
import type { TransactionManager } from './ports/transaction-manager'
import type { ExistingMedicineIdentity, NormalizedMedicineCandidate, RawMedicineRecord } from '../domain/catalog.types'
import { PharmacyAReader } from '../infrastructure/sources/pharmacy-a.reader'
import { PharmacyBReader } from '../infrastructure/sources/pharmacy-b.reader'
import { PharmacyCReader } from '../infrastructure/sources/pharmacy-c.reader'

class MemoryCatalogRepository implements CatalogWriteRepository {
  medicines: { id: string; candidate: NormalizedMedicineCandidate }[] = []
  sourceRecords: CreateSourceAndLinkInput[] = []
  importErrors: CreateImportErrorInput[] = []

  findIdentityCandidates(): Promise<ExistingMedicineIdentity[]> {
    return Promise.resolve(
      this.medicines.map(({ id, candidate }) => ({
        id,
        gtin: candidate.gtin,
        gtinValid: candidate.gtinValid,
        compositeKey: candidate.compositeKey,
      })),
    )
  }

  createMedicine(id: string, candidate: NormalizedMedicineCandidate): Promise<void> {
    this.medicines.push({ id, candidate })
    return Promise.resolve()
  }

  sourceRecordExists(providerCode: string, externalId: string, payloadHash: string): Promise<boolean> {
    return Promise.resolve(
      this.sourceRecords.some(
        (source) => source.candidate.providerCode === providerCode && source.candidate.externalId === externalId && source.payloadHash === payloadHash,
      ),
    )
  }

  createSourceAndLink(input: CreateSourceAndLinkInput): Promise<void> {
    this.sourceRecords.push(input)
    return Promise.resolve()
  }

  createImportError(input: CreateImportErrorInput): Promise<void> {
    this.importErrors.push(input)
    return Promise.resolve()
  }

  snapshot(): string {
    return JSON.stringify({
      medicines: this.medicines,
      sourceRecords: this.sourceRecords,
      importErrors: this.importErrors,
    })
  }

  restore(snapshot: string): void {
    const state = JSON.parse(snapshot) as {
      medicines: { id: string; candidate: NormalizedMedicineCandidate }[]
      sourceRecords: CreateSourceAndLinkInput[]
      importErrors: CreateImportErrorInput[]
    }
    this.medicines = state.medicines
    this.sourceRecords = state.sourceRecords
    this.importErrors = state.importErrors
  }
}

class MemoryTransactionManager implements TransactionManager {
  constructor(private readonly repository: MemoryCatalogRepository) {}

  async run<T>(work: (repository: CatalogWriteRepository) => Promise<T>): Promise<T> {
    const snapshot = this.repository.snapshot()
    try {
      return await work(this.repository)
    } catch (error) {
      this.repository.restore(snapshot)
      throw error
    }
  }
}

class MemoryImportBatchRepository implements ImportBatchRepository {
  readonly batches = new Map<
    string,
    {
      status: 'RUNNING' | 'COMPLETED' | 'FAILED'
      stats: ImportStats | null
      failureMessage: string | null
    }
  >()

  start(batchId: string): Promise<void> {
    this.batches.set(batchId, {
      status: 'RUNNING',
      stats: null,
      failureMessage: null,
    })
    return Promise.resolve()
  }

  complete(batchId: string, stats: ImportStats): Promise<void> {
    this.batches.set(batchId, {
      status: 'COMPLETED',
      stats,
      failureMessage: null,
    })
    return Promise.resolve()
  }

  fail(batchId: string, message: string): Promise<void> {
    this.batches.set(batchId, {
      status: 'FAILED',
      stats: null,
      failureMessage: message,
    })
    return Promise.resolve()
  }
}

const validRecord: RawMedicineRecord = {
  providerCode: 'pharmacy-a',
  externalId: 'valid',
  sourceFile: 'pharmacy_a.json',
  name: 'Nurofen 200 mg Tablets',
  manufacturer: 'Reckitt Benckiser',
  gtin: '05050123456789',
  dosageValue: 200,
  dosageUnit: 'mg',
  packageSize: 24,
  dosageForm: 'tablet',
  prescriptionRequired: false,
  country: 'GB',
  registrationDate: '2023-01-15',
  rawPayload: { id: 'valid' },
}

function createHarness(readers?: SourceReader[]) {
  const repository = new MemoryCatalogRepository()
  const batchRepository = new MemoryImportBatchRepository()
  const sourceRoot = join(process.cwd(), 'pnarmacy')
  let sequence = 0
  const useCase = new ImportCatalogUseCase(
    readers ?? [new PharmacyAReader(sourceRoot), new PharmacyBReader(sourceRoot), new PharmacyCReader(sourceRoot)],
    new MemoryTransactionManager(repository),
    batchRepository,
    () => new Date('2026-07-29T10:00:00.000Z'),
    () => `id-${String((sequence += 1))}`,
  )
  return { useCase, repository, batchRepository }
}

describe('ImportCatalogUseCase', () => {
  it('merges three provider records into one medicine with three sources', async () => {
    const { useCase, repository } = createHarness()

    await expect(useCase.execute()).resolves.toMatchObject({
      status: 'COMPLETED',
      providerRecordsRead: 3,
      medicinesCreated: 1,
      sourceRecordsLinked: 3,
      duplicatesMerged: 2,
      recordErrors: 0,
    })
    expect(repository.medicines).toHaveLength(1)
    expect(repository.sourceRecords).toHaveLength(3)
    expect(repository.sourceRecords.map((source) => source.matchStrategy)).toEqual(['NEW_RECORD', 'INVALID_GTIN_WITH_COMPOSITE', 'INVALID_GTIN_WITH_COMPOSITE'])
  })

  it('does not add medicines or source records on an identical second import', async () => {
    const { useCase, repository } = createHarness()
    await useCase.execute()

    await expect(useCase.execute()).resolves.toMatchObject({
      providerRecordsRead: 3,
      medicinesCreated: 0,
      sourceRecordsLinked: 0,
      duplicatesMerged: 0,
      recordErrors: 0,
    })
    expect(repository.medicines).toHaveLength(1)
    expect(repository.sourceRecords).toHaveLength(3)
  })

  it('persists a malformed record error while importing a valid sibling', async () => {
    const failure: SourceRecordFailure = {
      ok: false,
      providerCode: 'pharmacy-a',
      sourceFile: 'pharmacy_a.json',
      externalId: 'broken',
      rawPayload: { id: 'broken' },
      errorCode: 'INVALID_PROVIDER_RECORD',
      message: 'pharmacy-a record 1 field name must be a string',
    }
    const reader: SourceReader = {
      providerCode: 'pharmacy-a',
      read: () => Promise.resolve([{ ok: true, record: validRecord }, failure]),
    }
    const { useCase, repository } = createHarness([reader])

    await expect(useCase.execute()).resolves.toMatchObject({
      providerRecordsRead: 2,
      medicinesCreated: 1,
      sourceRecordsLinked: 1,
      duplicatesMerged: 0,
      recordErrors: 1,
    })
    expect(repository.importErrors).toEqual([
      expect.objectContaining({
        externalId: 'broken',
        errorCode: 'INVALID_PROVIDER_RECORD',
      }),
    ])
  })

  it('rolls back catalog writes and marks the batch failed after a fatal reader error', async () => {
    const validReader: SourceReader = {
      providerCode: 'pharmacy-a',
      read: () => Promise.resolve([{ ok: true, record: validRecord }]),
    }
    const fatalReader: SourceReader = {
      providerCode: 'pharmacy-b',
      read: () => Promise.reject(new SourceReadError('pharmacy-b', 'SOURCE_READ_FAILED')),
    }
    const { useCase, repository, batchRepository } = createHarness([validReader, fatalReader])

    await expect(useCase.execute()).rejects.toBeInstanceOf(CatalogImportFailedError)
    expect(repository.medicines).toEqual([])
    expect(repository.sourceRecords).toEqual([])
    expect([...batchRepository.batches.values()]).toEqual([
      {
        status: 'FAILED',
        stats: null,
        failureMessage: 'Catalog import failed',
      },
    ])
  })
})
