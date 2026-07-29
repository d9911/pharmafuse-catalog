import type { ProviderCode, RawMedicineRecord } from '../../domain/catalog.types';

export const SOURCE_READERS = Symbol('SOURCE_READERS');

export interface SourceRecordSuccess {
  ok: true;
  record: RawMedicineRecord;
}

export interface SourceRecordFailure {
  ok: false;
  providerCode: ProviderCode;
  sourceFile: string;
  externalId: string | null;
  rawPayload: unknown;
  errorCode: 'INVALID_PROVIDER_RECORD';
  message: string;
}

export type SourceRecordResult = SourceRecordSuccess | SourceRecordFailure;

export interface SourceReader {
  readonly providerCode: ProviderCode;
  read(): Promise<SourceRecordResult[]>;
}

export class SourceReadError extends Error {
  constructor(
    readonly providerCode: ProviderCode,
    readonly code: 'SOURCE_READ_FAILED' | 'SOURCE_PARSE_FAILED',
  ) {
    super(`${code}:${providerCode}`);
    this.name = 'SourceReadError';
  }
}
