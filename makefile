.DEFAULT_GOAL := help

NPM := npm
GRAPHIFY := graphify
GRAPH_QUERY ?= How do GraphQL catalog resolvers reach domain normalization and TypeORM persistence, and are there reverse dependencies from domain to infrastructure?
GRAPH_BUDGET ?= 3000
GRAPH_TOP ?= 10

.PHONY: \
	help setup env install deps audit audit-prod \
	migrate migrate-revert \
	dev start start-prod \
	format format-check lint typecheck build \
	test test-unit test-integration test-e2e test-file coverage \
	cycles verify \
	graph-update graph-query graph-god-nodes graph-diagnose

help: ## Показать все рабочие команды проекта
	@awk 'BEGIN {FS = ":.*## "; printf "Использование: make <цель>\n\nЦели:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Подготовить окружение, установить зависимости и применить миграции
	$(MAKE) env
	$(MAKE) install
	$(MAKE) migrate

env: ## Создать .env из .env.example, не перезаписывая существующий файл
	@if [ -f .env ]; then \
		echo ".env уже существует"; \
	else \
		cp .env.example .env; \
		echo ".env создан из .env.example"; \
	fi

install: ## Установить зависимости
	$(NPM) install

deps: ## Проверить дерево установленных зависимостей
	$(NPM) ls --all

audit: ## Проверить все зависимости по локальному кэшу npm audit
	$(NPM) audit --offline

audit-prod: ## Проверить production-зависимости по локальному кэшу npm audit
	$(NPM) audit --omit=dev --offline

migrate: ## Применить миграции SQLite (опционально DATABASE_PATH=...)
	@if [ -n "$(DATABASE_PATH)" ]; then \
		DATABASE_PATH="$(DATABASE_PATH)" $(NPM) run migration:run; \
	else \
		$(NPM) run migration:run; \
	fi

migrate-revert: ## Откатить последнюю миграцию SQLite (опционально DATABASE_PATH=...)
	@if [ -n "$(DATABASE_PATH)" ]; then \
		DATABASE_PATH="$(DATABASE_PATH)" $(NPM) run migration:revert; \
	else \
		$(NPM) run migration:revert; \
	fi

dev: ## Запустить приложение в watch-режиме
	$(NPM) run start:dev

start: ## Запустить приложение
	$(NPM) run start

start-prod: ## Запустить собранное приложение
	$(NPM) run start:prod

format: ## Исправить форматирование исходников
	$(NPM) run format

format-check: ## Проверить форматирование без изменений
	$(NPM) run format:check

lint: ## Запустить ESLint
	$(NPM) run lint

typecheck: ## Проверить типы TypeScript
	$(NPM) run typecheck

build: ## Собрать приложение
	$(NPM) run build

test: ## Запустить все unit и integration тесты
	$(NPM) run test

test-unit: ## Запустить unit-тесты
	$(NPM) run test:unit

test-integration: ## Запустить integration-тесты
	$(NPM) run test:integration

test-e2e: ## Запустить end-to-end тесты
	$(NPM) run test:e2e

test-file: ## Запустить выбранный тест или каталог: make test-file FILE=путь
	@test -n "$(FILE)" || { echo "Укажите FILE, например: make test-file FILE=src/modules/catalog/domain" >&2; exit 2; }
	$(NPM) test -- "$(FILE)"

coverage: ## Запустить тесты с отчётом о покрытии
	$(NPM) run test:cov

cycles: ## Проверить циклические зависимости модулей
	$(NPM) run architecture:cycles

verify: ## Последовательно выполнить полную локальную проверку
	$(MAKE) format-check
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) test-e2e
	$(MAKE) cycles
	$(MAKE) build

graph-update: ## Построить или обновить архитектурный граф
	$(GRAPHIFY) update . --no-cluster

graph-query: ## Запросить архитектурный граф (опционально GRAPH_QUERY=... GRAPH_BUDGET=...)
	$(GRAPHIFY) query "$(GRAPH_QUERY)" --budget "$(GRAPH_BUDGET)"

graph-god-nodes: ## Показать наиболее связанные узлы графа (опционально GRAPH_TOP=...)
	$(GRAPHIFY) god-nodes --top "$(GRAPH_TOP)"

graph-diagnose: ## Проверить граф на дублирующиеся связи
	$(GRAPHIFY) diagnose multigraph
