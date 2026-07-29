# PharmaFuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить NestJS/GraphQL-сервис, который импортирует три
предоставленных аптечных источника, нормализует их, детерминированно объединяет
дубликаты в SQLite и сохраняет полную трассировку происхождения данных.

**Architecture:** Один DDD-lite bounded context `catalog` с вертикальными
сценариями `import-catalog` и `get-catalog`. Domain и application не зависят от
NestJS, GraphQL, TypeORM и файловой системы; infrastructure реализует порты, а
presentation и `AppModule` только связывают внешние интерфейсы с use cases.

**Tech Stack:** Node.js 24, npm 11, NestJS 11, TypeScript 5.9, GraphQL Code First,
Mercurius 16, Fastify 5, TypeORM 1, better-sqlite3 12, fast-xml-parser 5,
Jest 30, Fastify `inject()`, ESLint 10, Madge 8, Graphify.

## Command Policy

Все рабочие и проверочные сценарии запускаются через `make`. npm scripts в
`package.json` остаются внутренней реализацией целей Makefile и не являются
публичным интерфейсом команд проекта.

## Global Constraints

- Backend only; frontend не создаётся.
- API transport — GraphQL over HTTP; GraphiQL включён только вне production.
- SQLite schema создаётся миграцией; `synchronize: false`.
- TypeScript `strict: true`.
- Domain не импортирует NestJS, TypeORM, GraphQL или Node filesystem.
- Fuzzy matching и автоматическое объединение по похожести строк запрещены.
- Невалидный GTIN сохраняется, но требует совпадения composite key.
- Повторный импорт одинакового payload идемпотентен.
- Абсолютные пути и stack traces не возвращаются через GraphQL.
- Не выполнять remote Git mutations.
- Текущий каталог не является Git-репозиторием: `git status` вернул
  `not a git repository`, поэтому commit-шаги появятся только после отдельного
  решения пользователя об инициализации Git.

## Проверенный dependency baseline

Версии проверены 2026-07-29 через `https://registry.npmjs.org/<package>/latest`
и peer dependency metadata.

### Runtime dependencies

| Package                    |   Version | Назначение                                      |
| -------------------------- | --------: | ----------------------------------------------- |
| `@nestjs/common`           | `11.1.28` | NestJS primitives                               |
| `@nestjs/core`             | `11.1.28` | NestJS runtime                                  |
| `@nestjs/platform-fastify` | `11.1.28` | Fastify HTTP adapter                            |
| `@nestjs/graphql`          |  `13.4.2` | GraphQL Code First                              |
| `@nestjs/mercurius`        |  `13.4.2` | Mercurius driver                                |
| `@nestjs/typeorm`          |  `11.0.3` | Nest/TypeORM integration                        |
| `@nestjs/config`           |   `4.0.4` | typed application configuration                 |
| `graphql`                  | `16.14.2` | совместимая ветка по peer range `^16.11.0`      |
| `fastify`                  |  `5.10.0` | HTTP runtime                                    |
| `mercurius`                | `16.10.0` | GraphQL runtime and GraphiQL                    |
| `typeorm`                  |   `1.1.0` | persistence adapter and migrations              |
| `better-sqlite3`           | `12.11.1` | SQLite driver, совместимый с TypeORM peer range |
| `fast-xml-parser`          |  `5.10.1` | Pharmacy B XML parser                           |
| `class-validator`          |  `0.15.1` | GraphQL argument validation                     |
| `class-transformer`        |   `0.5.1` | Nest validation support                         |
| `reflect-metadata`         |   `0.2.2` | decorator metadata                              |
| `rxjs`                     |   `7.8.2` | NestJS runtime dependency                       |

### Development dependencies

| Package                  |   Version | Назначение                                                            |
| ------------------------ | --------: | --------------------------------------------------------------------- |
| `@nestjs/cli`            | `11.0.24` | build/start CLI                                                       |
| `@nestjs/testing`        | `11.1.28` | Nest test module                                                      |
| `@types/better-sqlite3`  |  `7.6.13` | SQLite typings                                                        |
| `@types/jest`            |  `30.0.0` | Jest typings                                                          |
| `@types/node`            | `24.13.3` | Node 24 typings                                                       |
| `@eslint/js`             |  `10.0.1` | ESLint base config                                                    |
| `eslint`                 |  `10.8.0` | linting and import boundaries                                         |
| `eslint-config-prettier` |  `10.1.8` | disables conflicting rules                                            |
| `jest`                   |  `30.4.2` | test runner                                                           |
| `madge`                  |   `8.0.0` | circular dependency check                                             |
| `prettier`               |   `3.9.6` | formatting                                                            |
| `ts-jest`                | `29.4.12` | Jest TypeScript transform                                             |
| `ts-node`                |  `10.9.2` | TypeORM migration runner                                              |
| `tsconfig-paths`         |   `4.2.0` | path alias resolution                                                 |
| `typescript`             |   `5.9.3` | удовлетворяет `madge ^5.4.4`, `ts-jest <7` и `typescript-eslint <6.1` |
| `typescript-eslint`      |  `8.65.0` | TypeScript ESLint parser/config                                       |

Не устанавливать `graphql@17.0.2`: `@nestjs/graphql@13.4.2` требует GraphQL
`^16.11.0`. Не устанавливать `typescript@7.0.2`: `ts-jest@29.4.12` требует
TypeScript `<7`, `typescript-eslint@8.65.0` требует `<6.1.0`, а
`madge@8.0.0` требует `^5.4.4`.

## Target file structure

