import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PharmacyAReader } from './pharmacy-a.reader';

describe('PharmacyAReader', () => {
  it('maps the Pharmacy A JSON array without coercing its identity', async () => {
    const reader = new PharmacyAReader(join(process.cwd(), 'pnarmacy'));

    await expect(reader.read()).resolves.toEqual([
      {
        ok: true,
        record: {
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
          rawPayload: {
            id: 'a-100',
            name: 'Nurofen 200 mg Tablets',
            manufacturer: 'Reckitt Benckiser',
            gtin: '05050123456789',
            dosage_mg: 200,
            package_size: 24,
            form: 'tablet',
            prescription_required: false,
            country: 'GB',
            registration_date: '2023-01-15',
          },
        },
      },
    ]);
  });

  it('returns a record failure while keeping valid records readable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pharmacy-a-reader-'));
    await writeFile(
      join(root, 'pharmacy_a.json'),
      JSON.stringify([
        {
          id: 'valid',
          name: 'Medicine 10 mg Tablets',
          manufacturer: 'Maker',
          gtin: null,
          dosage_mg: 10,
          package_size: 1,
          form: 'tablet',
          prescription_required: false,
          country: 'GB',
          registration_date: '2023-01-15',
        },
        { id: 'broken' },
      ]),
    );

    try {
      const results = await new PharmacyAReader(root).read();
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ ok: true });
      expect(results[1]).toEqual({
        ok: false,
        providerCode: 'pharmacy-a',
        sourceFile: 'pharmacy_a.json',
        externalId: 'broken',
        rawPayload: { id: 'broken' },
        errorCode: 'INVALID_PROVIDER_RECORD',
        message: 'pharmacy-a record 1 field name must be a string',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
