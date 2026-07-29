# PharmaFuse Service Design

**Дата:** 2026-07-29  
**Статус:** согласованный baseline для implementation plan  
**Область:** только backend, GraphQL API, SQLite, NestJS, TypeScript

## 1. Цель

Сервис должен:

1. прочитать три локальных источника:
   - `pnarmacy/pharmacy_a.json`;
   - `pnarmacy/pharmacy_b.xml`;
   - `pnarmacy/pharmacy_c.json`;
2. преобразовать записи поставщиков в единую доменную модель;
3. детерминированно объединить дубликаты;
4. сохранить исходные и нормализованные представления каждой записи;
5. отдать каталог и происхождение данных через GraphQL в JSON-ответе;
6. предоставить автоматические тесты и отчёт импорта, по которым можно проверить нормализацию и объединение.

В проект не входят frontend, авторизация, загрузка пользовательских файлов, фоновые очереди, fuzzy matching, ручная модерация совпадений и внешняя СУБД.

## 2. Проверенные исходные данные

| Источник   | Формат                   | Внешний ID | Название                   | GTIN до нормализации |
| ---------- | ------------------------ | ---------: | -------------------------- | -------------------- |
| Pharmacy A | JSON-массив              |    `a-100` | `Nurofen 200 mg Tablets`   | `05050123456789`     |
| Pharmacy B | XML                      |    `b-777` | `Nurofen Tablets 200mg`    | `0505-0123-4567-89`  |
| Pharmacy C | JSON с `items[].details` |    `c_991` | `Nurofen Film-coated Tabs` | `05050123456789`     |

После удаления символов, отличных от цифр, все три значения GTIN равны
`05050123456789`.

Контрольная цифра примера не проходит алгоритм GS1:

```text
Тело GTIN:                    0505012345678
Взвешенная сумма справа:      86
Расчётная контрольная цифра:  (10 - (86 mod 10)) mod 10 = 4
Переданная контрольная цифра: 9
```

Поэтому сервис не должен отбрасывать идентификатор из тестовых данных. Он
сохраняет нормализованное значение, отмечает `gtinValid = false` и не считает
невалидный GTIN достаточным самостоятельным доказательством совпадения.

## 3. Выбранный архитектурный подход

Используется **Clean Architecture + DDD-lite в одном bounded context
`catalog`**.

Это не буквальный frontend FSD. Из Feature-Sliced Design используются правила
владения и направленности зависимостей:

```text
app composition
    ↓
presentation (GraphQL)
    ↓
application (use cases and ports)
    ↓
domain (entities, value objects, policies)

infrastructure ──implements──> application/domain ports
```

Правила:

- `domain` не импортирует NestJS, TypeORM, GraphQL или файловую систему;
- `application` управляет сценарием и зависит только от домена и портов;
- `infrastructure` содержит TypeORM, SQLite, чтение файлов, JSON/XML-адаптеры;
- `presentation` преобразует GraphQL DTO в application-запросы и обратно;
- `app.module.ts` является composition root;
- бизнес-термины не помещаются в `shared`;
- создаются только реально используемые каталоги и публичные API.

## 4. Feature-владельцы

### `import-catalog`

Владеет сценарием импорта:

- выбором настроенных источников;
- чтением JSON/XML;
- преобразованием provider DTO в `RawMedicineRecord`;
- нормализацией;
- поиском существующего лекарства;
- сохранением исходной записи, связи с лекарством и результата импорта;
- идемпотентностью повторного импорта.

### `get-catalog`

Владеет чтением:

- списка лекарств;
- конкретного лекарства;
- источников, связанных с лекарством;
- истории импортов.

### `catalog` domain

Владеет существительными и правилами:

- `Medicine`;
- `SourceReference`;
- `NormalizedMedicineCandidate`;
- `Dosage`;
- `Gtin`;
- `MedicineNormalizer`;
- `MedicineMatcher`;
- `MatchStrategy`.

## 5. Доменная модель