```text
.
├── data/
│   └── pharmacy.sqlite
├── pnarmacy/
│   ├── pharmacy_a.json
│   ├── pharmacy_b.xml
│   └── pharmacy_c.json
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/
│   │   ├── app-config.ts
│   │   └── app-config.spec.ts
│   ├── database/
│   │   ├── data-source.ts
│   │   ├── database.module.ts
│   │   └── migrations/
│   │       └── 1785283200000-create-pharmacy-catalog.ts
│   └── modules/
│       └── catalog/
│           ├── catalog.module.ts
│           ├── index.ts
│           ├── domain/
│           │   ├── catalog.types.ts
│           │   ├── gtin.ts
│           │   ├── gtin.spec.ts
│           │   ├── medicine-matcher.ts
│           │   ├── medicine-matcher.spec.ts
│           │   ├── medicine-normalizer.ts
│           │   └── medicine-normalizer.spec.ts
│           ├── application/
│           │   ├── ports/
│           │   │   ├── catalog-read.repository.ts
│           │   │   ├── catalog-write.repository.ts
│           │   │   ├── import-batch.repository.ts
│           │   │   ├── source-reader.ts
│           │   │   └── transaction-manager.ts
│           │   ├── import-catalog.use-case.ts
│           │   ├── import-catalog.use-case.spec.ts
│           │   ├── get-catalog.query.ts
│           │   └── get-catalog.query.spec.ts
│           ├── infrastructure/
│           │   ├── sources/
│           │   │   ├── pharmacy-a.reader.ts
│           │   │   ├── pharmacy-a.reader.spec.ts
│           │   │   ├── pharmacy-b.reader.ts
│           │   │   ├── pharmacy-b.reader.spec.ts
│           │   │   ├── pharmacy-c.reader.ts
│           │   │   ├── pharmacy-c.reader.spec.ts
│           │   │   └── parse-provider-record.ts
│           │   └── persistence/
│           │       ├── entities/
│           │       │   ├── index.ts
│           │       │   ├── import-batch.orm-entity.ts
│           │       │   ├── import-error.orm-entity.ts
│           │       │   ├── medicine-source.orm-entity.ts
│           │       │   ├── medicine.orm-entity.ts
│           │       │   ├── provider.orm-entity.ts
│           │       │   └── source-record.orm-entity.ts
│           │       ├── typeorm-catalog.repository.ts
│           │       ├── typeorm-catalog.repository.int-spec.ts
│           │       ├── typeorm-import-batch.repository.ts
│           │       └── typeorm-transaction.manager.ts
│           └── presentation/
│               └── graphql/
│                   ├── catalog.models.ts
│                   ├── catalog.resolver.ts
│                   └── catalog.resolver.spec.ts
├── test/
│   ├── catalog.e2e-spec.ts
│   └── jest-e2e.json
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── jest.config.ts
├── nest-cli.json
├── package.json
├── tsconfig.build.json
└── tsconfig.json
```

---

### Task 1: Bootstrap, configuration, and enforceable boundaries

**Deliverable:** NestJS приложение собирается, проверяет конфигурацию, видит
GraphQL endpoint и имеет исполнимые architecture checks.

**Files:**

- Create: `package.json`
- Create: `nest-cli.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `jest.config.ts`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/config/app-config.ts`
- Create: `src/config/app-config.spec.ts`
- Create: `src/main.ts`
- Create: `src/app.module.ts`

**Interfaces:**

- Produces:
  `loadAppConfig(env: NodeJS.ProcessEnv): AppConfig`.
- `AppConfig` fields:
  `port`, `databasePath`, `sourceRoot`, `nodeEnv`.
- Later tasks consume `AppConfig` through the Nest `APP_CONFIG` token.

- [ ] **Step 1: Create the exact package manifest**

```json
{
  "name": "pharmafuse-catalog",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "engines": {
    "node": ">=24.11.0 <25",
    "npm": ">=11 <12"
  },
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "format:check": "prettier --check \"{src,test}/**/*.ts\" \"*.{json,mjs}\"",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand",
    "test:unit": "jest --runInBand --testPathPatterns='spec.ts$' --testPathIgnorePatterns='int-spec|e2e-spec'",
    "test:integration": "jest --runInBand --testPathPatterns='int-spec.ts$'",
    "test:e2e": "node --no-warnings --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand",
    "test:cov": "jest --coverage --runInBand",
    "architecture:cycles": "madge --ts-config tsconfig.json --extensions ts --circular src",
    "architecture:graph": "graphify update . --no-cluster",
    "typeorm": "node --require ts-node/register --require tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:run": "npm run typeorm -- migration:run -d src/database/data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/database/data-source.ts",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run architecture:cycles && npm run build"
  },
  "dependencies": {
    "@nestjs/common": "11.1.28",
    "@nestjs/config": "4.0.4",
    "@nestjs/core": "11.1.28",
    "@nestjs/graphql": "13.4.2",
    "@nestjs/mercurius": "13.4.2",
    "@nestjs/platform-fastify": "11.1.28",
    "@nestjs/typeorm": "11.0.3",
    "better-sqlite3": "12.11.1",
    "class-transformer": "0.5.1",
    "class-validator": "0.15.1",
    "fast-xml-parser": "5.10.1",
    "fastify": "5.10.0",
    "graphql": "16.14.2",
    "mercurius": "16.10.0",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2",
    "typeorm": "1.1.0"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@nestjs/cli": "11.0.24",
    "@nestjs/testing": "11.1.28",
    "@types/better-sqlite3": "7.6.13",
    "@types/jest": "30.0.0",
    "@types/node": "24.13.3",
    "eslint": "10.8.0",
    "eslint-config-prettier": "10.1.8",
    "jest": "30.4.2",
    "madge": "8.0.0",
    "prettier": "3.9.6",
    "ts-jest": "29.4.12",
    "ts-node": "10.9.2",
    "tsconfig-paths": "4.2.0",
    "typescript": "5.9.3",
    "typescript-eslint": "8.65.0"
  }
}
```

- [ ] **Step 2: Install and audit the exact dependency graph**

Run:

```bash
make install
make deps
make audit-prod
```

Expected:

- `package-lock.json` is created;
- `npm ls --all` exits `0` without invalid peer dependencies;
- audit result is recorded verbatim in the implementation handoff.

