# PharmaFuse Catalog

[English](README.md) · [Русский](README.ru.md)

[![CI](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml)
[![CodeQL](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Docker ready](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
[![GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

Backend-сервис на NestJS и GraphQL, который преобразует разнородные данные
аптечных поставщиков в единый нормализованный, дедуплицированный и проверяемый
каталог лекарств.

## Возможности

- чтение JSON- и XML-записей через три адаптера поставщиков;
- нормализация названий, производителей, дозировок, форм выпуска, упаковок,
  стран, дат, логических значений и GTIN;
- объединение дубликатов по детерминированным правилам GTIN и composite key;
- сохранение исходного и нормализованного payload с полной информацией об
  источнике;
- хранение каталога в SQLite через явные миграции TypeORM;
- GraphQL API для запуска импорта, просмотра статистики и каталога;
- автоматическая проверка нормализации, идемпотентности, хранения и API.

## Архитектура

Каталог реализован как feature module с границами Clean Architecture. Domain
владеет правилами нормализации и сопоставления, application use cases — ports,
а GraphQL и TypeORM остаются адаптерами.

```text
GraphQL presentation -> application use cases -> domain
                              ^
                              |
          provider readers + TypeORM adapters
```

Domain не зависит от NestJS, GraphQL, TypeORM или filesystem. Madge проверяет
циклические импорты, а Graphify формирует доступный для анализа граф
зависимостей. Правила сопоставления и структура модулей описаны в
[руководстве по каталогу](docs/catalog-guide.ru.md).

## Требования к окружению

Bootstrap-команда поддерживает macOS и Ubuntu:

```bash
make i
```

Она устанавливает отсутствующие системные инструменты, NVM `0.40.4`, Node.js
`24.11.0`, npm `11.16.0`, Docker с Compose и ShellCheck. Затем команда создаёт
`.env`, не перезаписывая существующий файл, и устанавливает точные зависимости
из lockfile. Для системной установки может потребоваться пароль администратора.

## Быстрый запуск

Один раз инициализируйте окружение, затем запустите локальный dev:

```bash
make i
make s
```

`make s` освобождает порт `3008`, удаляет generated-сборки, синхронизирует
зависимости, применяет миграции SQLite, запускает все проверки, стартует NestJS
в watch-режиме, при необходимости импортирует fixtures и открывает GraphiQL.

- GraphQL: <http://localhost:3008/graphql>
- GraphiQL: <http://localhost:3008/graphiql>

Локальная разработка останавливается через `Ctrl+C`.

## Запуск в Docker

Полный Docker-сценарий запускается одной командой:

```bash
make s-doc
```

Она освобождает порт `3008`, проверяет проект, пересобирает image без старого
build cache, запускает контейнер от непривилегированного пользователя,
дожидается `healthy`, инициализирует каталог и открывает GraphiQL. Исправный
контейнер остаётся запущенным.

- состояние контейнера: `make docker-ps`
- логи: `make docker-logs`
- остановка с сохранением SQLite: `make docker-down`

Полезные варианты:

```bash
make port-free
make s OPEN_BROWSER=0
make s-doc OPEN_BROWSER=0
make s-doc APP_PORT=3100
make help
```

Очистка сборки никогда не удаляет `.env`, `node_modules`, локальную SQLite
database или именованный Docker volume. Миграции и импорт каталога идемпотентны,
поэтому существующие данные сохраняются.

## GraphQL preview

Импорт настроенных fixtures поставщиков:

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

Для комплектных fixtures первый запуск читает три записи поставщиков, создаёт
одно каноническое лекарство, связывает три source records и возвращает два
объединённых дубликата. Повторный импорт неизменившихся данных не создаёт новые
записи.

Запрос каталога с происхождением данных:

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

В [руководстве по каталогу](docs/catalog-guide.ru.md) приведены полный ответ,
правила нормализации, расчёт GTIN, composite key и модель происхождения данных.

## Качество и безопасность

```bash
make verify
make audit-prod
make docker-config
```

`make verify` проверяет форматирование, ESLint, типы TypeScript, unit- и
integration-тесты, end-to-end тесты, циклические зависимости и
production-сборку. GitHub Actions вызывает те же Make-цели, собирает Docker
image и проверяет production-зависимости. CodeQL анализирует JavaScript и
TypeScript, а Dependabot следит за npm-, Docker- и Actions-зависимостями.

Инструменты безопасности снижают риски, но не делают приложение неуязвимым.
Подозрение на уязвимость следует отправить приватно по инструкции из
[SECURITY.md](SECURITY.md).

## Рациональное использование ресурсов

PharmaFuse использует один сервис, встроенную SQLite database,
детерминированное сопоставление, идемпотентный импорт и многостадийный container
image. Это уменьшает runtime- и операционную сложность без неподтверждённых
заявлений об экологическом эффекте.

## Документация

- [Каталог, нормализация и проверка](docs/catalog-guide.ru.md)
- [Политика безопасности](SECURITY.md)
- [Архитектурный дизайн](docs/superpowers/specs/2026-07-29-pharmacy-catalog-design.md)
- [План реализации](docs/superpowers/plans/2026-07-29-pharmacy-catalog.md)

## Автор

[Denis Gutsuliak](https://t.me/d9911/) ·
[admin@d9911.org](mailto:admin@d9911.org)

## Лицензия

[GPL-3.0-or-later](LICENSE)