```ts
type ProviderCode = 'pharmacy-a' | 'pharmacy-b' | 'pharmacy-c'

type MatchStrategy = 'NEW_RECORD' | 'VALID_GTIN' | 'INVALID_GTIN_WITH_COMPOSITE' | 'COMPOSITE_KEY'

interface Dosage {
  micrograms: number
}

interface NormalizedMedicineCandidate {
  externalId: string
  providerCode: ProviderCode
  sourceFile: string
  name: string
  normalizedName: string
  manufacturer: string
  normalizedManufacturer: string
  gtin: string | null
  gtinValid: boolean
  dosage: Dosage
  dosageForm: 'TABLET'
  packageSize: number
  prescriptionRequired: boolean
  countryCode: 'GB'
  registrationDate: string
  compositeKey: string
}

interface SourceReference {
  id: string
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  rawPayloadJson: string
  normalizedPayloadJson: string
  payloadHash: string
  matchStrategy: MatchStrategy
}

interface Medicine {
  id: string
  canonicalName: string
  normalizedName: string
  manufacturer: string
  normalizedManufacturer: string
  gtin: string | null
  gtinValid: boolean
  dosageMicrograms: number
  dosageForm: 'TABLET'
  packageSize: number
  prescriptionRequired: boolean
  countryCode: 'GB'
  registrationDate: string
  compositeKey: string
  sources: SourceReference[]
}
```

Текущий набор данных содержит только таблетки и массу в миллиграммах.
Расширяемые enum и конвертеры добавляются только тогда, когда появится
подтверждённый входной пример другой формы или единицы.

## 6. Правила нормализации

Все функции являются чистыми и покрываются unit-тестами.

### 6.1. GTIN

1. Удалить все символы, кроме ASCII-цифр.
2. Сохранить ведущие нули.
3. Длина должна быть 8, 12, 13 или 14 цифр.
4. Проверить контрольную цифру GS1.
5. Сохранить значение даже при неверной контрольной цифре.
6. Выставить отдельный признак `gtinValid`.

### 6.2. Название

1. Unicode NFKC.
2. Привести к нижнему регистру.
3. Заменить дефисы и повторяющиеся пробелы одним пробелом.
4. Удалить дозировку (`200 mg`, `200mg`) из ключа названия.
5. Нормализовать `tabs`, `tablets`, `film-coated tabs` в форму `TABLET`.
6. Для текущих данных получить `normalizedName = "nurofen"`.
7. Публичное canonical name формировать детерминированно:
   `Nurofen 200 mg tablets`.

### 6.3. Производитель

1. Unicode NFKC и lowercase.
2. Удалить пунктуацию.
3. Удалить подтверждённые суффиксы/дескрипторы:
   `ltd`, `limited`, `healthcare`.
4. Схлопнуть пробелы.
5. Для текущих данных получить
   `normalizedManufacturer = "reckitt benckiser"`.
6. Публичное значение выбрать из первого источника по стабильному приоритету
   `pharmacy-a`, `pharmacy-b`, `pharmacy-c`; все исходные значения остаются в
   source records.

### 6.4. Дозировка

1. `dosage_mg: 200`, `dosage: "200 mg"` и `{ value: 200, unit: "mg" }`
   разобрать в одну модель.
2. Массу хранить целым числом микрограммов:
   `200 mg × 1000 = 200000 µg`.
3. Не использовать SQLite `REAL` для канонической дозировки.

### 6.5. Упаковка

Из `24`, `24 tablets` и `{ count: 24 }` получить `packageSize = 24`.

### 6.6. Рецептурность

`false`, `"false"` и `"no"` привести к boolean `false`. Неизвестное значение
является ошибкой записи, а не `false` по умолчанию.

### 6.7. Страна

`GB`, `UK`, `United Kingdom` привести к ISO alpha-2 `GB`.

### 6.8. Дата

`2023-01-15`, `15.01.2023` и `2023/01/15` привести к календарной строке
`2023-01-15`. Невалидные календарные даты отклоняются.

### 6.9. Composite key

```text
normalizedName
|normalizedManufacturer
|dosageMicrograms
|dosageForm
|packageSize
|countryCode
```

Для примера:

```text
nurofen|reckitt benckiser|200000|TABLET|24|GB
```

## 7. Правила объединения

Порядок проверки фиксирован:

1. Если GTIN валиден и существует лекарство с таким валидным GTIN:
   `VALID_GTIN`.
2. Если GTIN невалиден, его значение совпадает и composite key совпадает:
   `INVALID_GTIN_WITH_COMPOSITE`.