If `npm ls` reports a peer conflict, do not use `--force` or
`--legacy-peer-deps`; compare the installed metadata with the npm Registry and
adjust the plan before continuing.

- [ ] **Step 3: Write the failing configuration tests**

```ts
import { loadAppConfig } from './app-config'

describe('loadAppConfig', () => {
  it('resolves paths from the project root', () => {
    expect(
      loadAppConfig({
        NODE_ENV: 'test',
        PORT: '3100',
        DATABASE_PATH: 'data/test.sqlite',
        SOURCE_ROOT: 'pnarmacy',
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 3100,
      databasePath: expect.stringMatching(/data\/test\.sqlite$/),
      sourceRoot: expect.stringMatching(/pnarmacy$/),
    })
  })

  it('rejects an invalid port', () => {
    expect(() => loadAppConfig({ PORT: 'zero' })).toThrow('PORT must be an integer between 1 and 65535')
  })
})
```

- [ ] **Step 4: Run the configuration test and observe the intended failure**

Run:

```bash
make test-file FILE=src/config/app-config.spec.ts
```

Expected: FAIL because `app-config.ts` does not exist.

- [ ] **Step 5: Implement configuration without framework leakage**

```ts
import { resolve } from 'node:path'

export const APP_CONFIG = Symbol('APP_CONFIG')

export interface AppConfig {
  nodeEnv: string
  port: number
  databasePath: string
  sourceRoot: string
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const port = Number(env.PORT ?? 3008)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port,
    databasePath: resolve(process.cwd(), env.DATABASE_PATH ?? 'data/pharmacy.sqlite'),
    sourceRoot: resolve(process.cwd(), env.SOURCE_ROOT ?? 'pnarmacy'),
  }
}
```

- [ ] **Step 6: Configure strict TypeScript and architecture lint rules**

`tsconfig.json` must contain:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2023",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "jest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

In `eslint.config.mjs`, apply `no-restricted-imports` overrides:

```js
{
  files: ['src/modules/*/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@nestjs/*',
        'typeorm',
        'graphql',
        '@/modules/*/application/*',
        '@/modules/*/infrastructure/*',
        '@/modules/*/presentation/*',
        '@/database/*'
      ]
    }]
  }
},
{
  files: ['src/modules/*/application/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@nestjs/*',
        'typeorm',
        'graphql',
        '@/modules/*/infrastructure/*',
        '@/modules/*/presentation/*',
        '@/database/*'
      ]
    }]
  }
}
```

- [ ] **Step 7: Add the minimal bootstrap**

`main.ts`:

```ts
import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './config/app-config'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  const config = app.get<AppConfig>(APP_CONFIG)
  await app.listen(config.port)
}

void bootstrap()
```

`AppModule` at this step provides `APP_CONFIG`. GraphQL and catalog imports are
added by later tasks, after their modules exist.

- [ ] **Step 8: Verify the bootstrap**

Run:

```bash
make typecheck
make lint
make build
```

Expected: all three commands exit `0`.

---

### Task 2: Domain types, GTIN, normalization, and matching

**Deliverable:** Pure domain functions convert all provider representations to
one candidate and select a deterministic match strategy.

**Files:**

- Create: `src/modules/catalog/domain/catalog.types.ts`
- Create: `src/modules/catalog/domain/gtin.ts`
- Create: `src/modules/catalog/domain/gtin.spec.ts`
- Create: `src/modules/catalog/domain/medicine-normalizer.ts`
- Create: `src/modules/catalog/domain/medicine-normalizer.spec.ts`
- Create: `src/modules/catalog/domain/medicine-matcher.ts`
- Create: `src/modules/catalog/domain/medicine-matcher.spec.ts`

**Interfaces:**

- Produces:

```ts
export type ProviderCode = 'pharmacy-a' | 'pharmacy-b' | 'pharmacy-c'
export type DosageForm = 'TABLET'
export type MatchStrategy = 'NEW_RECORD' | 'VALID_GTIN' | 'INVALID_GTIN_WITH_COMPOSITE' | 'COMPOSITE_KEY'

export interface RawMedicineRecord {
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  name: string
  manufacturer: string
  gtin: string | null
  dosageValue: number
  dosageUnit: string
  packageSize: number
  dosageForm: string
  prescriptionRequired: boolean | string
  country: string
  registrationDate: string
  rawPayload: unknown
}

export interface NormalizedMedicineCandidate {
  providerCode: ProviderCode
  externalId: string
  sourceFile: string
  canonicalName: string
  normalizedName: string
  manufacturer: string
  normalizedManufacturer: string
  gtin: string | null
  gtinValid: boolean
  dosageMicrograms: number
  dosageForm: DosageForm
  packageSize: number
  prescriptionRequired: boolean
  countryCode: 'GB'
  registrationDate: string
  compositeKey: string
  rawPayloadJson: string
  normalizedPayloadJson: string
}

export interface ExistingMedicineIdentity {
  id: string
  gtin: string | null
  gtinValid: boolean
  compositeKey: string
}
```

- `normalizeGtin(value: string | null): { value: string | null; valid: boolean }`
- `normalizeMedicine(record: RawMedicineRecord): NormalizedMedicineCandidate`
- `selectMatch(candidate, existing): MatchDecision`

- [ ] **Step 1: Write GTIN tests**

```ts
import { normalizeGtin } from './gtin'

describe('normalizeGtin', () => {
  it('preserves a leading zero and strips separators', () => {
    expect(normalizeGtin('0505-0123-4567-89')).toEqual({
      value: '05050123456789',
      valid: false,
    })
  })

  it('validates the calculated check digit', () => {
    expect(normalizeGtin('4006381333931')).toEqual({
      value: '4006381333931',
      valid: true,
    })
  })

  it('does not fabricate an identifier', () => {
    expect(normalizeGtin(null)).toEqual({ value: null, valid: false })
  })
})
```

- [ ] **Step 2: Run and confirm the GTIN test fails**

