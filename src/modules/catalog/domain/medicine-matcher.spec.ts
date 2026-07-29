import type {
  ExistingMedicineIdentity,
  NormalizedMedicineCandidate,
} from './catalog.types';
import { selectMatch } from './medicine-matcher';

type CandidateIdentity = Pick<
  NormalizedMedicineCandidate,
  'gtin' | 'gtinValid' | 'compositeKey'
>;

describe('selectMatch', () => {
  it.each<{
    candidate: CandidateIdentity;
    existing: ExistingMedicineIdentity[];
    expected: { medicineId: string | null; strategy: string };
  }>([
    {
      candidate: { gtin: '4006381333931', gtinValid: true, compositeKey: 'candidate' },
      existing: [
        { id: 'm1', gtin: '4006381333931', gtinValid: true, compositeKey: 'different' },
      ],
      expected: { medicineId: 'm1', strategy: 'VALID_GTIN' },
    },
    {
      candidate: { gtin: '05050123456789', gtinValid: false, compositeKey: 'same' },
      existing: [
        { id: 'm2', gtin: '05050123456789', gtinValid: false, compositeKey: 'same' },
      ],
      expected: { medicineId: 'm2', strategy: 'INVALID_GTIN_WITH_COMPOSITE' },
    },
    {
      candidate: { gtin: null, gtinValid: false, compositeKey: 'same' },
      existing: [{ id: 'm3', gtin: null, gtinValid: false, compositeKey: 'same' }],
      expected: { medicineId: 'm3', strategy: 'COMPOSITE_KEY' },
    },
    {
      candidate: { gtin: null, gtinValid: false, compositeKey: 'new' },
      existing: [],
      expected: { medicineId: null, strategy: 'NEW_RECORD' },
    },
  ])('selects $expected.strategy', ({ candidate, existing, expected }) => {
    expect(selectMatch(candidate, existing)).toEqual(expected);
  });

  it('does not merge two different invalid GTIN values by composite key alone', () => {
    expect(
      selectMatch(
        { gtin: '11111111', gtinValid: false, compositeKey: 'same' },
        [{ id: 'm1', gtin: '22222222', gtinValid: false, compositeKey: 'same' }],
      ),
    ).toEqual({ medicineId: null, strategy: 'NEW_RECORD' });
  });
});
