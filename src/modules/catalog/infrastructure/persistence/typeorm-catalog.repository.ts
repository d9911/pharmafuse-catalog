import type { EntityManager, FindOptionsWhere } from 'typeorm'
import type { CatalogReadRepository, ImportBatchView, MedicineSourceView, MedicineView } from '../../application/ports/catalog-read.repository'
import type { CatalogWriteRepository, CreateImportErrorInput, CreateSourceAndLinkInput } from '../../application/ports/catalog-write.repository'
import type { ExistingMedicineIdentity, MatchStrategy, NormalizedMedicineCandidate, ProviderCode } from '../../domain/catalog.types'
import { ImportBatchOrmEntity, ImportErrorOrmEntity, MedicineOrmEntity, MedicineSourceOrmEntity, ProviderOrmEntity, SourceRecordOrmEntity } from './entities'

interface SourceProjectionRow {
  id: string
  medicineId: string
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  rawPayloadJson: string
  normalizedPayloadJson: string
  matchStrategy: MatchStrategy
}

export class TypeOrmCatalogRepository implements CatalogWriteRepository, CatalogReadRepository {
  constructor(private readonly manager: EntityManager) {}

  async findIdentityCandidates(candidate: NormalizedMedicineCandidate): Promise<ExistingMedicineIdentity[]> {
    let where: FindOptionsWhere<MedicineOrmEntity>

    if (candidate.gtin !== null && candidate.gtinValid) {
      where = { gtin: candidate.gtin, gtinValid: true }
    } else if (candidate.gtin !== null) {
      where = {
        gtin: candidate.gtin,
        gtinValid: false,
        compositeKey: candidate.compositeKey,
      }
    } else {
      where = { compositeKey: candidate.compositeKey }
    }

    const matches = await this.manager.getRepository(MedicineOrmEntity).find({
      where,
      order: { createdAt: 'ASC', id: 'ASC' },
    })
    return matches.map(({ id, gtin, gtinValid, compositeKey }) => ({
      id,
      gtin,
      gtinValid,
      compositeKey,
    }))
  }

  async createMedicine(id: string, candidate: NormalizedMedicineCandidate, now: string): Promise<void> {
    await this.manager.getRepository(MedicineOrmEntity).insert({
      id,
      canonicalName: candidate.canonicalName,
      normalizedName: candidate.normalizedName,
      manufacturer: candidate.manufacturer,
      normalizedManufacturer: candidate.normalizedManufacturer,
      gtin: candidate.gtin,
      gtinValid: candidate.gtinValid,
      dosageMicrograms: candidate.dosageMicrograms,
      dosageForm: candidate.dosageForm,
      packageSize: candidate.packageSize,
      prescriptionRequired: candidate.prescriptionRequired,
      countryCode: candidate.countryCode,
      registrationDate: candidate.registrationDate,
      compositeKey: candidate.compositeKey,
      createdAt: now,
      updatedAt: now,
    })
  }

  async sourceRecordExists(providerCode: ProviderCode, externalId: string, payloadHash: string): Promise<boolean> {
    const provider = await this.findProvider(providerCode)
    return (
      (await this.manager.getRepository(SourceRecordOrmEntity).count({
        where: { providerId: provider.id, externalId, payloadHash },
      })) > 0
    )
  }

  async createSourceAndLink(input: CreateSourceAndLinkInput): Promise<void> {
    const provider = await this.findProvider(input.candidate.providerCode)
    await this.manager.getRepository(SourceRecordOrmEntity).insert({
      id: input.sourceRecordId,
      providerId: provider.id,
      importBatchId: input.importBatchId,
      externalId: input.candidate.externalId,
      sourceFile: input.candidate.sourceFile,
      rawPayloadJson: input.candidate.rawPayloadJson,
      normalizedPayloadJson: input.candidate.normalizedPayloadJson,
      payloadHash: input.payloadHash,
      importedAt: input.now,
    })
    await this.manager.getRepository(MedicineSourceOrmEntity).insert({
      medicineId: input.medicineId,
      sourceRecordId: input.sourceRecordId,
      matchStrategy: input.matchStrategy,
      linkedAt: input.now,
    })
  }