Run:

```bash
make test-file FILE=src/modules/catalog/domain/gtin.spec.ts
```

Expected: FAIL because `normalizeGtin` is missing.

- [ ] **Step 3: Implement GTIN normalization and GS1 check**

```ts
const GTIN_LENGTHS = new Set([8, 12, 13, 14])

export function normalizeGtin(input: string | null): { value: string | null; valid: boolean } {
  if (input === null) return { value: null, valid: false }

  const value = input.replace(/[^0-9]/g, '')
  if (!GTIN_LENGTHS.has(value.length)) return { value, valid: false }

  const supplied = Number(value.at(-1))
  const body = value.slice(0, -1)
  let sum = 0

  for (let index = body.length - 1, position = 1; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 1 ? 3 : 1)
  }

  const calculated = (10 - (sum % 10)) % 10
  return { value, valid: calculated === supplied }
}
```

- [ ] **Step 4: Write the normalization contract test**

Construct three `RawMedicineRecord` values corresponding to A, B and C, then
assert:

```ts
const candidates = records.map(normalizeMedicine)

expect(candidates.map((item) => item.normalizedName)).toEqual(['nurofen', 'nurofen', 'nurofen'])
expect(candidates.map((item) => item.normalizedManufacturer)).toEqual(['reckitt benckiser', 'reckitt benckiser', 'reckitt benckiser'])
expect(new Set(candidates.map((item) => item.compositeKey))).toEqual(new Set(['nurofen|reckitt benckiser|200000|TABLET|24|GB']))
expect(candidates.map((item) => item.registrationDate)).toEqual(['2023-01-15', '2023-01-15', '2023-01-15'])
```

Also assert that unknown `dosageUnit`, `dosageForm`, `country` and
prescription strings throw explicit domain errors.

- [ ] **Step 5: Implement the smallest normalization pipeline**

Use local pure functions:

```ts
function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

function dosageToMicrograms(value: number, unit: string): number {
  const normalizedUnit = normalizeText(unit)
  if (normalizedUnit !== 'mg') {
    throw new Error(`UNSUPPORTED_DOSAGE_UNIT:${unit}`)
  }
  const micrograms = value * 1_000
  if (!Number.isSafeInteger(micrograms) || micrograms <= 0) {
    throw new Error(`INVALID_DOSAGE:${value} ${unit}`)
  }
  return micrograms
}

function normalizeManufacturer(value: string): string {
  return normalizeText(value)
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((token) => !['ltd', 'limited', 'healthcare'].includes(token))
    .join(' ')
}
```

The date parser must explicitly recognize only:

```text
YYYY-MM-DD
DD.MM.YYYY
YYYY/MM/DD
```

After constructing a UTC date, compare its year/month/day back to the parsed
numbers so `31.02.2023` cannot roll into March.

Serialize `rawPayloadJson` with a stable key sorter before hashing in Task 5.
Serialize `normalizedPayloadJson` from the final candidate fields.

- [ ] **Step 6: Write all matcher strategy tests**

```ts
it.each([
  {
    candidate: { gtin: '4006381333931', gtinValid: true, compositeKey: 'a' },
    existing: [{ id: 'm1', gtin: '4006381333931', gtinValid: true, compositeKey: 'b' }],
    expected: { medicineId: 'm1', strategy: 'VALID_GTIN' },
  },
  {
    candidate: { gtin: '05050123456789', gtinValid: false, compositeKey: 'same' },
    existing: [{ id: 'm2', gtin: '05050123456789', gtinValid: false, compositeKey: 'same' }],
    expected: { medicineId: 'm2', strategy: 'INVALID_GTIN_WITH_COMPOSITE' },
  },
  {
    candidate: { gtin: null, gtinValid: false, compositeKey: 'same' },
    existing: [{ id: 'm3', gtin: null, gtinValid: false, compositeKey: 'same' }],
    expected: { medicineId: 'm3', strategy: 'COMPOSITE_KEY' },
  },
  {
    candidate: { gtin: null, gtinValid: false, compositeKey: 'new' },
    existing: [],
    expected: { medicineId: null, strategy: 'NEW_RECORD' },
  },
])('selects $expected.strategy', ({ candidate, existing, expected }) => {
  expect(selectMatch(candidate, existing)).toEqual(expected)
})
```

- [ ] **Step 7: Implement matcher precedence and verify the domain**

The matcher checks `VALID_GTIN`, then
`INVALID_GTIN_WITH_COMPOSITE`, then `COMPOSITE_KEY`, then `NEW_RECORD`.

Run:

```bash
make test-file FILE=src/modules/catalog/domain
make typecheck
make lint
```

Expected: domain tests pass and architecture lint reports no outward imports.

---

### Task 3: Provider source adapters

**Deliverable:** Three infrastructure readers parse the exact fixture shapes
and return `RawMedicineRecord[]`.

**Files:**

- Create: `src/modules/catalog/application/ports/source-reader.ts`
- Create: `src/modules/catalog/infrastructure/sources/parse-provider-record.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-a.reader.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-a.reader.spec.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-b.reader.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-b.reader.spec.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-c.reader.ts`
- Create: `src/modules/catalog/infrastructure/sources/pharmacy-c.reader.spec.ts`

**Interfaces:**

```ts
export const SOURCE_READERS = Symbol('SOURCE_READERS')

export interface SourceReader {
  readonly providerCode: ProviderCode
  read(): Promise<RawMedicineRecord[]>
}
```

Each reader receives `sourceRoot` in its constructor and owns exactly one
relative filename.

- [ ] **Step 1: Write Pharmacy A fixture test**

```ts
const reader = new PharmacyAReader(fixtureRoot)
const records = await reader.read()

expect(records).toHaveLength(1)
expect(records[0]).toMatchObject({
  providerCode: 'pharmacy-a',
  externalId: 'a-100',
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
})
```

- [ ] **Step 2: Implement Pharmacy A JSON-array reader**

