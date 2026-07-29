import type { SourceRecordFailure, SourceRecordResult, SourceRecordSuccess } from '../../application/ports/source-reader'
import type { ProviderCode, RawMedicineRecord } from '../../domain/catalog.types'

export type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown, context: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value as UnknownRecord
}

export function readString(record: UnknownRecord, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string') {
    throw new Error(`${context} field ${field} must be a string`)
  }
  return value
}

export function readNullableString(record: UnknownRecord, field: string, context: string): string | null {
  const value = record[field]
  if (value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${context} field ${field} must be a string or null`)
  }
  return value
}

export function readNumber(record: UnknownRecord, field: string, context: string): number {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} field ${field} must be a number`)
  }
  return value
}

export function readBoolean(record: UnknownRecord, field: string, context: string): boolean {
  const value = record[field]
  if (typeof value !== 'boolean') {
    throw new Error(`${context} field ${field} must be a boolean`)
  }
  return value
}

export function recordResult(
  providerCode: ProviderCode,
  sourceFile: string,
  rawPayload: unknown,
  index: number,
  mapper: (record: UnknownRecord, context: string) => RawMedicineRecord,
  externalIdField: string,
): SourceRecordResult {
  const context = `${providerCode} record ${String(index)}`

  try {
    const record = asRecord(rawPayload, context)
    const success: SourceRecordSuccess = {
      ok: true,
      record: mapper(record, context),
    }
    return success
  } catch (error) {
    const externalId =
      typeof (rawPayload as UnknownRecord | null)?.[externalIdField] === 'string' ? ((rawPayload as UnknownRecord)[externalIdField] as string) : null
    const failure: SourceRecordFailure = {
      ok: false,
      providerCode,
      sourceFile,
      externalId,
      rawPayload,
      errorCode: 'INVALID_PROVIDER_RECORD',
      message: error instanceof Error ? error.message : `${context} is invalid`,
    }
    return failure
  }
}
