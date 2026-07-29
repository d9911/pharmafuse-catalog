# PharmaFuse Catalog

[English](README.md) · [Русский](README.ru.md)

[![CI](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml)
[![CodeQL](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Docker ready](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
[![GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

A NestJS and GraphQL service that turns heterogeneous pharmacy supplier data
into one normalized, deduplicated, and traceable medicine catalog.

## What it does

- reads JSON and XML records from three provider-specific adapters;
- normalizes names, manufacturers, dosages, forms, packages, countries, dates,
  booleans, and GTINs;
- merges duplicates through deterministic GTIN and composite-key rules;
- retains raw and normalized payloads with complete source provenance;
- persists the catalog in SQLite through explicit TypeORM migrations;
- exposes import statistics and the resulting catalog through GraphQL;
- verifies normalization, idempotency, persistence, and API behavior with
  automated tests.

## Architecture

The catalog is a feature module built around Clean Architecture boundaries. The
domain owns normalization and matching rules; application use cases own ports;
GraphQL and TypeORM remain adapters.

```text
GraphQL presentation -> application use cases -> domain
                              ^
                              |
          provider readers + TypeORM adapters
```

The domain has no NestJS, GraphQL, TypeORM, or filesystem dependency. Madge
checks circular imports, while Graphify provides an inspectable dependency
graph. See the [catalog guide](docs/catalog-guide.md) for the matching rules and
module details.

## Requirements

The bootstrap command supports macOS and Ubuntu:

```bash
make i
```

It installs missing host tools, NVM `0.40.4`, Node.js `24.11.0`, npm `11.16.0`,
Docker with Compose, and ShellCheck. It then creates `.env` without overwriting
an existing file and installs exact lockfile dependencies. System installation
may request administrator permission.

## Quick start

Initialize the environment once, then start local development:

```bash
make i
make s
```

`make s` frees port `3008`, removes generated builds, synchronizes dependencies,
applies SQLite migrations, runs every quality gate, starts NestJS in watch mode,
imports fixture data when needed, and opens GraphiQL.

- GraphQL: <http://localhost:3008/graphql>
- GraphiQL: <http://localhost:3008/graphiql>

Press `Ctrl+C` to stop local development.

## Docker start

Run the complete Docker lifecycle with:

```bash
make s-doc
```

It frees port `3008`, verifies the project, rebuilds the image without the old
build cache, starts the non-root container, waits for `healthy`, initializes the
catalog, and opens GraphiQL. The healthy container remains running.

- container status: `make docker-ps`
- logs: `make docker-logs`
- stop while retaining SQLite data: `make docker-down`

Useful options:

```bash
make port-free
make s OPEN_BROWSER=0
make s-doc OPEN_BROWSER=0
make s-doc APP_PORT=3100
make help
```

Build cleanup never removes `.env`, `node_modules`, the local SQLite database,
or the named Docker volume. Migrations and catalog import are idempotent, so
existing data is preserved.

## GraphQL preview

Import the configured provider fixtures:

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

For the bundled fixtures, the first import reads three provider records, creates
one canonical medicine, links three source records, and reports two merged
duplicates. Repeating the unchanged import creates no additional records.

Query the traceable catalog:

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
    sources {
      providerCode
      externalId
      sourceFile
      matchStrategy
    }
  }
}
```

The [catalog guide](docs/catalog-guide.md) contains the complete response,
normalization rules, GTIN calculation, composite key, and provenance model.

## Quality and security

```bash
make verify
make audit-prod
make docker-config
```

`make verify` runs formatting checks, ESLint, TypeScript validation, unit and
integration tests, end-to-end tests, cycle detection, and a production build.
GitHub Actions runs the same Make targets, builds the Docker image, and audits
production dependencies. CodeQL analyzes JavaScript and TypeScript, while
Dependabot monitors npm, Docker, and Actions dependencies.

Security tooling reduces risk; it does not make the software invulnerable.
Please report suspected vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## Lean by design

PharmaFuse uses a single service, an embedded SQLite database, deterministic
matching, idempotent imports, and a multi-stage container image. This keeps the
runtime and operational footprint small without making unverifiable
environmental-impact claims.

## Documentation

- [Catalog, normalization, and verification guide](docs/catalog-guide.md)
- [Security policy](SECURITY.md)
- [Architecture design](docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md)
- [Implementation plan](docs/superpowers/plans/2026-07-29-pharmacy-catalog.md)

## Author

[Denis Gutsuliak](https://t.me/d9911/) ·
[admin@d9911.org](mailto:admin@d9911.org)

## License

[GPL-3.0-or-later](LICENSE)