Read `pharmacy_a.json` with `node:fs/promises`, `JSON.parse`, and a
shape-checking mapper. Do not cast parsed JSON directly to the provider type.
Validate `id`, `name`, `manufacturer`, `dosage_mg`, `package_size`, `form`,
`prescription_required`, `country`, and `registration_date`.

- [ ] **Step 3: Write and implement Pharmacy B XML reader**

Test expected output:

```ts
expect((await reader.read())[0]).toMatchObject({
  providerCode: 'pharmacy-b',
  externalId: 'b-777',
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
})
```

Configure `XMLParser`:

```ts
new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
})
```

Keeping `parseTagValue: false` prevents accidental coercion of external IDs,
booleans and leading-zero identifiers. Parse dosage with:

```ts
const dosageMatch = dosage.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/)
```

Parse pack with:

```ts
const packMatch = pack.match(/^(\d+)\s+(.+)$/)
```

- [ ] **Step 4: Write and implement Pharmacy C nested JSON reader**

Test expected output:

```ts
expect((await reader.read())[0]).toMatchObject({
  providerCode: 'pharmacy-c',
  externalId: 'c_991',
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
})
```

Validate `items` is an array and validate every nested object before reading its
fields.

- [ ] **Step 5: Verify all provider adapters**

Run:

```bash
make test-file FILE=src/modules/catalog/infrastructure/sources
make typecheck
```

Expected: three reader suites pass; each returns one record; total records are
`1 + 1 + 1 = 3`.

---

### Task 4: SQLite migration and TypeORM persistence adapters

**Deliverable:** A migration creates the auditable schema; repository
integration tests prove constraints and read projections.

**Files:**

- Create: `src/database/data-source.ts`
- Create: `src/database/database.module.ts`
- Create: `src/database/migrations/1785283200000-create-pharmacy-catalog.ts`
- Create: `src/modules/catalog/application/ports/catalog-read.repository.ts`
- Create: `src/modules/catalog/application/ports/catalog-write.repository.ts`
- Create: `src/modules/catalog/application/ports/import-batch.repository.ts`
- Create: `src/modules/catalog/application/ports/transaction-manager.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/index.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/provider.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/import-batch.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/medicine.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/source-record.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/medicine-source.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/entities/import-error.orm-entity.ts`
- Create: `src/modules/catalog/infrastructure/persistence/typeorm-catalog.repository.ts`
- Create: `src/modules/catalog/infrastructure/persistence/typeorm-import-batch.repository.ts`
- Create: `src/modules/catalog/infrastructure/persistence/typeorm-transaction.manager.ts`
- Create: `src/modules/catalog/infrastructure/persistence/typeorm-catalog.repository.int-spec.ts`

**Interfaces:**

```ts
export const CATALOG_READ_REPOSITORY = Symbol('CATALOG_READ_REPOSITORY')
export const CATALOG_WRITE_REPOSITORY = Symbol('CATALOG_WRITE_REPOSITORY')
export const IMPORT_BATCH_REPOSITORY = Symbol('IMPORT_BATCH_REPOSITORY')
export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')

export interface CatalogWriteRepository {
  findIdentityCandidates(candidate: NormalizedMedicineCandidate): Promise<ExistingMedicineIdentity[]>
  createMedicine(candidate: NormalizedMedicineCandidate, now: string): Promise<string>
  sourceRecordExists(providerCode: ProviderCode, externalId: string, payloadHash: string): Promise<boolean>
  createSourceAndLink(input: CreateSourceAndLinkInput): Promise<void>
  createImportError(input: CreateImportErrorInput): Promise<void>
}

export interface ImportBatchRepository {
  start(batchId: string, startedAt: string): Promise<void>
  complete(batchId: string, stats: ImportStats, finishedAt: string): Promise<void>
  fail(batchId: string, message: string, finishedAt: string): Promise<void>
}

export interface CatalogReadRepository {
  listMedicines(): Promise<MedicineView[]>
  findMedicine(id: string): Promise<MedicineView | null>
  listImportBatches(): Promise<ImportBatchView[]>
}

export interface TransactionManager {
  run<T>(work: (repository: CatalogWriteRepository) => Promise<T>): Promise<T>
}
```

- [ ] **Step 1: Write a migration integration test first**

Use a unique SQLite file inside `mkdtemp()` and assert:

```ts
expect(await queryRunner.hasTable('providers')).toBe(true)
expect(await queryRunner.hasTable('import_batches')).toBe(true)
expect(await queryRunner.hasTable('medicines')).toBe(true)
expect(await queryRunner.hasTable('source_records')).toBe(true)
expect(await queryRunner.hasTable('medicine_sources')).toBe(true)
expect(await queryRunner.hasTable('import_errors')).toBe(true)
```

Also query `PRAGMA foreign_keys` and expect `1`.

- [ ] **Step 2: Implement the migration exactly from the design**

Create all six tables and the two medicine indexes specified in:

```text
docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md
section 9
```

The `up` method inserts the provider configuration:

```sql
INSERT INTO providers (id, code, name, source_file) VALUES
  ('provider-a', 'pharmacy-a', 'Pharmacy A', 'pharmacy_a.json'),
  ('provider-b', 'pharmacy-b', 'Pharmacy B', 'pharmacy_b.xml'),
  ('provider-c', 'pharmacy-c', 'Pharmacy C', 'pharmacy_c.json');
```

The `down` method drops tables in reverse foreign-key order:

```text
import_errors
medicine_sources
source_records
medicines
import_batches
providers
```

- [ ] **Step 3: Configure TypeORM safely**

`data-source.ts`:

```ts
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { loadAppConfig } from '@/config/app-config'
import { entities } from '@/modules/catalog/infrastructure/persistence/entities'
import { CreatePharmacyCatalog1785283200000 } from './migrations/1785283200000-create-pharmacy-catalog'

const config = loadAppConfig(process.env)

export default new DataSource({
  type: 'better-sqlite3',
  database: config.databasePath,
  entities,
  migrations: [CreatePharmacyCatalog1785283200000],
  synchronize: false,
  migrationsRun: false,
  prepareDatabase: (database) => {
    database.pragma('foreign_keys = ON')
    database.pragma('journal_mode = WAL')
  },
})
```

