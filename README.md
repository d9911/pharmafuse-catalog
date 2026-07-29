# PharmaFuse

PharmaFuse — backend-сервис на NestJS/TypeScript, который читает три локальных
аптечных источника, нормализует записи, объединяет дубликаты и сохраняет каталог
вместе с происхождением каждого значения.

## Stack

- Node.js 24 и npm 11;
- NestJS 11;
- GraphQL Code First;
- Fastify + Mercurius;
- TypeORM + SQLite (`better-sqlite3`);
- Jest;
- ESLint, Madge и Graphify для архитектурных проверок.

Mercurius выбран после фактической проверки dependency tree: найденный
`@nestjs/apollo@13.4.2` одновременно требовал Apollo Server 5 и устанавливал
deprecated playground plugin с peer dependency Apollo Server 4. Mercurius
устраняет этот конфликт и поддерживается официальным NestJS GraphQL driver.

## Установка и запуск

```bash
make setup
make dev
```

Все рабочие сценарии проекта запускаются через `make`. `make setup` создаёт
`.env` из `.env.example`, только если файла ещё нет, устанавливает зависимости
и применяет миграции. Полный список доступных целей:

```bash
make help
```

После запуска:

- GraphQL endpoint: `http://localhost:3000/graphql`;
- GraphiQL: `http://localhost:3000/graphiql`.

SQLite создаётся через migration. В TypeORM установлено
`synchronize: false`.

## Импорт

Mutation не принимает путь от клиента. Она читает только настроенные fixtures:

- `pnarmacy/pharmacy_a.json`;
- `pnarmacy/pharmacy_b.xml`;
- `pnarmacy/pharmacy_c.json`.

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

Ожидаемый результат первого импорта:

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

Расчёт:

```text
3 provider records
- 1 canonical medicine
= 2 merged duplicates
```

Повторный импорт тех же payload оставляет одно лекарство и три source records.
Счётчики `medicinesCreated`, `sourceRecordsLinked` и `duplicatesMerged` во
втором batch равны нулю.

## Каталог

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

Предоставленный GTIN `05050123456789` сохраняется с `gtinValid: false`:
переданная контрольная цифра равна `9`, а рассчитанная GS1-контрольная цифра
равна `4`. Поэтому такой GTIN объединяет записи только при одновременном
совпадении composite key.

Composite key:

```text
normalizedName
|normalizedManufacturer
|dosageMicrograms
|dosageForm
|packageSize
|countryCode
```

Для fixtures:

```text
nurofen|reckitt benckiser|200000|TABLET|24|GB
```

## Архитектура

```text
app composition
    ↓
presentation / GraphQL
    ↓
application / use cases and ports
    ↓
domain / normalization and matching

infrastructure / files and TypeORM
    └── implements application ports
```

Ограничения:

- domain не импортирует NestJS, GraphQL, TypeORM или filesystem;
- application не импортирует infrastructure или presentation;
- ORM decorators находятся только в infrastructure;
- fuzzy matching не используется;
- исходный и нормализованный JSON каждой записи сохраняются отдельно;
- одинаковый payload определяется SHA-256 и не записывается повторно.

Подробности:

- `docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md`;
- `docs/superpowers/plans/2026-07-29-pharmacy-catalog.md`.

## Проверка

```bash
make test
make test-e2e
make typecheck
make lint
make cycles
make build
```

Полный набор:

```bash
make verify
```

E2E использует временную SQLite database и Fastify `inject()`, поэтому не
открывает сетевой порт.

Graphify после изменения исходников:

```bash
make graph-update
make graph-query
make graph-god-nodes
make graph-diagnose
```

Текст и бюджет архитектурного запроса можно переопределить:

```bash
make graph-query GRAPH_QUERY="How does catalog matching work?" GRAPH_BUDGET=12000
```
