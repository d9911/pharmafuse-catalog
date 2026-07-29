# PharmaFuse Bootstrap Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `make i`, `make s`, `make s-doc`, and `make port-free` as safe,
colored, cross-platform environment and startup workflows for macOS and Ubuntu.

**Architecture:** Keep Makefile as the public command registry and move host
mutation, lifecycle orchestration, port cleanup, readiness, and browser opening
into focused scripts. Application configuration owns the GraphiQL enablement
flag; existing migrations and GraphQL smoke import own SQLite initialization.

**Tech Stack:** GNU/BSD Make, Bash/POSIX shell, NVM 0.40.4, Node.js 24.11.0,
npm 11.16.0, NestJS, TypeScript, Docker Compose, SQLite, Jest, ESLint, Prettier,
ShellCheck.

## Global Constraints

- Default application and host port is `3008`.
- `GRAPH_BUDGET` remains `3000`; it is not an HTTP port.
- `make i` is the only target allowed to install host packages.
- Supported hosts are macOS and Ubuntu.
- Node.js is installed and selected through NVM.
- Existing `.env`, SQLite files, WAL files, and Docker volumes are preserved.
- Every project operation exposed to users is a Makefile target.
- Start commands run the same `make verify` gate as CI.
- The chosen Prettier rules in `.prettierrc.json` are preserved.
- Shell scripts pass ShellCheck.
- No browser is opened when `OPEN_BROWSER=0`.
- No Git remote mutation is performed.

## Target File Structure

```text
.editorconfig
.nvmrc
.github/workflows/ci.yml
scripts/
├── after-start.sh
├── ensure-dependencies.sh
├── free-port.sh
├── init-environment.sh
├── open-dashboard.sh
├── start-docker.sh
├── start-local.sh
└── ui.sh
src/config/app-config.spec.ts
src/config/app-config.ts
src/app.module.ts
test/tooling.e2e-spec.ts
makefile
compose.yaml
.env.example
.gitignore
package.json
README.md
README.ru.md
```

---

### Task 1: Unified Formatting and Lint Interface

**Files:**

- Preserve/modify: `.prettierrc.json`
- Remove duplicate: `.prettierrc`
- Create: `.editorconfig`
- Create: `.nvmrc`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `makefile`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `make lint-code`, `make lint-shell`, `make ci-tools`.
- Produces: `.nvmrc` containing `24.11.0`.
- Preserves: the user's semicolon-free, single-quote, 160-column Prettier
  choices.

- [ ] **Step 1: Establish the canonical style files**

Keep `.prettierrc.json` as:

```json
{
  "tabWidth": 2,
  "useTabs": false,
  "singleQuote": true,
  "semi": false,
  "printWidth": 160,
  "trailingComma": "all",
  "arrowParens": "always",
  "bracketSpacing": true,
  "jsxSingleQuote": true,
  "endOfLine": "lf"
}
```

Delete only the duplicate `.prettierrc`. Add:

```editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[makefile]
indent_style = tab

[*.md]
trim_trailing_whitespace = false
```

Add `.nvmrc` containing `24.11.0` and ignore `.cache/`.

- [ ] **Step 2: Expand formatting and lint scripts**

Make `package.json` format every owned TS, MJS, JSON, YAML, and Markdown file.
Split TypeScript linting into `lint:code`; Makefile `lint` must call
`lint-code` and `lint-shell`.

Use:

```make
SHELL_SCRIPTS := $(shell find docker scripts -type f -name '*.sh' 2>/dev/null)

lint-code:
	$(NPM) run lint:code

lint-shell:
	@command -v shellcheck >/dev/null 2>&1 || { \
		printf "$(RED)ShellCheck не установлен. Запустите make i.$(NC)\n"; \
		exit 1; \
	}
	shellcheck $(SHELL_SCRIPTS)
```

- [ ] **Step 3: Add CI installation for ShellCheck**

Add `make ci-tools`, supporting Ubuntu only:

```make
ci-tools:
	sudo apt-get update
	sudo apt-get install -y shellcheck
```

Call it in CI before `make verify`.

- [ ] **Step 4: Apply and verify the chosen formatting**

Run:

```bash
make format
make format-check
make lint-code
```

Expected: all exit `0`. Do not claim ShellCheck success until Task 4 creates
and installs the scripts/tool.

- [ ] **Step 5: Commit**

Commit the focused style baseline:

```text
style(project): enforce unified formatting
```

---

### Task 2: Configurable GraphiQL

**Files:**

- Modify: `src/config/app-config.spec.ts`
- Modify: `src/config/app-config.ts`
- Modify: `src/app.module.ts`
- Modify: `.env.example`
- Modify: `compose.yaml`

**Interfaces:**

- Produces: `AppConfig.graphiqlEnabled: boolean`.
- Consumes: `GRAPHIQL_ENABLED=true|false`.

