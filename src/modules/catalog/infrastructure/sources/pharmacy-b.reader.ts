import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { SourceReadError, type SourceReader, type SourceRecordResult } from '../../application/ports/source-reader'
import type { ProviderCode, RawMedicineRecord } from '../../domain/catalog.types'
import { asRecord, readString, recordResult, type UnknownRecord } from './parse-provider-record'

const SOURCE_FILE = 'pharmacy_b.xml'

export class PharmacyBReader implements SourceReader {
  readonly providerCode: ProviderCode = 'pharmacy-b'

  constructor(private readonly sourceRoot: string) {}

  async read(): Promise<SourceRecordResult[]> {
    let content: string
    try {
      content = await readFile(join(this.sourceRoot, SOURCE_FILE), 'utf8')
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_READ_FAILED')
    }

    if (XMLValidator.validate(content) !== true) {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: true,
    })

    let parsed: unknown
    try {
      parsed = parser.parse(content) as unknown
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    let medicines: unknown
    try {
      medicines = asRecord(asRecord(parsed, 'pharmacy-b document').medicines, 'pharmacy-b medicines').medicine
    } catch {
      throw new SourceReadError(this.providerCode, 'SOURCE_PARSE_FAILED')
    }

    const records = Array.isArray(medicines) ? medicines : [medicines]
    return records.map((rawPayload, index) =>
      recordResult(this.providerCode, SOURCE_FILE, rawPayload, index, (record, context) => this.mapRecord(record, context, rawPayload), 'externalId'),
    )
  }

  private mapRecord(record: UnknownRecord, context: string, rawPayload: unknown): RawMedicineRecord {
    const dosage = readString(record, 'dosage', context)
    const dosageMatch = /^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/.exec(dosage)
    const dosageValue = dosageMatch?.[1]
    const dosageUnit = dosageMatch?.[2]
    if (dosageValue === undefined || dosageUnit === undefined) {
      throw new Error(`${context} field dosage has an invalid format`)
    }

    const pack = readString(record, 'pack', context)
    const packMatch = /^(\d+)\s+(.+)$/.exec(pack)
    const packageSize = packMatch?.[1]
    if (packageSize === undefined) {
      throw new Error(`${context} field pack has an invalid format`)
    }

    return {
      providerCode: this.providerCode,
      externalId: readString(record, 'externalId', context),
      sourceFile: SOURCE_FILE,
      name: readString(record, 'title', context),
      manufacturer: readString(record, 'producer', context),
      gtin: readString(record, 'barcode', context),
      dosageValue: Number(dosageValue),
      dosageUnit,
      packageSize: Number(packageSize),
      dosageForm: readString(record, 'dosageForm', context),
      prescriptionRequired: readString(record, 'rx', context),
      country: readString(record, 'origin', context),
      registrationDate: readString(record, 'registeredAt', context),
      rawPayload,
    }
  }
}
