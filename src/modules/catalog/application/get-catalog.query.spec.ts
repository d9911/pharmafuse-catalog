import { GetCatalogQuery } from './get-catalog.query';
import type {
  CatalogReadRepository,
  ImportBatchView,
  MedicineView,
} from './ports/catalog-read.repository';

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
  sources: [],
};

const batch: ImportBatchView = {
  id: 'batch-1',
  status: 'COMPLETED',
  startedAt: '2026-07-29T10:00:00.000Z',
  finishedAt: '2026-07-29T10:00:01.000Z',
  providerRecordsRead: 3,
  medicinesCreated: 1,
  sourceRecordsLinked: 3,
  duplicatesMerged: 2,
  recordErrors: 0,
  failureMessage: null,
};

class StaticCatalogReadRepository implements CatalogReadRepository {
  listMedicines(): Promise<MedicineView[]> {
    return Promise.resolve([medicine]);
  }

  findMedicine(id: string): Promise<MedicineView | null> {
    return Promise.resolve(id === medicine.id ? medicine : null);
  }

  listImportBatches(): Promise<ImportBatchView[]> {
    return Promise.resolve([batch]);
  }
}

describe('GetCatalogQuery', () => {
  const query = new GetCatalogQuery(new StaticCatalogReadRepository());

  it('returns the catalog read model', async () => {
    await expect(query.list()).resolves.toEqual([medicine]);
  });

  it('returns null for an unknown medicine ID', async () => {
    await expect(query.findById('missing')).resolves.toBeNull();
  });

  it('returns import batch history', async () => {
    await expect(query.listImportBatches()).resolves.toEqual([batch]);
  });
});
