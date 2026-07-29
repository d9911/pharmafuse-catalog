import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const importMutation = `
  mutation ImportCatalog {
    importCatalog {
      status
      providerRecordsRead
      medicinesCreated
      sourceRecordsLinked
      duplicatesMerged
      recordErrors
    }
  }
`;

const catalogQuery = `
  query Catalog {
    catalog {
      canonicalName
      manufacturer
      gtin
      gtinValid
      dosage { value unit }
      dosageForm
      packageSize
      prescriptionRequired
      countryCode
      registrationDate
      sources {
        providerCode
        externalId
        sourceFile
        matchStrategy
      }
    }
  }
`;

describe('PharmaFuse GraphQL API', () => {
  let app: NestFastifyApplication | null = null;
  let tempRoot: string;

  function runningApp(): NestFastifyApplication {
    if (app === null) {
      throw new Error('Test application is not initialized');
    }
    return app;
  }

  beforeAll(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'pharmacy-catalog-e2e-'));
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_PATH = join(tempRoot, 'catalog.sqlite');
    process.env.SOURCE_ROOT = join(process.cwd(), 'pnarmacy');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await runningApp().init();
    await runningApp().getHttpAdapter().getInstance().ready();
    await runningApp().get(DataSource).runMigrations();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('imports three sources and returns one normalized medicine', async () => {
    const importResponse = await runningApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: importMutation },
    });

    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.headers['content-type']).toMatch(/^application\/json/);
    const importBody: unknown = JSON.parse(importResponse.body);
    expect(importBody).toEqual({
      data: {
        importCatalog: {
          status: 'COMPLETED',
          providerRecordsRead: 3,
          medicinesCreated: 1,
          sourceRecordsLinked: 3,
          duplicatesMerged: 2,
          recordErrors: 0,
        },
      },
    });

    const catalogResponse = await runningApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: catalogQuery },
    });

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.headers['content-type']).toMatch(/^application\/json/);
    const catalogBody: unknown = JSON.parse(catalogResponse.body);
    expect(catalogBody).toEqual({
      data: {
        catalog: [
          {
            canonicalName: 'Nurofen 200 mg tablets',
            manufacturer: 'Reckitt Benckiser',
            gtin: '05050123456789',
            gtinValid: false,
            dosage: { value: 200, unit: 'mg' },
            dosageForm: 'TABLET',
            packageSize: 24,
            prescriptionRequired: false,
            countryCode: 'GB',
            registrationDate: '2023-01-15',
            sources: [
              {
                providerCode: 'pharmacy-a',
                externalId: 'a-100',
                sourceFile: 'pharmacy_a.json',
                matchStrategy: 'NEW_RECORD',
              },
              {
                providerCode: 'pharmacy-b',
                externalId: 'b-777',
                sourceFile: 'pharmacy_b.xml',
                matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE',
              },
              {
                providerCode: 'pharmacy-c',
                externalId: 'c_991',
                sourceFile: 'pharmacy_c.json',
                matchStrategy: 'INVALID_GTIN_WITH_COMPOSITE',
              },
            ],
          },
        ],
      },
    });
  });

  it('keeps the catalog unchanged on an identical second import', async () => {
    const response = await runningApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: importMutation },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    const body: unknown = JSON.parse(response.body);
    expect(body).toEqual({
      data: {
        importCatalog: {
          status: 'COMPLETED',
          providerRecordsRead: 3,
          medicinesCreated: 0,
          sourceRecordsLinked: 0,
          duplicatesMerged: 0,
          recordErrors: 0,
        },
      },
    });

    const catalogResponse = await runningApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: catalogQuery },
    });
    expect(catalogResponse.statusCode).toBe(200);
    const catalogBody = JSON.parse(catalogResponse.body) as {
      data: { catalog: { sources: unknown[] }[] };
    };
    expect(catalogBody.data.catalog).toHaveLength(1);
    expect(catalogBody.data.catalog[0]?.sources).toHaveLength(3);
  });
});
