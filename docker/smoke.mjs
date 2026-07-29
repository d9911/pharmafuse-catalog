const endpoint = process.env.GRAPHQL_URL ?? 'http://127.0.0.1:3000/graphql';

async function execute(query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GraphQL returned errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

const importData = await execute(`
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
`);

const catalogData = await execute(`
  query Catalog {
    catalog {
      canonicalName
      sources {
        providerCode
        externalId
      }
    }
  }
`);

const importResult = importData.importCatalog;
if (
  importResult.status !== 'COMPLETED' ||
  importResult.providerRecordsRead !== 3 ||
  importResult.recordErrors !== 0
) {
  throw new Error(`Unexpected import result: ${JSON.stringify(importResult)}`);
}

if (catalogData.catalog.length !== 1 || catalogData.catalog[0].sources.length !== 3) {
  throw new Error(`Unexpected catalog result: ${JSON.stringify(catalogData.catalog)}`);
}

console.log(
  JSON.stringify(
    {
      import: importResult,
      catalog: {
        medicines: catalogData.catalog.length,
        sources: catalogData.catalog[0].sources.length,
      },
    },
    null,
    2,
  ),
);