  async createImportError(input: CreateImportErrorInput): Promise<void> {
    await this.manager.getRepository(ImportErrorOrmEntity).insert({
      id: input.id,
      importBatchId: input.importBatchId,
      providerCode: input.providerCode,
      externalId: input.externalId,
      sourceFile: input.sourceFile,
      errorCode: input.errorCode,
      message: input.message,
      rawPayloadJson: input.rawPayloadJson,
      createdAt: input.now,
    })
  }

  async listMedicines(): Promise<MedicineView[]> {
    const medicines = await this.manager.getRepository(MedicineOrmEntity).find({
      order: { createdAt: 'ASC', id: 'ASC' },
    })
    const sourceRowsValue: unknown = await this.manager.query(`
      SELECT
        sr.id AS id,
        ms.medicine_id AS medicineId,
        p.code AS providerCode,
        sr.external_id AS externalId,
        sr.source_file AS sourceFile,
        sr.raw_payload_json AS rawPayloadJson,
        sr.normalized_payload_json AS normalizedPayloadJson,
        ms.match_strategy AS matchStrategy
      FROM medicine_sources ms
      JOIN source_records sr ON sr.id = ms.source_record_id
      JOIN providers p ON p.id = sr.provider_id
      ORDER BY ms.linked_at ASC, sr.id ASC
    `)
    const sourceRows = sourceRowsValue as SourceProjectionRow[]

    return medicines.map((medicine) =>
      this.toMedicineView(
        medicine,
        sourceRows
          .filter((source) => source.medicineId === medicine.id)
          .map((source): MedicineSourceView => ({
            id: source.id,
            providerCode: source.providerCode,
            externalId: source.externalId,
            sourceFile: source.sourceFile,
            rawPayloadJson: source.rawPayloadJson,
            normalizedPayloadJson: source.normalizedPayloadJson,
            matchStrategy: source.matchStrategy,
          })),
      ),
    )
  }

  async findMedicine(id: string): Promise<MedicineView | null> {
    const medicines = await this.listMedicines()
    return medicines.find((medicine) => medicine.id === id) ?? null
  }

  async listImportBatches(): Promise<ImportBatchView[]> {
    const batches = await this.manager.getRepository(ImportBatchOrmEntity).find({
      order: { startedAt: 'DESC', id: 'ASC' },
    })
    return batches.map((batch): ImportBatchView => ({
      id: batch.id,
      status: batch.status,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
      providerRecordsRead: batch.providerRecordsRead,
      medicinesCreated: batch.medicinesCreated,
      sourceRecordsLinked: batch.sourceRecordsLinked,
      duplicatesMerged: batch.duplicatesMerged,
      recordErrors: batch.recordErrors,
      failureMessage: batch.failureMessage,
    }))
  }

  private async findProvider(providerCode: ProviderCode): Promise<ProviderOrmEntity> {
    const provider = await this.manager.getRepository(ProviderOrmEntity).findOneBy({ code: providerCode })
    if (!provider) {
      throw new Error(`PROVIDER_NOT_CONFIGURED:${providerCode}`)
    }
    return provider
  }

  private toMedicineView(medicine: MedicineOrmEntity, sources: MedicineSourceView[]): MedicineView {
    return {
      id: medicine.id,
      canonicalName: medicine.canonicalName,
      normalizedName: medicine.normalizedName,
      manufacturer: medicine.manufacturer,
      normalizedManufacturer: medicine.normalizedManufacturer,
      gtin: medicine.gtin,
      gtinValid: medicine.gtinValid,
      dosageMicrograms: medicine.dosageMicrograms,
      dosageForm: medicine.dosageForm,
      packageSize: medicine.packageSize,
      prescriptionRequired: medicine.prescriptionRequired,
      countryCode: medicine.countryCode,
      registrationDate: medicine.registrationDate,
      sources,
    }
  }
}
