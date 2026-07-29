import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum DosageFormModel {
  TABLET = 'TABLET',
}

export enum MatchStrategyModel {
  NEW_RECORD = 'NEW_RECORD',
  VALID_GTIN = 'VALID_GTIN',
  INVALID_GTIN_WITH_COMPOSITE = 'INVALID_GTIN_WITH_COMPOSITE',
  COMPOSITE_KEY = 'COMPOSITE_KEY',
}

export enum ImportBatchStatusModel {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(DosageFormModel, { name: 'DosageForm' });
registerEnumType(MatchStrategyModel, { name: 'MatchStrategy' });
registerEnumType(ImportBatchStatusModel, { name: 'ImportBatchStatus' });

@ObjectType('Dosage')
export class DosageModel {
  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;
}

@ObjectType('MedicineSource')
export class MedicineSourceModel {
  @Field()
  providerCode!: string;

  @Field()
  externalId!: string;

  @Field()
  sourceFile!: string;

  @Field()
  rawPayloadJson!: string;

  @Field()
  normalizedPayloadJson!: string;

  @Field(() => MatchStrategyModel)
  matchStrategy!: MatchStrategyModel;
}

@ObjectType('Medicine')
export class MedicineModel {
  @Field(() => ID)
  id!: string;

  @Field()
  canonicalName!: string;

  @Field()
  manufacturer!: string;

  @Field(() => String, { nullable: true })
  gtin!: string | null;

  @Field()
  gtinValid!: boolean;

  @Field(() => DosageModel)
  dosage!: DosageModel;

  @Field(() => DosageFormModel)
  dosageForm!: DosageFormModel;

  @Field(() => Int)
  packageSize!: number;

  @Field()
  prescriptionRequired!: boolean;

  @Field()
  countryCode!: string;

  @Field()
  registrationDate!: string;

  @Field(() => [MedicineSourceModel])
  sources!: MedicineSourceModel[];
}

@ObjectType('ImportBatch')
export class ImportBatchModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ImportBatchStatusModel)
  status!: ImportBatchStatusModel;

  @Field()
  startedAt!: string;

  @Field(() => String, { nullable: true })
  finishedAt!: string | null;

  @Field(() => Int)
  providerRecordsRead!: number;

  @Field(() => Int)
  medicinesCreated!: number;

  @Field(() => Int)
  sourceRecordsLinked!: number;

  @Field(() => Int)
  duplicatesMerged!: number;

  @Field(() => Int)
  recordErrors!: number;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;
}
