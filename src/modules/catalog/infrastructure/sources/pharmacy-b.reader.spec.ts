import { join } from 'node:path';
import { PharmacyBReader } from './pharmacy-b.reader';

describe('PharmacyBReader', () => {
  it('maps XML values without losing GTIN separators or string booleans', async () => {
    const reader = new PharmacyBReader(join(process.cwd(), 'pnarmacy'));

    await expect(reader.read()).resolves.toEqual([
      {
        ok: true,
        record: {
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
          rawPayload: {
            externalId: 'b-777',
            title: 'Nurofen Tablets 200mg',
            producer: 'Reckitt Benckiser Ltd.',
            barcode: '0505-0123-4567-89',
            dosage: '200 mg',
            pack: '24 tablets',
            dosageForm: 'tablets',
            rx: 'false',
            origin: 'United Kingdom',
            registeredAt: '15.01.2023',
          },
        },
      },
    ]);
  });
});