- [ ] **Step 1: Write failing configuration tests**

Add tests proving:

```typescript
expect(loadAppConfig({ NODE_ENV: 'development' }).graphiqlEnabled).toBe(true)
expect(loadAppConfig({ NODE_ENV: 'production' }).graphiqlEnabled).toBe(false)
expect(loadAppConfig({ NODE_ENV: 'production', GRAPHIQL_ENABLED: 'true' }).graphiqlEnabled).toBe(true)
expect(() => loadAppConfig({ GRAPHIQL_ENABLED: 'yes' })).toThrow(
  'GRAPHIQL_ENABLED must be true or false',
)
```

The production change that makes these tests pass is a validated explicit
configuration property instead of deriving GraphiQL inside `AppModule`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
make test-file FILE=src/config/app-config.spec.ts
```

Expected: FAIL because `graphiqlEnabled` does not exist and invalid text is not
rejected.

- [ ] **Step 3: Implement the minimal parser**

Add:

```typescript
function parseOptionalBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('GRAPHIQL_ENABLED must be true or false')
}
```

Set `graphiqlEnabled` from the explicit value or
`nodeEnv !== 'production'`. Use it in `AppModule`. Add
`GRAPHIQL_ENABLED=true` to Compose and the development example.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
make test-file FILE=src/config/app-config.spec.ts
make typecheck
```

Expected: both exit `0`.

- [ ] **Step 5: Commit**

```text
feat(config): make GraphiQL availability explicit
```

---

### Task 3: Environment Initialization and Dependency Synchronization

**Files:**

- Create: `scripts/ui.sh`
- Create: `scripts/init-environment.sh`
- Create: `scripts/ensure-dependencies.sh`
- Create: `test/tooling.e2e-spec.ts`
- Modify: `makefile`

**Interfaces:**

- Produces: `make i`, `make env-check`, `make deps-ensure`.
- Consumes: `.nvmrc`, `package-lock.json`, `.env.example`.
- Produces: `.cache/package-lock.sha256`.

- [ ] **Step 1: Write failing dry-run and dependency tests**

Execute scripts rather than inspecting their source:

```typescript
it.each(['Darwin', 'Linux'])('plans initialization for %s', (platform) => {
  const result = spawnSync('bash', ['scripts/init-environment.sh'], {
    env: { ...process.env, PHARMAFUSE_OS: platform, DRY_RUN: '1', NO_COLOR: '1' },
    encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('NVM')
  expect(result.stdout).toContain('Node.js 24.11.0')
})

it('rejects an unsupported host before mutation', () => {
  const result = spawnSync('bash', ['scripts/init-environment.sh'], {
    env: { ...process.env, PHARMAFUSE_OS: 'Windows_NT', DRY_RUN: '1', NO_COLOR: '1' },
    encoding: 'utf8',
  })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('Unsupported operating system')
})
```

For dependency synchronization, run the script in a temporary fixture with a
fake `npm` executable and assert that a missing marker runs `npm ci`, while a
matching marker does not.

- [ ] **Step 2: Verify RED**

Run:

```bash
make test-e2e
```

Expected: FAIL because the scripts do not exist.

- [ ] **Step 3: Implement shared colored output**

`scripts/ui.sh` defines the requested color palette plus `RED`, `CYAN`,
`MAGENTA`, `DIM`, and `UNDERLINE`. It exports:

```sh
stage() { printf '%b\n' "${BLUE}${BOLD}==> $*${NC}"; }
info() { printf '%b\n' "${CYAN}  • $*${NC}"; }
success() { printf '%b\n' "${GREEN}${BOLD}  ✓ $*${NC}"; }
warn() { printf '%b\n' "${YELLOW}${BOLD}  ! $*${NC}" >&2; }
failure() { printf '%b\n' "${RED}${BOLD}  ✗ $*${NC}" >&2; }
```

- [ ] **Step 4: Implement environment initialization**

`init-environment.sh` must:

- load official Homebrew when needed on Darwin;
- use `brew install shellcheck` and
  `brew install --cask docker-desktop` only when missing;
- use Ubuntu apt plus Docker's official apt repository when required;
- install pinned NVM from
  `https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh`;
- source NVM, install `.nvmrc`, set the default alias, and install
  `npm@11.16.0`;
- create `.env`, run `npm ci`, and write the dependency marker;
- support non-mutating `DRY_RUN=1`.

- [ ] **Step 5: Implement dependency synchronization**

