import type { ImportBatchResult } from '../../application/import-catalog.types'
import type { CatalogReadRepository, ImportBatchView, MedicineView } from '../../application/ports/catalog-read.repository'
import type { ImportCatalogUseCase } from '../../application/import-catalog.use-case'
import { GetCatalogQuery } from '../../application/get-catalog.query'
import { CatalogResolver } from './catalog.resolver'

const medicine: MedicineView = {
  id: 'medicine-1',
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
  sources: [
    {
      id: 'source-a',
      providerCode: 'pharmacy-a',
      externalId: 'a-100',
      sourceFile: 'pharmacy_a.json',
      rawPayloadJson: '{"id":"a-100"}',
      normalizedPayloadJson: '{"normalizedName":"nurofen"}',
      matchStrategy: 'NEW_RECORD',
    },
    {
      id: 'source-b',
      providerCode: 'pharmacy-b',
      externalId: 'b-777',
      sourceFile: 'pharmacy_b.xml',
      rawPayloadJson: '{"externalId":"b-777"}',
      normalizedPayloadJson: '{"normalizedName":"nurofen"}',
      matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE',
    },
    {
      id: 'source-c',
      providerCode: 'pharmacy-c',
      externalId: 'c_991',
      sourceFile: 'pharmacy_c.json',
      rawPayloadJson: '{"product_uid":"c_991"}',
      normalizedPayloadJson: '{"normalizedName":"nurofen"}',
      matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE',
    },
  ],
}

class ResolverReadRepository implements CatalogReadRepository {
  listMedicines(): Promise<MedicineView[]> {
    return Promise.resolve([medicine])
  }

  findMedicine(): Promise<MedicineView | null> {
    return Promise.resolve(medicine)
  }

  listImportBatches(): Promise<ImportBatchView[]> {
    return Promise.resolve([])
  }
}

class ResolverImportUseCase {
  execute(): Promise<ImportBatchResult> {
    return Promise.resolve({
      id: 'batch-1',
      status: 'COMPLETED',
      startedAt: '2026-07-29T10:00:00.000Z',
      finishedAt: '2026-07-29T10:00:01.000Z',
      providerRecordsRead: 3,
      medicinesCreated: 1,
      sourceRecordsLinked: 3,
      duplicatesMerged: 2,
      recordErrors: 0,
    })
  }
}

describe('CatalogResolver', () => {
  const resolver = new CatalogResolver(new GetCatalogQuery(new ResolverReadRepository()), new ResolverImportUseCase() as ImportCatalogUseCase)

  it('maps internal micrograms and provenance to the public GraphQL model', async () => {
    const result = await resolver.catalog()

    expect(result).toHaveLength(1)
    const first = result[0]
    if (!first) {
      throw new Error('Expected one medicine')
    }
    expect(first).toMatchObject({
      id: 'medicine-1',
      canonicalName: 'Nurofen 200 mg tablets',
      manufacturer: 'Reckitt Benckiser',
      gtin: '05050123456789',
      gtinValid: false,
      dosage: { value: 200, unit: 'mg' },
      dosageForm: 'TABLET',
      packageSize: 24,
      prescriptionRequired: false,
      countryCode: 'GB',
      registrationDate: '2023-01-15',
    })
    expect(
      first.sources.map(({ externalId, matchStrategy }) => ({
        externalId,
        matchStrategy,
      })),
    ).toEqual([
      { externalId: 'a-100', matchStrategy: 'NEW_RECORD' },
      { externalId: 'b-777', matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE' },
      { externalId: 'c_991', matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE' },
    ])
    expect(first).not.toHaveProperty('normalizedName')
    expect(first).not.toHaveProperty('normalizedManufacturer')
  })

  it('exposes import statistics from the application result', async () => {
    await expect(resolver.importCatalog()).resolves.toMatchObject({
      status: 'COMPLETED',
      providerRecordsRead: 3,
      medicinesCreated: 1,
      sourceRecordsLinked: 3,
      duplicatesMerged: 2,
      recordErrors: 0,
    })
  })
})
