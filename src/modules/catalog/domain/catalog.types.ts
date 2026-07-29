export type ProviderCode = 'pharmacy-a' | 'pharmacy-b' | 'pharmacy-c'

export type DosageForm = 'TABLET'

export type MatchStrategy = 'NEW_RECORD' | 'VALID_GTIN' | 'INVALID_GTIN_WITH_COMPOSITE' | 'COMPOSITE_KEY'

export interface RawMedicineRecord {
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  name: string
  manufacturer: string
  gtin: string | null
  dosageValue: number
  dosageUnit: string
  packageSize: number
  dosageForm: string
  prescriptionRequired: boolean | string
  country: string
  registrationDate: string
  rawPayload: unknown
}

export interface NormalizedMedicineCandidate {
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  canonicalName: string
  normalizedName: string
  manufacturer: string
  normalizedManufacturer: string
  gtin: string | null
  gtinValid: boolean
  dosageMicrograms: number
  dosageForm: DosageForm
  packageSize: number
  prescriptionRequired: boolean
  countryCode: 'GB'
  registrationDate: string
  compositeKey: string
  rawPayloadJson: string
  normalizedPayloadJson: string
}

export interface ExistingMedicineIdentity {
  id: string
  gtin: string | null
  gtinValid: boolean
  compositeKey: string
}

export interface MatchDecision {
  medicineId: string | null
  strategy: MatchStrategy
}