In tests use `journal_mode = MEMORY` rather than WAL for temporary databases.

- [ ] **Step 4: Implement infrastructure-only ORM entities**

Every `@Entity()` class remains below
`infrastructure/persistence/entities`. Domain types contain no TypeORM
decorators. Map SQLite booleans using integer transformer:

```ts
export const sqliteBoolean = {
  to(value: boolean): number {
    return value ? 1 : 0
  },
  from(value: number): boolean {
    return value === 1
  },
}
```

- [ ] **Step 5: Write repository behavior tests**

Cover:

1. valid GTIN lookup;
2. invalid GTIN plus composite lookup;
3. composite-only lookup;
4. source record uniqueness by provider/external ID/hash;
5. medicine projection with all linked sources;
6. rollback after an exception inside `TransactionManager.run`;
7. a batch row remains available for a later `FAILED` update after the catalog
   transaction rolls back.

The uniqueness test performs two identical inserts and expects the second
operation to be detected by `sourceRecordExists`, leaving:

```ts
expect(await countRows('source_records')).toBe(1)
```

- [ ] **Step 6: Implement repositories and transaction scoping**

`TypeOrmTransactionManager.run()` uses:

```ts
return this.dataSource.transaction(async (entityManager) => {
  const repository = new TypeOrmCatalogRepository(entityManager)
  return work(repository)
})
```

Do not inject a global TypeORM repository into the transaction callback.
Everything written by one import batch must use the callback's
`EntityManager`.

- [ ] **Step 7: Run migration and integration verification**

Run:

```bash
make migrate DATABASE_PATH=/tmp/pharmacy-plan-check.sqlite
make test-integration
make migrate-revert DATABASE_PATH=/tmp/pharmacy-plan-check.sqlite
```

Expected:

- migration applies once;
- integration suites pass;
- revert removes all catalog tables;
- implementation handoff states whether the temporary file remains.

---

### Task 5: Import-catalog use case and idempotency

**Deliverable:** One application use case imports all configured readers in a
transaction and returns auditable statistics.

**Files:**

- Create: `src/modules/catalog/application/import-catalog.use-case.ts`
- Create: `src/modules/catalog/application/import-catalog.use-case.spec.ts`

**Interfaces:**

```ts
export interface ImportStats {
  providerRecordsRead: number
  medicinesCreated: number
  sourceRecordsLinked: number
  duplicatesMerged: number
  recordErrors: number
}

export interface ImportBatchResult extends ImportStats {
  id: string
  status: 'COMPLETED'
  startedAt: string
  finishedAt: string
}

export class ImportCatalogUseCase {
  constructor(
    readers: readonly SourceReader[],
    transactionManager: TransactionManager,
    importBatchRepository: ImportBatchRepository,
    clock: () => Date,
    createId: () => string,
  )

  execute(): Promise<ImportBatchResult>
}
```

- [ ] **Step 1: Write the successful three-provider use-case test**

Provide three in-memory readers, an in-memory repository double and fixed
clock/IDs. Assert:

```ts
expect(await useCase.execute()).toMatchObject({
  status: 'COMPLETED',
  providerRecordsRead: 3,
  medicinesCreated: 1,
  sourceRecordsLinked: 3,
  duplicatesMerged: 2,
  recordErrors: 0,
})
expect(repository.medicines).toHaveLength(1)
expect(repository.sourceRecords).toHaveLength(3)
```

- [ ] **Step 2: Write the idempotency test**

Execute the same use case twice against the same repository double. After the
second run:

```ts
expect(repository.medicines).toHaveLength(1)
expect(repository.sourceRecords).toHaveLength(3)
expect(secondRun).toMatchObject({
  providerRecordsRead: 3,
  medicinesCreated: 0,
  sourceRecordsLinked: 0,
  duplicatesMerged: 0,
  recordErrors: 0,
})
```

`providerRecordsRead` remains `3` because the readers read three records; the
write counters remain zero because all payloads already exist.

- [ ] **Step 3: Write record-error and fatal-file-error tests**

Record error:

- one reader returns one valid and one unsupported dosage record;
- result has `providerRecordsRead: 2`, `sourceRecordsLinked: 1`,
  `recordErrors: 1`;
- repository has one `import_errors` row.

Fatal file error:

- reader throws `SOURCE_READ_FAILED:pharmacy-b`;
- transaction double records rollback;
- batch repository receives `fail(batchId, sanitizedMessage, finishedAt)` after
  rollback;
- `execute()` rejects with a sanitized `CatalogImportFailedError`;
- no medicine/source writes survive.

- [ ] **Step 4: Implement canonical payload hashing**

Create a local recursive stable serializer:

```ts
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    )
  }
  return value
}
```

Then calculate:

```ts
const payloadHash = createHash('sha256')
  .update(`${providerCode}\n${externalId}\n${JSON.stringify(stableValue(rawPayload))}`)
  .digest('hex')
```

- [ ] **Step 5: Implement the orchestration in explicit order**

Before the transaction, generate `batchId` and call
`importBatchRepository.start(batchId, startedAt)`. For each reader and record
inside `TransactionManager.run()`:

1. increment `providerRecordsRead`;
2. calculate payload hash;
3. skip unchanged source record;
4. normalize candidate;
5. load identity candidates;
6. call pure `selectMatch`;
7. create medicine only for `NEW_RECORD`;
8. create source record and link;
9. increment `sourceRecordsLinked`;
10. increment `duplicatesMerged` only when a new source was linked to an
    existing medicine;
11. persist a record error for a domain validation failure;
12. return final counters from the transaction callback.

