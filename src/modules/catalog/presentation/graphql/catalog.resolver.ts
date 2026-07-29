import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetCatalogQuery } from '../../application/get-catalog.query';
import type { ImportBatchResult } from '../../application/import-catalog.types';
import { ImportCatalogUseCase } from '../../application/import-catalog.use-case';
import type {
  ImportBatchView,
  MedicineSourceView,
  MedicineView,
} from '../../application/ports/catalog-read.repository';
import {
  DosageFormModel,
  ImportBatchModel,
  ImportBatchStatusModel,
  MatchStrategyModel,
  MedicineModel,
  MedicineSourceModel,
} from './catalog.models';

function toSourceModel(source: MedicineSourceView): MedicineSourceModel {
  return {
    providerCode: source.providerCode,
    externalId: source.externalId,
    sourceFile: source.sourceFile,
    rawPayloadJson: source.rawPayloadJson,
    normalizedPayloadJson: source.normalizedPayloadJson,
    matchStrategy: source.matchStrategy as MatchStrategyModel,
  };
}

export function toMedicineModel(view: MedicineView): MedicineModel {
  return {
    id: view.id,
    canonicalName: view.canonicalName,
    manufacturer: view.manufacturer,
    gtin: view.gtin,
    gtinValid: view.gtinValid,
    dosage: {
      value: view.dosageMicrograms / 1_000,
      unit: 'mg',
    },
    dosageForm: view.dosageForm as DosageFormModel,
    packageSize: view.packageSize,
    prescriptionRequired: view.prescriptionRequired,
    countryCode: view.countryCode,
    registrationDate: view.registrationDate,
    sources: view.sources.map(toSourceModel),
  };
}

function toImportBatchModel(batch: ImportBatchView | ImportBatchResult): ImportBatchModel {
  return {
    id: batch.id,
    status: batch.status as ImportBatchStatusModel,
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
    providerRecordsRead: batch.providerRecordsRead,
    medicinesCreated: batch.medicinesCreated,
    sourceRecordsLinked: batch.sourceRecordsLinked,
    duplicatesMerged: batch.duplicatesMerged,
    recordErrors: batch.recordErrors,
    failureMessage: 'failureMessage' in batch ? batch.failureMessage : null,
  };
}

@Resolver(() => MedicineModel)
export class CatalogResolver {
  constructor(
    private readonly getCatalog: GetCatalogQuery,
    private readonly importCatalogUseCase: ImportCatalogUseCase,
  ) {}

  @Query(() => [MedicineModel])
  async catalog(): Promise<MedicineModel[]> {
    const medicines = await this.getCatalog.list();
    return medicines.map(toMedicineModel);
  }

  @Query(() => MedicineModel, { nullable: true })
  async medicine(@Args('id', { type: () => ID }) id: string): Promise<MedicineModel | null> {
    const medicine = await this.getCatalog.findById(id);
    return medicine === null ? null : toMedicineModel(medicine);
  }

  @Query(() => [ImportBatchModel])
  async importBatches(): Promise<ImportBatchModel[]> {
    const batches = await this.getCatalog.listImportBatches();
    return batches.map(toImportBatchModel);
  }

  @Mutation(() => ImportBatchModel)
  async importCatalog(): Promise<ImportBatchModel> {
    return toImportBatchModel(await this.importCatalogUseCase.execute());
  }
}
