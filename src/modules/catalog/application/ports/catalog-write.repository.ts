import type {
  ExistingMedicineIdentity,
  MatchStrategy,
  NormalizedMedicineCandidate,
  ProviderCode,
} from '../../domain/catalog.types';

export const CATALOG_WRITE_REPOSITORY = Symbol('CATALOG_WRITE_REPOSITORY');

export interface CreateSourceAndLinkInput {
  sourceRecordId: string;
  medicineId: string;
  importBatchId: string;
  candidate: NormalizedMedicineCandidate;
  payloadHash: string;
  matchStrategy: MatchStrategy;
  now: string;
}

export interface CreateImportErrorInput {
  id: string;
  importBatchId: string;
  providerCode: ProviderCode;
  externalId: string | null;
  sourceFile: string;
  errorCode: string;
  message: string;
  rawPayloadJson: string | null;
  now: string;
}

export interface CatalogWriteRepository {
  findIdentityCandidates(
    candidate: NormalizedMedicineCandidate,
  ): Promise<ExistingMedicineIdentity[]>;
  createMedicine(id: string, candidate: NormalizedMedicineCandidate, now: string): Promise<void>;
  sourceRecordExists(
    providerCode: ProviderCode,
    externalId: string,
    payloadHash: string,
  ): Promise<boolean>;
  createSourceAndLink(input: CreateSourceAndLinkInput): Promise<void>;
  createImportError(input: CreateImportErrorInput): Promise<void>;
}
