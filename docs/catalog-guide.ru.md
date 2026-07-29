# Руководство по каталогу

[English](catalog-guide.md) · [Русский](catalog-guide.ru.md)

В этом руководстве описано, как PharmaFuse Catalog читает тестовые данные
поставщиков, нормализует поля, выбирает дубликаты и публикует итоговый каталог.

## Источники поставщиков

Mutation не принимает путь к файлам от клиента. Она читает три источника,
настроенных в приложении:

| Поставщик | Файл                       | Формат |
| --------- | -------------------------- | ------ |
| A         | `pnarmacy/pharmacy_a.json` | JSON   |
| B         | `pnarmacy/pharmacy_b.xml`  | XML    |
| C         | `pnarmacy/pharmacy_c.json` | JSON   |

Reader каждого поставщика преобразует исходный формат в прикладную запись.
Затем доменный normalizer формирует одинаковую каноническую модель лекарства
для всех поставщиков.

## Импорт fixtures

Запустите приложение через `make dev` или контейнер через
`make docker-verify`, затем выполните:

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

Первый импорт комплектных fixtures возвращает:

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

Количество объединённых дубликатов рассчитывается так:

```text
3 успешно прочитанные записи поставщиков
- 1 созданное каноническое лекарство
= 2 объединённых дубликата
```

Импорт неизменившегося payload идемпотентен. После повторного запуска остаются
одно лекарство и три source records; значения `medicinesCreated`,
`sourceRecordsLinked` и `duplicatesMerged` для нового batch равны нулю.

## Запрос каталога

GraphQL доступен по адресу `http://localhost:3008/graphql`, интерактивная
страница GraphiQL — `http://localhost:3008/graphiql`.

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

Для каждого канонического лекарства сохраняются ссылки на поставщиков,
оригинальный и нормализованный payload, имя исходного файла, внешний
идентификатор и стратегия сопоставления. Благодаря этому результат объединения
можно проверить без потери исходных записей.

## Нормализация и сопоставление

Normalizer приводит к единому виду названия, варианты производителя, единицы
дозировки, лекарственную форму, размер упаковки, код страны, даты, логические
значения и пунктуацию GTIN. В ключе сопоставления дозировка представлена целым
числом микрограммов.

Правила сопоставления детерминированы:

1. Валидный GTIN совпадает с лекарством с таким же валидным GTIN.
2. Одинаковый невалидный GTIN совпадает только при совпадении composite key.
3. Запись без GTIN сопоставляется по composite key.
4. Fuzzy matching не используется.

Composite key:

```text
normalizedName
|normalizedManufacturer
|dosageMicrograms
|dosageForm
|packageSize
|countryCode
```

Для комплектных fixtures:

```text
nurofen|reckitt benckiser|200000|TABLET|24|GB
```

Переданный GTIN `05050123456789` сохраняется с `gtinValid: false`. Его
контрольная цифра равна `9`, а алгоритм из
`src/modules/catalog/domain/gtin.ts`, покрытый тестом, рассчитывает `4`.
Поэтому записи fixtures объединяются только тогда, когда совпадают и
невалидный GTIN, и composite key.

## Хранение

SQLite управляется миграциями TypeORM; синхронизация схемы отключена. Импорт
выполняется в транзакции базы данных и сохраняет:

- канонические лекарства;
- описание поставщиков;
- связанные исходные записи;
- batches импорта и ошибки отдельных записей.

SHA-256-хеш идентифицирует неизменившийся исходный payload и предотвращает
повторную вставку одной записи поставщика. Исходный и нормализованный JSON
хранятся отдельно.

## Архитектура

Каталог реализован как feature module с границами Clean Architecture:

```text
композиция приложения
        |
        v
presentation / GraphQL
        |
        v
application / use cases и ports
        |
        v
domain / нормализация и сопоставление

infrastructure / readers поставщиков и TypeORM
        реализует application ports
```

Правила границ:

- domain не импортирует NestJS, GraphQL, TypeORM или filesystem API;
- application не импортирует infrastructure или presentation;
- ORM decorators находятся в infrastructure;
- infrastructure реализует ports, которыми владеет application.

Исполняемая архитектурная проверка ищет циклические зависимости:

```bash
make cycles
```

Graphify обновляет и анализирует граф зависимостей:

```bash
make graph-update
make graph-query
make graph-god-nodes
make graph-diagnose
```

Текст запроса и бюджет токенов можно переопределить:

```bash
make graph-query GRAPH_QUERY="How does catalog matching work?" GRAPH_BUDGET=12000
```

Проектные решения и план реализации находятся в:

- `docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md`;
- `docs/superpowers/plans/2026-07-29-pharmacy-catalog.md`.

## Проверка

Полный локальный quality gate:

```bash
make verify
```

Он проверяет форматирование, ESLint, типы TypeScript, unit- и integration-тесты,
end-to-end поведение, циклы зависимостей и production-сборку. E2E использует
временную SQLite database и Fastify `inject()`, поэтому не открывает сетевой
порт.

Проверка контейнерного сценария:

```bash
make docker-verify
```

Команда проверяет Compose, собирает и запускает image, дожидается healthcheck и
выполняет GraphQL smoke test.