After commit call `importBatchRepository.complete()`. In `catch`, call
`importBatchRepository.fail()` outside the rolled-back transaction and rethrow
the sanitized application error.

Use injected `clock` and `createId` so unit tests contain no real time or random
values. Production providers are:

```ts
() => new Date()
() => randomUUID()
```

- [ ] **Step 6: Run use-case verification**

Run:

```bash
make test-file FILE=src/modules/catalog/application/import-catalog.use-case.spec.ts
make typecheck
make lint
```

Expected: success, idempotency, record-error and rollback tests all pass.

---

### Task 6: Get-catalog query and GraphQL presentation

**Deliverable:** GraphQL mutation imports configured files; queries return the
catalog, source provenance and batch history as JSON.

**Files:**

- Create: `src/modules/catalog/application/get-catalog.query.ts`
- Create: `src/modules/catalog/application/get-catalog.query.spec.ts`
- Create: `src/modules/catalog/presentation/graphql/catalog.models.ts`
- Create: `src/modules/catalog/presentation/graphql/catalog.resolver.ts`
- Create: `src/modules/catalog/presentation/graphql/catalog.resolver.spec.ts`
- Create: `src/modules/catalog/catalog.module.ts`
- Create: `src/modules/catalog/index.ts`
- Modify: `src/app.module.ts`

**Interfaces:**

```ts
export class GetCatalogQuery {
  constructor(private readonly repository: CatalogReadRepository);
  list(): Promise<MedicineView[]>;
  findById(id: string): Promise<MedicineView | null>;
  listImportBatches(): Promise<ImportBatchView[]>;
}
```

GraphQL operations:

```graphql
type Query {
  catalog: [Medicine!]!
  medicine(id: ID!): Medicine
  importBatches: [ImportBatch!]!
}

type Mutation {
  importCatalog: ImportBatch!
}
```

- [ ] **Step 1: Write query delegation tests**

Assert `list`, `findById`, and `listImportBatches` call the read repository
exactly once and return its immutable view values unchanged.

- [ ] **Step 2: Define GraphQL-only model classes**

Use `@ObjectType`, `@Field`, `@ID`, `@Int`, `@Float`, `registerEnumType`.
Do not decorate domain interfaces.

Expose dosage as:

```ts
@ObjectType()
export class DosageModel {
  @Field(() => Float)
  value!: number

  @Field()
  unit!: 'mg'
}
```

Mapper calculation:

```ts
{
  value: view.dosageMicrograms / 1_000,
  unit: 'mg',
}
```

- [ ] **Step 3: Write resolver unit tests**

Test:

- `catalog()` delegates to `GetCatalogQuery.list()`;
- `medicine(id)` delegates to `findById(id)`;
- `importCatalog()` delegates once to `ImportCatalogUseCase.execute()`;
- mapper returns three source records and does not expose internal
  `compositeKey`, `payloadHash`, database paths or error stacks.

- [ ] **Step 4: Implement the resolver**

```ts
@Resolver(() => MedicineModel)
export class CatalogResolver {
  constructor(
    private readonly getCatalog: GetCatalogQuery,
    private readonly importCatalogUseCase: ImportCatalogUseCase,
  ) {}

  @Query(() => [MedicineModel])
  catalog(): Promise<MedicineModel[]> {
    return this.getCatalog.list().then((items) => items.map(toMedicineModel))
  }

  @Query(() => MedicineModel, { nullable: true })
  medicine(@Args('id', { type: () => ID }) id: string): Promise<MedicineModel | null> {
    return this.getCatalog.findById(id).then((item) => (item === null ? null : toMedicineModel(item)))
  }

  @Query(() => [ImportBatchModel])
  importBatches(): Promise<ImportBatchModel[]> {
    return this.getCatalog.listImportBatches()
  }

  @Mutation(() => ImportBatchModel)
  importCatalog(): Promise<ImportBatchModel> {
    return this.importCatalogUseCase.execute()
  }
}
```

- [ ] **Step 5: Assemble CatalogModule**

Register:

- three `SourceReader` instances under `SOURCE_READERS`;
- TypeORM entities with `TypeOrmModule.forFeature`;
- `TypeOrmCatalogRepository` for read/write ports;
- `TypeOrmImportBatchRepository` for batch lifecycle outside the catalog
  transaction;
- `TypeOrmTransactionManager`;
- `ImportCatalogUseCase`;
- `GetCatalogQuery`;
- `CatalogResolver`.

The `src/modules/catalog/index.ts` public API exports only `CatalogModule`.

- [ ] **Step 6: Configure GraphQL in AppModule**

```ts
GraphQLModule.forRoot<MercuriusDriverConfig>({
  driver: MercuriusDriver,
  autoSchemaFile: join(process.cwd(), 'schema.gql'),
  sortSchema: true,
  graphiql: config.nodeEnv !== 'production',
  debug: config.nodeEnv !== 'production',
  includeStacktraceInErrorResponses: config.nodeEnv !== 'production',
})
```

Also import `DatabaseModule` and `CatalogModule`.

- [ ] **Step 7: Run presentation checks**

Run:

```bash
make test-file FILE=src/modules/catalog/application/get-catalog.query.spec.ts
make test-file FILE=src/modules/catalog/presentation/graphql/catalog.resolver.spec.ts
make typecheck
make build
```

Expected: tests pass and `schema.gql` is generated during initialized app tests
or e2e setup.

---

### Task 7: End-to-end acceptance test

**Deliverable:** A disposable SQLite database proves the complete
file → adapter → normalization → deduplication → persistence → GraphQL flow.

**Files:**

- Create: `test/jest-e2e.json`
- Create: `test/catalog.e2e-spec.ts`

**Interfaces consumed:**

- `POST /graphql`
- mutation `importCatalog`
- query `catalog`
- query `importBatches`

- [ ] **Step 1: Create an isolated e2e database**

Before creating `AppModule`, set:

```ts
const tempRoot = await mkdtemp(join(tmpdir(), 'pharmacy-catalog-e2e-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = join(tempRoot, 'catalog.sqlite')
process.env.SOURCE_ROOT = join(process.cwd(), 'pnarmacy')
```

Run migrations before `app.init()`. In `afterAll`, close Nest and TypeORM
connections, then remove only the exact `tempRoot` returned by `mkdtemp`.

- [ ] **Step 2: Write the import mutation assertion**

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

Expected JSON data:

```json
{
  "status": "COMPLETED",
  "providerRecordsRead": 3,
  "medicinesCreated": 1,
  "sourceRecordsLinked": 3,
  "duplicatesMerged": 2,
  "recordErrors": 0
}
```

- [ ] **Step 3: Write the catalog query assertion**

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
      matchStrategy
    }
  }
}
```

Expected key facts:

```ts
expect(body.data.catalog).toHaveLength(1)
expect(body.data.catalog[0]).toMatchObject({
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
})
expect(body.data.catalog[0].sources).toHaveLength(3)
expect(body.data.catalog[0].sources.map((source) => source.externalId).sort()).toEqual(['a-100', 'b-777', 'c_991'])
```

- [ ] **Step 4: Prove idempotency over GraphQL**

Call `importCatalog` a second time, then assert:

```json
{
  "providerRecordsRead": 3,
  "medicinesCreated": 0,
  "sourceRecordsLinked": 0,
  "duplicatesMerged": 0,
  "recordErrors": 0
}
```

Query `catalog` again and assert one medicine and three sources remain.

- [ ] **Step 5: Prove the transport returns JSON**

For every GraphQL request:

```ts
expect(response.headers['content-type']).toMatch(/^application\/json/)
expect(response.status).toBe(200)
```

- [ ] **Step 6: Run e2e**

Run:

```bash
make test-e2e
```

Expected: the complete acceptance suite passes against a newly migrated
temporary SQLite database.

---

### Task 8: Documentation, graphify, and final verification

**Deliverable:** A reviewer can install, migrate, run, query and verify the
service using documented commands; graph evidence reflects the implemented
code.

**Files:**

- Modify: `README.md`
- Create: `.env.example`
- Generated: `schema.gql`
- Generated: `graphify-out/graph.json`

**Interfaces:**

- README documents only commands proven in this task.
- `graphify-out/graph.json` is queried after successful code extraction.

- [ ] **Step 1: Document environment and startup**

`.env.example`:

```dotenv
NODE_ENV=development
PORT=3008
DATABASE_PATH=data/pharmacy.sqlite
SOURCE_ROOT=pnarmacy
```

README command sequence:

```bash
make setup
make dev
```

Document GraphiQL URL:

```text
http://localhost:3008/graphql
```

- [ ] **Step 2: Document the exact demo**

Include the mutation and catalog query from Task 7. Document the verified
expected arithmetic:

```text
3 provider records
- 1 canonical medicine
= 2 merged duplicates

1 canonical medicine has 3 source references
```

Also explain:

- invalid sample GTIN is preserved with `gtinValid: false`;
- matching succeeds through invalid-GTIN equality plus identical composite key;
- repeated identical import adds no source records.

- [ ] **Step 3: Run the complete local verification suite**

Run:

```bash
make verify
```

Record each command and exit status. Do not claim a check passed unless its
current-turn output shows exit code `0`.

- [ ] **Step 4: Generate the code knowledge graph**

Run after all source files exist:

```bash
make graph-update
```

Expected:

```text
graphify-out/graph.json exists and is non-empty
```

If Graphify reports `Operation not permitted` or another extraction failure,
report the exact error and do not describe the graph as updated.

- [ ] **Step 5: Query architectural direction**

Run:

```bash
make graph-query
make graph-god-nodes
make graph-diagnose
```

Confirm graph evidence is consistent with:

```text
presentation -> application -> domain
infrastructure -> application/domain ports
domain -X-> infrastructure/presentation/app
```

Graphify is supporting evidence, not enforcement. ESLint and Madge remain the
executable architecture checks.

- [ ] **Step 6: Final acceptance checklist**

Verify from current outputs:

- all three files were read;
- three provider records were normalized;
- exactly one medicine exists;
- exactly three source records and links exist;
- exactly two duplicates were merged on first import;
- second import creates no medicine/source rows;
- GTIN is `05050123456789` and `gtinValid` is `false`;
- GraphQL response is JSON;
- migrations run with `synchronize: false`;
- unit, integration and e2e suites pass;
- typecheck, lint, circular dependency check and build pass;
- README commands match commands actually executed;
- dependency audit result is reported without hiding findings.

## Plan self-review

### Spec coverage

| Requirement                   | Implemented by |
| ----------------------------- | -------------- |
| Read all provided sources     | Tasks 3, 5, 7  |
| Normalize to one model        | Task 2         |
| Merge duplicates              | Tasks 2, 5     |
| Preserve every source         | Tasks 4, 5     |
| JSON catalog output           | Tasks 6, 7     |
| Verification method           | Tasks 2–8      |
| NestJS + TypeScript           | Task 1         |
| GraphQL preview               | Tasks 6–8      |
| SQLite storage                | Task 4         |
| Clean Architecture / DDD-lite | Tasks 1–6      |
| Graphify workflow             | Task 8         |

### Type consistency

- `RawMedicineRecord` is produced by Task 3 and consumed by Task 2/5.
- `NormalizedMedicineCandidate` is produced by Task 2 and consumed by Task 4/5.
- `CatalogWriteRepository` is defined in Task 4 and consumed by Task 5.
- `CatalogReadRepository` is defined in Task 4 and consumed by Task 6.
- `ImportBatchResult` is produced by Task 5 and exposed by Task 6.
- GraphQL dosage is derived from integer `dosageMicrograms`.

### Scope confirmation

The plan contains one deployable backend bounded context. No speculative
frontend, queue, authentication, fuzzy matcher, review UI or multi-database
abstraction is included.