3. Если GTIN отсутствует и composite key совпадает:
   `COMPOSITE_KEY`.
4. Иначе создать новое лекарство:
   `NEW_RECORD`.

Автоматического fuzzy matching нет. Это исключает недетерминированное
объединение похожих, но разных лекарств.

Для предоставленных файлов ожидается:

```json
{
  "providerRecordsRead": 3,
  "medicinesCreated": 1,
  "sourceRecordsLinked": 3,
  "duplicatesMerged": 2,
  "recordErrors": 0
}
```

Расчёт:

- прочитано `1 + 1 + 1 = 3` записи;
- первая создаёт лекарство;
- ещё две присоединяются к нему, поэтому `3 - 1 = 2` объединённых дубликата;
- у итогового лекарства три source references.

## 8. Идемпотентность и аудит

Для каждого provider record рассчитывается:

```text
payloadHash = SHA-256(providerCode + "\n" + externalId + "\n" + canonicalRawJson)
```

Ограничение `UNIQUE(provider_id, external_id, payload_hash)` означает:

- повторный импорт того же payload не создаёт новую source record;
- изменённый payload того же external ID сохраняется как новая версия;
- каждый import batch всё равно содержит статистику запуска;
- исходный payload никогда не заменяется нормализованным.

Строка batch со статусом `RUNNING` создаётся до основной транзакции. Все
изменения каталога, source records, links и record errors выполняются в одной
SQLite-транзакции. После commit batch отдельной короткой операцией получает
`COMPLETED`; при необработанной ошибке файла основная транзакция откатывается,
а batch отдельной операцией получает `FAILED`. Поэтому аудит не теряется
вместе с откатом. Ошибка отдельной записи сохраняется в `import_errors`,
увеличивает `recordErrors`, но не останавливает корректные записи остальных
поставщиков.

## 9. Схема SQLite

```sql
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_file TEXT NOT NULL
);

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  provider_records_read INTEGER NOT NULL DEFAULT 0,
  medicines_created INTEGER NOT NULL DEFAULT 0,
  source_records_linked INTEGER NOT NULL DEFAULT 0,
  duplicates_merged INTEGER NOT NULL DEFAULT 0,
  record_errors INTEGER NOT NULL DEFAULT 0,
  failure_message TEXT
);

CREATE TABLE medicines (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  normalized_manufacturer TEXT NOT NULL,
  gtin TEXT,
  gtin_valid INTEGER NOT NULL CHECK (gtin_valid IN (0, 1)),
  dosage_micrograms INTEGER NOT NULL CHECK (dosage_micrograms > 0),
  dosage_form TEXT NOT NULL CHECK (dosage_form IN ('TABLET')),
  package_size INTEGER NOT NULL CHECK (package_size > 0),
  prescription_required INTEGER NOT NULL
    CHECK (prescription_required IN (0, 1)),
  country_code TEXT NOT NULL,
  registration_date TEXT NOT NULL,
  composite_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_medicines_valid_gtin
  ON medicines(gtin)
  WHERE gtin IS NOT NULL AND gtin_valid = 1;

CREATE INDEX ix_medicines_composite_key
  ON medicines(composite_key);

CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  external_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  raw_payload_json TEXT NOT NULL,
  normalized_payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  UNIQUE(provider_id, external_id, payload_hash)
);

CREATE TABLE medicine_sources (
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  source_record_id TEXT NOT NULL UNIQUE REFERENCES source_records(id),
  match_strategy TEXT NOT NULL CHECK (
    match_strategy IN (
      'NEW_RECORD',
      'VALID_GTIN',
      'INVALID_GTIN_WITH_COMPOSITE',
      'COMPOSITE_KEY'
    )
  ),
  linked_at TEXT NOT NULL,
  PRIMARY KEY(medicine_id, source_record_id)
);

CREATE TABLE import_errors (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  provider_code TEXT NOT NULL,
  external_id TEXT,
  source_file TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL
);
```

TypeORM `synchronize` всегда `false`. Схема создаётся миграцией.

## 10. GraphQL contract

Code First схема предоставляет:

