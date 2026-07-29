.DEFAULT_GOAL := help

NPM := npm
GRAPHIFY := graphify
DOCKER_COMPOSE := docker compose
DOCKER_SERVICE := api
APP_PORT ?= 3000
GRAPH_QUERY ?= How do GraphQL catalog resolvers reach domain normalization and TypeORM persistence, and are there reverse dependencies from domain to infrastructure?
GRAPH_BUDGET ?= 3000
GRAPH_TOP ?= 10

export APP_PORT

.PHONY: \
	help setup env install deps audit audit-prod \
	migrate migrate-revert \
	dev start start-prod \
	format format-check lint typecheck build \
	test test-unit test-integration test-e2e test-file coverage \
	cycles verify \
	graph-update graph-query graph-god-nodes graph-diagnose \
	docker-config docker-build docker-up docker-stop docker-down \
	docker-restart docker-logs docker-logs-tail docker-ps docker-health docker-smoke \
	docker-shell docker-dist docker-verify

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

docker-config: ## Проверить итоговую конфигурацию Docker Compose
	$(DOCKER_COMPOSE) config --quiet
	sh -n docker/entrypoint.sh
	node --check docker/healthcheck.mjs

docker-build: ## Собрать production Docker image
	$(DOCKER_COMPOSE) build

docker-up: ## Собрать и запустить Docker-контейнер, дождавшись healthcheck
	$(DOCKER_COMPOSE) up -d --build --wait

docker-stop: ## Остановить Docker-контейнер без удаления
	$(DOCKER_COMPOSE) stop

docker-down: ## Остановить и удалить контейнер и сеть, сохранив SQLite volume
	$(DOCKER_COMPOSE) down

docker-restart: ## Перезапустить Docker-контейнер
	$(DOCKER_COMPOSE) restart $(DOCKER_SERVICE)

docker-logs: ## Следить за логами Docker-контейнера
	$(DOCKER_COMPOSE) logs -f $(DOCKER_SERVICE)

docker-logs-tail: ## Показать последние 200 строк логов Docker-контейнера
	$(DOCKER_COMPOSE) logs --tail=200 $(DOCKER_SERVICE)

docker-ps: ## Показать состояние Docker-контейнера
	$(DOCKER_COMPOSE) ps

docker-health: ## Показать Docker health status API-контейнера
	@container_id="$$( $(DOCKER_COMPOSE) ps -q $(DOCKER_SERVICE) )"; \
	test -n "$$container_id" || { echo "Контейнер $(DOCKER_SERVICE) не запущен" >&2; exit 2; }; \
	docker inspect --format '{{.State.Health.Status}}' "$$container_id"

docker-smoke: ## Проверить GraphQL API запущенного контейнера
	GRAPHQL_URL="http://127.0.0.1:$(APP_PORT)/graphql" node docker/smoke.mjs

docker-shell: ## Открыть shell внутри API-контейнера
	$(DOCKER_COMPOSE) exec $(DOCKER_SERVICE) sh

docker-dist: ## Показать собранные JavaScript-файлы внутри Docker image
	$(DOCKER_COMPOSE) run --rm --no-deps --entrypoint sh $(DOCKER_SERVICE) \
		-c 'find dist -type f -name "*.js" | sort'

docker-verify: ## Проверить Compose, поднять контейнер и выполнить GraphQL smoke test
	$(MAKE) docker-config
	$(MAKE) docker-up
	$(MAKE) docker-health
	$(MAKE) docker-smoke
