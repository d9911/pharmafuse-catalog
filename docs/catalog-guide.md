# Catalog guide

[English](catalog-guide.md) · [Русский](catalog-guide.ru.md)

This guide describes how PharmaFuse Catalog imports provider fixtures,
normalizes their fields, chooses duplicates, and exposes the resulting catalog.

## Provider inputs

The import mutation does not accept a client-supplied filesystem path. It reads
the three fixtures configured in the application:

| Provider | File                       | Format |
| -------- | -------------------------- | ------ |
| A        | `pnarmacy/pharmacy_a.json` | JSON   |
| B        | `pnarmacy/pharmacy_b.xml`  | XML    |
| C        | `pnarmacy/pharmacy_c.json` | JSON   |

Each provider reader maps its source shape to an application-level provider
record. The domain normalizer then produces the same canonical medicine shape
for all providers.

## Importing the fixtures

Run the application with `make dev` or start its container with
`make docker-verify`. Then execute:

```graphql
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
```

For the bundled fixtures, the first import returns:

```json
{
  "data": {
    "importCatalog": {
      "status": "COMPLETED",
      "providerRecordsRead": 3,
      "medicinesCreated": 1,
      "sourceRecordsLinked": 3,
      "duplicatesMerged": 2,
      "recordErrors": 0
    }
  }
}
```

The duplicate count is derived as follows:

```text
3 successfully read provider records
- 1 newly created canonical medicine
= 2 merged duplicates
```

The import is idempotent for an unchanged payload. A second import retains one
medicine and three source records; `medicinesCreated`,
`sourceRecordsLinked`, and `duplicatesMerged` are all zero for that batch.

## Querying the catalog

GraphQL is available at `http://localhost:3008/graphql`; the interactive
GraphiQL page is available at `http://localhost:3008/graphiql`.

```graphql
query Catalog {
  catalog {
    canonicalName
    manufacturer
    gtin
    gtinValid
    dosage {
      value
      unit
    }
    dosageForm
    packageSize
    prescriptionRequired
    countryCode
    registrationDate
    sources {
      providerCode
      externalId
      sourceFile
      rawPayloadJson
      normalizedPayloadJson
      matchStrategy
    }
  }
}
```

Every canonical medicine retains its provider links, original payload,
normalized payload, source filename, external identifier, and match strategy.
This provenance makes a merge inspectable instead of discarding the supplier
records.

## Normalization and matching

The normalizer standardizes names, manufacturer aliases, dosage units, dosage
forms, package sizes, country codes, dates, booleans, and GTIN punctuation.
Dosage participates in matching as an integer number of micrograms.

Matching is deterministic:

1. A valid GTIN matches an existing medicine with the same valid GTIN.
2. The same invalid GTIN matches only when the composite key also matches.
3. A record without a GTIN matches by composite key.
4. Fuzzy matching is not used.

The composite key is:

```text
normalizedName
|normalizedManufacturer
|dosageMicrograms
|dosageForm
|packageSize
|countryCode
```

For the bundled fixtures it is:

```text
nurofen|reckitt benckiser|200000|TABLET|24|GB
```

The supplied GTIN `05050123456789` is retained with `gtinValid: false`. Its
provided check digit is `9`; applying the check-digit calculation implemented
and tested in `src/modules/catalog/domain/gtin.ts` produces `4`. Consequently,
the fixture records merge only when both the invalid GTIN and composite key
corroborate the match.

## Persistence

SQLite is managed through TypeORM migrations; schema synchronization is
disabled. The import runs in a database transaction and records:

- canonical medicines;
- provider definitions;
- linked source records;
- import batches and record-level errors.

An SHA-256 hash identifies an unchanged source payload, preventing the same
provider record from being inserted again. Raw and normalized JSON are stored
separately.

## Architecture

The catalog is a feature module with Clean Architecture boundaries:

```text
application composition
        |
        v
presentation / GraphQL
        |
        v
application / use cases and ports
        |
        v
domain / normalization and matching

infrastructure / provider readers and TypeORM
        implements application ports
```

Boundary rules:

- the domain does not import NestJS, GraphQL, TypeORM, or filesystem APIs;
- the application layer does not import infrastructure or presentation;
- ORM decorators remain in infrastructure;
- infrastructure implements ports owned by the application layer.

The executable architecture guard checks circular dependencies:

```bash
make cycles
```

Graphify can update and inspect the dependency graph:

```bash
make graph-update
make graph-query
make graph-god-nodes
make graph-diagnose
```

The query and token budget can be overridden:

```bash
make graph-query GRAPH_QUERY="How does catalog matching work?" GRAPH_BUDGET=12000
```

The design and implementation records are available in:

- `docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md`;
- `docs/superpowers/plans/2026-07-29-pharmacy-catalog.md`.

## Verification

Use the complete local quality gate:

```bash
make verify
```

It checks formatting, linting, TypeScript types, unit and integration tests,
end-to-end behavior, dependency cycles, and the production build. The end-to-end
suite uses a temporary SQLite database and Fastify `inject()`, so it does not
open a network port.

For the container path:

```bash
make docker-verify
```

This validates Compose, builds and starts the image, waits for the health check,
and executes a GraphQL smoke test.