```graphql
type Query {
  catalog: [Medicine!]!
  medicine(id: ID!): Medicine
  importBatches: [ImportBatch!]!
}

type Mutation {
  importCatalog: ImportBatch!
}

type Medicine {
  id: ID!
  canonicalName: String!
  manufacturer: String!
  gtin: String
  gtinValid: Boolean!
  dosage: Dosage!
  dosageForm: DosageForm!
  packageSize: Int!
  prescriptionRequired: Boolean!
  countryCode: String!
  registrationDate: String!
  sources: [MedicineSource!]!
}

type Dosage {
  value: Float!
  unit: String!
}

type MedicineSource {
  providerCode: String!
  externalId: String!
  sourceFile: String!
  rawPayloadJson: String!
  normalizedPayloadJson: String!
  matchStrategy: MatchStrategy!
}
```

`Dosage.value` вычисляется как
`dosageMicrograms / 1000`; для примера `200000 / 1000 = 200`.

Mutation не принимает произвольный путь. Она импортирует только три пути из
проверенной конфигурации приложения, что не даёт GraphQL-клиенту читать
произвольные файлы.

GraphQL поверх HTTP уже возвращает JSON, поэтому отдельный REST endpoint для
«вывода JSON» не нужен.

## 11. Обработка ошибок

| Ситуация                                    | Поведение                                                          |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Файл отсутствует или не читается            | batch `FAILED`, транзакция откатывается                            |
| JSON/XML синтаксически некорректен          | batch `FAILED`, транзакция откатывается                            |
| Одна запись не соответствует provider-схеме | `import_errors`, остальные записи продолжаются                     |
| Неизвестная единица/форма/страна            | `import_errors`, без неявного default                              |
| Повторный неизменённый payload              | source record пропускается идемпотентно                            |
| Невалидный GTIN                             | сохраняется с `gtinValid=false`, требуется composite corroboration |
| GraphQL ID не найден                        | `medicine` возвращает `null`                                       |

В GraphQL не возвращаются stack traces и абсолютные пути файлов.

## 12. Проверка корректности

### Unit

- адаптер каждого поставщика преобразует ровно его fixture;
- GTIN сохраняет ведущий ноль и вычисляет `gtinValid=false`;
- три формата даты дают `2023-01-15`;
- три формы упаковки дают `24`;
- три значения страны дают `GB`;
- три записи дают одинаковый composite key;
- matcher выбирает каждую из четырёх стратегий.

### Integration

- миграция поднимается на временной SQLite БД;
- импорт создаёт 1 medicine, 3 source records, 3 links и completed batch;
- повторный импорт не увеличивает число medicines/source records;
- изменение payload создаёт новую source record;
- откат работает при фатальной ошибке файла.

### GraphQL e2e

- `importCatalog` возвращает статистику `3/1/3/2/0`;
- `catalog` возвращает одно лекарство с тремя источниками;
- HTTP response имеет JSON content type;
- introspection/schema snapshot содержит только запланированный contract.

### Architecture

- ESLint запрещает domain/application импортировать infrastructure,
  presentation и app;
- `madge --circular src` не находит циклических зависимостей;
- TypeScript strict mode;
- `make graph-update` после появления исходников;
- `make graph-query` используется для проверки направленности модулей.

## 13. Нефункциональные ограничения

- Node.js `24.x`; локально проверен `v24.18.0`.
- npm `11.x`; локально проверен `11.16.0`.
- TypeScript `5.9.3` with `strict: true`; эта версия удовлетворяет
  peer ranges `madge@8.0.0`, `ts-jest@29.4.12` и
  `typescript-eslint@8.65.0`.
- SQLite foreign keys включены.
- Временные метки — ISO 8601 UTC.
- Идентификаторы — `crypto.randomUUID()` из Node.js.
- Секреты и внешняя сеть для выполнения задания не требуются.
- Никаких remote Git mutations.

## 14. Источники

- Локальные fixtures:
  `pnarmacy/pharmacy_a.json`,
  `pnarmacy/pharmacy_b.xml`,
  `pnarmacy/pharmacy_c.json`.
- NestJS GraphQL:
  https://docs.nestjs.com/graphql/quick-start
- NestJS TypeORM:
  https://docs.nestjs.com/techniques/database
- NestJS validation:
  https://docs.nestjs.com/techniques/validation
- Актуальные версии и peer dependencies получены 2026-07-29 из:
  https://registry.npmjs.org/
