import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SourceReadError, type SourceReader, type SourceRecordResult } from '../../application/ports/source-reader'
import type { ProviderCode, RawMedicineRecord } from '../../domain/catalog.types'
import { readBoolean, readNullableString, readNumber, readString, recordResult, type UnknownRecord } from './parse-provider-record'

const SOURCE_FILE = 'pharmacy_a.json'

export class PharmacyAReader implements SourceReader {
  readonly providerCode: ProviderCode = 'pharmacy-a'

  constructor(private readonly sourceRoot: string) {}

  async read(): Promise<SourceRecordResult[]> {
    let content: string
    try {
      content = await readFile(join(this.sourceRoot, SOURCE_FILE), 'utf8')
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_READ_FAILED')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content) as unknown
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    if (!Array.isArray(parsed)) {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    return parsed.map((rawPayload, index) =>
      recordResult(this.providerCode, SOURCE_FILE, rawPayload, index, (record, context) => this.mapRecord(record, context, rawPayload), 'id'),
    )
  }

  private mapRecord(record: UnknownRecord, context: string, rawPayload: unknown): RawMedicineRecord {
    return {
      providerCode: this.providerCode,
      externalId: readString(record, 'id', context),
      sourceFile: SOURCE_FILE,
      name: readString(record, 'name', context),
      manufacturer: readString(record, 'manufacturer', context),
      gtin: readNullableString(record, 'gtin', context),
      dosageValue: readNumber(record, 'dosage_mg', context),
      dosageUnit: 'mg',
      packageSize: readNumber(record, 'package_size', context),
      dosageForm: readString(record, 'form', context),
      prescriptionRequired: readBoolean(record, 'prescription_required', context),
      country: readString(record, 'country', context),
      registrationDate: readString(record, 'registration_date', context),
      rawPayload,
    }
  }
}
