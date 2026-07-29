import type { DosageForm, MatchStrategy, ProviderCode } from '../../domain/catalog.types';

export const CATALOG_READ_REPOSITORY = Symbol('CATALOG_READ_REPOSITORY');

export interface MedicineSourceView {
  id: string;
  providerCode: ProviderCode;
  externalId: string;
  sourceFile: string;
  rawPayloadJson: string;
  normalizedPayloadJson: string;
  matchStrategy: MatchStrategy;
}

export interface MedicineView {
  id: string;
  canonicalName: string;
  normalizedName: string;
  manufacturer: string;
  normalizedManufacturer: string;
  gtin: string | null;
  gtinValid: boolean;
  dosageMicrograms: number;
  dosageForm: DosageForm;
  packageSize: number;
  prescriptionRequired: boolean;
  countryCode: string;
  registrationDate: string;
  sources: MedicineSourceView[];
}

export type ImportBatchStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ImportBatchView {
  id: string;
  status: ImportBatchStatus;
  startedAt: string;
  finishedAt: string | null;
  providerRecordsRead: number;
  medicinesCreated: number;
  sourceRecordsLinked: number;
  duplicatesMerged: number;
  recordErrors: number;
  failureMessage: string | null;
}

export interface CatalogReadRepository {
  listMedicines(): Promise<MedicineView[]>;
  findMedicine(id: string): Promise<MedicineView | null>;
  listImportBatches(): Promise<ImportBatchView[]>;
}