Hash `package-lock.json` with `shasum -a 256` on macOS or `sha256sum` on
Ubuntu. Run `npm ci` only if `node_modules` is absent or the marker differs.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
make test-e2e
make i DRY_RUN=1
```

Expected: tests pass and dry-run reports the current platform without mutation.

- [ ] **Step 7: Commit**

```text
feat(tooling): initialize macOS and Ubuntu environments
```

---

### Task 4: Port Cleanup, Readiness, and Browser Helpers

**Files:**

- Create: `scripts/free-port.sh`
- Create: `scripts/open-dashboard.sh`
- Create: `scripts/after-start.sh`
- Modify: `test/tooling.e2e-spec.ts`
- Modify: `makefile`

**Interfaces:**

- Produces: `make port-free`.
- Consumes: `APP_PORT`, `OPEN_BROWSER`, `GRAPHQL_URL`.
- Opens: `http://localhost:${APP_PORT}/graphiql`.

- [ ] **Step 1: Write failing observable behavior tests**

Start a child Node HTTP server on an assigned test port. Run:

```typescript
spawnSync('bash', ['scripts/free-port.sh'], {
  env: { ...process.env, APP_PORT: String(port), NO_COLOR: '1' },
})
```

Assert the child exits and the port can be rebound. Add tests that:

- an unused port exits `0`;
- port `0` is rejected;
- `open-dashboard.sh` with `OPEN_BROWSER=0` exits `0` and prints the URL;
- headless Linux prints the URL instead of failing.

- [ ] **Step 2: Verify RED**

Run:

```bash
make test-e2e
```

Expected: FAIL because helper scripts are missing.

- [ ] **Step 3: Implement safe port cleanup**

Validate `1..65535`, discover only listening PIDs, print them, send `TERM`, wait
up to five seconds, send `KILL` only to remaining listeners, and recheck.

- [ ] **Step 4: Implement browser and readiness helpers**

`open-dashboard.sh` uses `open` on Darwin and `xdg-open` only with a Linux GUI.
`after-start.sh` retries `docker/healthcheck.mjs`, then runs
`docker/smoke.mjs`, then opens the dashboard. A timeout returns nonzero.

- [ ] **Step 5: Verify GREEN and ShellCheck**

Run:

```bash
make test-e2e
make lint-shell
```

Expected: both exit `0`.

- [ ] **Step 6: Commit**

```text
feat(tooling): add port and dashboard helpers
```

---

### Task 5: Local and Docker One-Command Lifecycles

**Files:**

- Create: `scripts/start-local.sh`
- Create: `scripts/start-docker.sh`
- Modify: `makefile`
- Modify: `README.md`
- Modify: `README.ru.md`

**Interfaces:**

- Produces: `make s`, `make s-doc`, `make clean-build`.
- Consumes: targets and scripts from Tasks 1-4.

- [ ] **Step 1: Add Makefile composition**

Define the requested palette in Makefile and add:

```make
i:
	bash scripts/init-environment.sh

port-free:
	APP_PORT="$(APP_PORT)" bash scripts/free-port.sh

clean-build:
	rm -rf dist coverage

s:
	bash scripts/start-local.sh

s-doc:
	bash scripts/start-docker.sh
```

Cleanup uses explicit generated paths and never includes `data`, `.env`,
`node_modules`, or Docker volumes.

- [ ] **Step 2: Implement local orchestration**

`start-local.sh` loads NVM and performs:

```text
docker-down -> port-free -> clean-build -> deps-ensure -> migrate -> verify
-> background after-start -> foreground dev
```

The background helper failure must stop the foreground dev process and return
nonzero. `Ctrl+C` returns the terminal cleanly.

- [ ] **Step 3: Implement Docker orchestration**

`start-docker.sh` loads NVM and performs:

```text
docker-down -> port-free -> clean-build -> deps-ensure -> verify
-> docker-config -> docker compose build --no-cache
-> docker compose up -d --wait -> docker-health -> docker-smoke
-> open-dashboard
```

The healthy container remains running.

- [ ] **Step 4: Document the commands**

Make the English and Russian quick starts lead with:

```bash
make i
make s
```

Document `make s-doc`, `make port-free`, `OPEN_BROWSER=0`, preserved SQLite
state, Docker volume behavior, and the GraphiQL URL.

- [ ] **Step 5: Run the full local verification**

Run:

```bash
make format
make verify
make docker-config
make deps
git diff --check
```

Expected: formatting, ESLint, ShellCheck, TypeScript, 40+ unit/integration
tests, all tooling E2E tests, existing catalog E2E tests, cycle detection,
build, Compose validation, and dependency tree all pass.

- [ ] **Step 6: Run the real Docker lifecycle**

Run:

```bash
make s-doc OPEN_BROWSER=0
make docker-smoke
make docker-down
```

Expected: image rebuilt without cache, container becomes healthy, catalog has
one medicine with three source records, and the volume is preserved.

- [ ] **Step 7: Inspect and commit**

Confirm no `.env`, database, node modules, build output, or cache marker is
staged. Commit:

```text
feat(tooling): add one-command project startup
```

Do not push.
