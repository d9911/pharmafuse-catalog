import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SourceReadError, type SourceReader, type SourceRecordResult } from '../../application/ports/source-reader'
import type { ProviderCode, RawMedicineRecord } from '../../domain/catalog.types'
import { asRecord, readNumber, readString, recordResult, type UnknownRecord } from './parse-provider-record'

const SOURCE_FILE = 'pharmacy_c.json'

export class PharmacyCReader implements SourceReader {
  readonly providerCode: ProviderCode = 'pharmacy-c'

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

    let items: unknown
    try {
      items = asRecord(parsed, 'pharmacy-c document').items
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }
    if (!Array.isArray(items)) {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    return items.map((rawPayload, index) =>
      recordResult(this.providerCode, SOURCE_FILE, rawPayload, index, (record, context) => this.mapRecord(record, context, rawPayload), 'product_uid'),
    )
  }

  private mapRecord(record: UnknownRecord, context: string, rawPayload: unknown): RawMedicineRecord {
    const details = asRecord(record.details, `${context} details`)
    const manufacturer = asRecord(details.manufacturer, `${context} manufacturer`)
    const strength = asRecord(details.strength, `${context} strength`)
    const identifiers = asRecord(details.identifiers, `${context} identifiers`)
    const packaging = asRecord(details.packaging, `${context} packaging`)

    return {
      providerCode: this.providerCode,
      externalId: readString(record, 'product_uid', context),
      sourceFile: SOURCE_FILE,
      name: readString(details, 'trade_name', context),
      manufacturer: readString(manufacturer, 'name', context),
      gtin: readString(identifiers, 'gtin', context),
      dosageValue: readNumber(strength, 'value', context),
      dosageUnit: readString(strength, 'unit', context),
      packageSize: readNumber(packaging, 'count', context),
      dosageForm: readString(packaging, 'type', context),
      prescriptionRequired: readString(details, 'requires_prescription', context),
      country: readString(details, 'country_code', context),
      registrationDate: readString(details, 'registered', context),
      rawPayload,
    }
  }
}
