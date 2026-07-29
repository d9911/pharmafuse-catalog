.DEFAULT_GOAL := help

NPM := npm
GRAPHIFY := graphify
DOCKER_COMPOSE := docker compose
DOCKER_SERVICE := api
APP_PORT ?= 3008
OPEN_BROWSER ?= 1
GRAPH_QUERY ?= How do GraphQL catalog resolvers reach domain normalization and TypeORM persistence, and are there reverse dependencies from domain to infrastructure?
GRAPH_BUDGET ?= 3000
GRAPH_TOP ?= 10

GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
RED    := \033[0;31m
CYAN   := \033[0;36m
MAGENTA := \033[0;35m
BOLD   := \033[1m
DIM    := \033[2m
UNDERLINE := \033[4m
NC     := \033[0m

SHELL_SCRIPTS := $(shell find docker scripts -type f -name '*.sh' 2>/dev/null)

export APP_PORT

.PHONY: \
	help i setup env env-check install install-ci ci-tools deps deps-ensure audit audit-prod audit-ci \
	migrate migrate-revert \
	dev start start-prod s s-doc \
	clean-build format format-check lint lint-code lint-shell typecheck build \
	test test-unit test-integration test-e2e test-file coverage \
	cycles verify \
	graph-update graph-query graph-god-nodes graph-diagnose \
	port-free \
	docker-config docker-build docker-build-clean docker-up docker-up-ready docker-stop docker-down \
	docker-restart docker-logs docker-logs-tail docker-ps docker-health docker-smoke \
	docker-shell docker-dist docker-verify

help: ## Показать все рабочие команды проекта
	@awk 'BEGIN {FS = ":.*## "; printf "Использование: make <цель>\n\nЦели:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

i: ## Инициализировать macOS или Ubuntu окружение через NVM
	DRY_RUN="$(DRY_RUN)" bash scripts/init-environment.sh

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

env-check: ## Проверить NVM, Node.js, npm и ShellCheck без установки
	CHECK_ONLY=1 REQUIRE_DOCKER="$(REQUIRE_DOCKER)" bash scripts/init-environment.sh

install: ## Установить зависимости
	$(NPM) install

install-ci: ## Установить точные версии зависимостей из lockfile для CI
	$(NPM) ci

ci-tools: ## Установить системные инструменты проверки в Ubuntu CI
	@command -v apt-get >/dev/null 2>&1 || { \
		printf "$(RED)$(BOLD)ci-tools поддерживает только Ubuntu/Debian CI$(NC)\n"; \
		exit 1; \
	}
	sudo apt-get update
	sudo apt-get install -y shellcheck

deps: ## Проверить дерево установленных зависимостей
	$(NPM) ls --all

deps-ensure: ## Установить зависимости только при изменении lockfile
	bash scripts/ensure-dependencies.sh

audit: ## Проверить все зависимости по локальному кэшу npm audit
	$(NPM) audit --offline

audit-prod: ## Проверить production-зависимости по локальному кэшу npm audit
	$(NPM) audit --omit=dev --offline

audit-ci: ## Остановить CI при critical-уязвимостях production-зависимостей
	$(NPM) audit --omit=dev --audit-level=critical

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

s: ## Полностью проверить и запустить локальный dev на порту 3008
	APP_PORT="$(APP_PORT)" OPEN_BROWSER="$(OPEN_BROWSER)" DRY_RUN="$(DRY_RUN)" bash scripts/start-local.sh

s-doc: ## Полностью проверить и запустить Docker на порту 3008
	APP_PORT="$(APP_PORT)" OPEN_BROWSER="$(OPEN_BROWSER)" DRY_RUN="$(DRY_RUN)" bash scripts/start-docker.sh

clean-build: ## Удалить только generated build и coverage output
	rm -rf dist coverage

format: ## Исправить форматирование исходников
	$(NPM) run format

format-check: ## Проверить форматирование без изменений
	$(NPM) run format:check

lint: ## Запустить все линтеры проекта
	$(MAKE) lint-code
	$(MAKE) lint-shell

lint-code: ## Проверить TypeScript через ESLint
	$(NPM) run lint:code

lint-shell: ## Проверить shell scripts через ShellCheck
	@command -v shellcheck >/dev/null 2>&1 || { \
		printf "$(RED)$(BOLD)ShellCheck не установлен. Запустите make i.$(NC)\n"; \
		exit 1; \
	}
	shellcheck -x $(SHELL_SCRIPTS)

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

port-free: ## Освободить APP_PORT (по умолчанию 3008)
	APP_PORT="$(APP_PORT)" bash scripts/free-port.sh

docker-config: ## Проверить итоговую конфигурацию Docker Compose
	$(DOCKER_COMPOSE) config --quiet
	sh -n docker/entrypoint.sh
	node --check docker/healthcheck.mjs

docker-build: ## Собрать production Docker image
	$(DOCKER_COMPOSE) build

docker-build-clean: ## Пересобрать production Docker image без build cache
	$(DOCKER_COMPOSE) build --no-cache

docker-up: ## Собрать и запустить Docker-контейнер, дождавшись healthcheck
	$(DOCKER_COMPOSE) up -d --build --wait

docker-up-ready: ## Запустить уже собранный image и дождаться healthcheck
	$(DOCKER_COMPOSE) up -d --force-recreate --wait

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
