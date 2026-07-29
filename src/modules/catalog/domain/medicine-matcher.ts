import type { ExistingMedicineIdentity, MatchDecision, NormalizedMedicineCandidate } from './catalog.types'

type CandidateIdentity = Pick<NormalizedMedicineCandidate, 'gtin' | 'gtinValid' | 'compositeKey'>

export function selectMatch(candidate: CandidateIdentity, existing: readonly ExistingMedicineIdentity[]): MatchDecision {
  if (candidate.gtin !== null && candidate.gtinValid) {
    const validGtinMatch = existing.find((medicine) => medicine.gtinValid && medicine.gtin === candidate.gtin)
    if (validGtinMatch) {
      return { medicineId: validGtinMatch.id, strategy: 'VALID_GTIN' }
    }
  }

  if (candidate.gtin !== null && !candidate.gtinValid) {
    const corroboratedInvalidGtinMatch = existing.find(
      (medicine) => !medicine.gtinValid && medicine.gtin === candidate.gtin && medicine.compositeKey === candidate.compositeKey,
    )
    if (corroboratedInvalidGtinMatch) {
      return {
        medicineId: corroboratedInvalidGtinMatch.id,
        strategy: 'INVALID_GTIN_WITH_COMPOSITE',
      }
    }
  }

  if (candidate.gtin === null) {
    const compositeMatch = existing.find((medicine) => medicine.compositeKey === candidate.compositeKey)
    if (compositeMatch) {
      return { medicineId: compositeMatch.id, strategy: 'COMPOSITE_KEY' }
    }
  }

  return { medicineId: null, strategy: 'NEW_RECORD' }
}
