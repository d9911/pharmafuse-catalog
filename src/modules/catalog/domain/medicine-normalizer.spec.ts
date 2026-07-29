import type { RawMedicineRecord } from './catalog.types';
import { normalizeMedicine } from './medicine-normalizer';

const rawRecords = [
  {
    providerCode: 'pharmacy-a',
    externalId: 'a-100',
    sourceFile: 'pharmacy_a.json',
    name: 'Nurofen 200 mg Tablets',
    manufacturer: 'Reckitt Benckiser',
    gtin: '05050123456789',
    dosageValue: 200,
    dosageUnit: 'mg',
    packageSize: 24,
    dosageForm: 'tablet',
    prescriptionRequired: false,
    country: 'GB',
    registrationDate: '2023-01-15',
    rawPayload: { id: 'a-100' },
  },
  {
    providerCode: 'pharmacy-b',
    externalId: 'b-777',
    sourceFile: 'pharmacy_b.xml',
    name: 'Nurofen Tablets 200mg',
    manufacturer: 'Reckitt Benckiser Ltd.',
    gtin: '0505-0123-4567-89',
    dosageValue: 200,
    dosageUnit: 'mg',
    packageSize: 24,
    dosageForm: 'tablets',
    prescriptionRequired: 'false',
    country: 'United Kingdom',
    registrationDate: '15.01.2023',
    rawPayload: { externalId: 'b-777' },
  },
  {
    providerCode: 'pharmacy-c',
    externalId: 'c_991',
    sourceFile: 'pharmacy_c.json',
    name: 'Nurofen Film-coated Tabs',
    manufacturer: 'Reckitt Benckiser Healthcare',
    gtin: '05050123456789',
    dosageValue: 200,
    dosageUnit: 'mg',
    packageSize: 24,
    dosageForm: 'tabs',
    prescriptionRequired: 'no',
    country: 'UK',
    registrationDate: '2023/01/15',
    rawPayload: { product_uid: 'c_991' },
  },
] as const satisfies readonly RawMedicineRecord[];

describe('normalizeMedicine', () => {
  it('produces one deterministic identity for all three provider variants', () => {
    const candidates = rawRecords.map(normalizeMedicine);

    expect(candidates.map((item) => item.normalizedName)).toEqual([
      'nurofen',
      'nurofen',
      'nurofen',
    ]);
    expect(candidates.map((item) => item.normalizedManufacturer)).toEqual([
      'reckitt benckiser',
      'reckitt benckiser',
      'reckitt benckiser',
    ]);
    expect(candidates.map((item) => item.compositeKey)).toEqual([
      'nurofen|reckitt benckiser|200000|TABLET|24|GB',
      'nurofen|reckitt benckiser|200000|TABLET|24|GB',
      'nurofen|reckitt benckiser|200000|TABLET|24|GB',
    ]);
  });

  it('normalizes presentation fields without hiding the invalid GTIN', () => {
    const candidate = normalizeMedicine(rawRecords[1]);

    expect(candidate).toMatchObject({
      canonicalName: 'Nurofen 200 mg tablets',
      manufacturer: 'Reckitt Benckiser',
      gtin: '05050123456789',
      gtinValid: false,
      dosageMicrograms: 200_000,
      dosageForm: 'TABLET',
      packageSize: 24,
      prescriptionRequired: false,
      countryCode: 'GB',
      registrationDate: '2023-01-15',
    });
  });

  it.each([
    ['dosageUnit', { dosageUnit: 'ml' }, 'UNSUPPORTED_DOSAGE_UNIT:ml'],
    ['dosageForm', { dosageForm: 'capsule' }, 'UNSUPPORTED_DOSAGE_FORM:capsule'],
    ['country', { country: 'US' }, 'UNSUPPORTED_COUNTRY:US'],
    [
      'prescriptionRequired',
      { prescriptionRequired: 'sometimes' },
      'INVALID_PRESCRIPTION_VALUE:sometimes',
    ],
    ['registrationDate', { registrationDate: '31.02.2023' }, 'INVALID_DATE:31.02.2023'],
  ])('rejects unsupported %s instead of applying a default', (_field, patch, message) => {
    expect(() => normalizeMedicine({ ...rawRecords[0], ...patch })).toThrow(message);
  });
});
