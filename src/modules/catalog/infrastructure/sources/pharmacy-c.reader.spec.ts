import { join } from 'node:path'
import { PharmacyCReader } from './pharmacy-c.reader'

describe('PharmacyCReader', () => {
  it('maps the nested Pharmacy C JSON representation', async () => {
    const reader = new PharmacyCReader(join(process.cwd(), 'pnarmacy'))

    await expect(reader.read()).resolves.toEqual([
      {
        ok: true,
        record: {
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
          rawPayload: {
            product_uid: 'c_991',
            details: {
              trade_name: 'Nurofen Film-coated Tabs',
              manufacturer: { name: 'Reckitt Benckiser Healthcare' },
              strength: { value: 200, unit: 'mg' },
              identifiers: { gtin: '05050123456789' },
              packaging: { count: 24, type: 'tabs' },
              requires_prescription: 'no',
              country_code: 'UK',
              registered: '2023/01/15',
            },
          },
        },
      },
    ])
  })
})
