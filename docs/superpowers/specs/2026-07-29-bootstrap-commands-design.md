# PharmaFuse Bootstrap Commands Design

## Goal

Provide three memorable Makefile entry points:

- `make i` prepares a macOS or Ubuntu development environment;
- `make s` rebuilds, verifies, initializes, and starts local development;
- `make s-doc` rebuilds, verifies, initializes, and starts Docker.

The commands must use port `3008`, preserve existing SQLite data, populate an
empty catalog, open GraphiQL, and report every stage with readable colored
output.

## Public Makefile Interface

### `make i`

`make i` is the only command authorized to modify the host environment. It:

1. identifies supported hosts: Darwin or Ubuntu;
2. installs missing platform tools;
3. installs NVM `v0.40.4` for the current user;
4. installs and selects the Node.js version from `.nvmrc`;
5. installs npm `11.16.0`;
6. installs Docker with Compose when it is absent;
7. installs ShellCheck;
8. creates `.env` without overwriting an existing file;
9. installs exact project dependencies from `package-lock.json`;
10. prints detected versions and a final environment summary.

On macOS, the command uses Homebrew and the `docker-desktop` cask. It may open
Docker Desktop and wait for the daemon. If Homebrew is missing, the official
Homebrew installer is used.

On Ubuntu, the command uses `sudo apt` for base tools and Docker's official apt
repository for Docker Engine, Buildx, and the Compose plugin. When the current
user is newly added to the `docker` group, the command reports that a new login
session is required before Docker can be used without `sudo`.

The command is idempotent: suitable installed tools are reused.

### `make s`

`make s` performs the local development lifecycle:

1. verifies that the environment initialized by `make i` is usable;
2. stops the project's Docker Compose stack;
3. invokes `make port-free`;
4. removes generated build and coverage output, but not SQLite or
   `node_modules`;
5. installs project dependencies only when missing or out of sync with the
   lockfile;
6. applies TypeORM migrations to SQLite;
7. runs the complete quality gate;
8. starts NestJS in watch mode in the foreground;
9. waits for GraphQL readiness in a background helper;
10. runs the idempotent catalog import/smoke check;
11. opens `http://localhost:3008/graphiql`.

`Ctrl+C` stops the local development process. Any readiness, import, or quality
failure prints a red error and returns a nonzero status.

### `make s-doc`

`make s-doc` performs the Docker lifecycle:

1. verifies the initialized environment;
2. stops and removes the previous project container and network;
3. invokes `make port-free`;
4. removes generated local output;
5. synchronizes project dependencies when required;
6. runs the complete quality gate;
7. validates Compose and shell scripts;
8. rebuilds the production image without the previous Docker build cache;
9. starts the container and waits for `healthy`;
10. runs the idempotent GraphQL import/smoke check;
11. opens `http://localhost:3008/graphiql`;
12. leaves the healthy container running.

The named `pharmafuse-data` volume is preserved.

### `make port-free`

`make port-free` operates only on `APP_PORT`, whose default is `3008`. It:

1. validates that the value is a TCP port;
2. discovers listening process IDs through `lsof` on macOS and `lsof` or
   `fuser` on Ubuntu;
3. prints the process IDs before changing them;
4. sends `TERM` and waits;
5. sends `KILL` only to remaining listeners;
6. verifies that the port is free.

This command is intentionally separate and is reused by both start commands.

## SQLite Initialization

Generated build cleanup never deletes:

- `data/pharmacy.sqlite`;
- SQLite WAL or shared-memory files;
- the Docker named volume.

TypeORM migrations create or update the schema. Once the API is ready, the
existing smoke client calls `importCatalog`. Its payload hashes and uniqueness
rules make repeated imports idempotent, so an empty database receives the
fixture catalog and an initialized database retains one medicine with three
source records.

## GraphiQL in Docker

GraphiQL is currently derived only from `NODE_ENV`, which disables it in the
production container. Add a validated `GRAPHIQL_ENABLED` configuration value:

- local development defaults to enabled;
- production defaults to disabled;
- Compose explicitly enables it for this preview project;
- invalid boolean text fails configuration loading.

The GraphQL API remains at `/graphql`; the browser dashboard is `/graphiql`.

## Environment and Dependency State

Add `.nvmrc` with the minimum supported Node.js 24 release used by the project.
NVM is loaded explicitly inside scripts because `nvm` is a shell function, not
an executable.

Project dependency synchronization uses a lockfile hash marker under a
gitignored cache directory:

- missing `node_modules` triggers `npm ci`;
- a changed `package-lock.json` triggers `npm ci`;
- an unchanged installation is reused.

The marker is written only after a successful install.

## Style and Static Analysis

The repository uses one quality interface:

- ESLint validates TypeScript;
- Prettier validates TypeScript, JavaScript, JSON, YAML, and Markdown;
- ShellCheck validates project shell scripts;
- `.editorconfig` defines UTF-8, LF line endings, final newlines, and indentation
  defaults.

The concurrently added `.prettierrc` and `.prettierrc.json` contain the same
rules. Preserve those chosen style values, keep `.prettierrc.json` as the
canonical configuration already tracked by the project, and remove the
duplicate filename so the two copies cannot drift.

Expose focused Make targets such as `lint-code`, `lint-shell`, and
`format-check`, while `make lint` and `make verify` run the complete relevant
set. GitHub CI continues to call `make verify`, so local start commands and CI
enforce the same rules.

## Output Design

The Makefile defines the requested variables:

```make
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
BOLD   := \033[1m
NC     := \033[0m
```

It also defines red, cyan, magenta, dim, and underline variants. Shared shell
helpers provide consistent:

- blue stage headings;
- cyan informational messages;
- yellow warnings;
- green success summaries;
- red failure summaries.

Colors are disabled automatically when output is not attached to a terminal or
when `NO_COLOR` is present.

## Browser Behavior

The browser helper uses:

- `open` on macOS;
- `xdg-open` on Ubuntu with a graphical session.

On a headless Ubuntu host it prints the underlined GraphiQL URL without treating
the missing GUI as an application failure. `OPEN_BROWSER=0` disables automatic
opening for automation.

## Implementation Boundaries

Keep platform and orchestration logic in small POSIX-shell scripts under
`scripts/`. The Makefile remains the public command registry and composes those
scripts. No application-domain code depends on bootstrap tooling.

Correct `GRAPH_BUDGET` back to `3000`: it is a Graphify token budget and is not
related to the HTTP port.

## Testing

Use test-driven development for observable behavior:

- configuration tests cover GraphiQL defaults, overrides, and invalid input;
- script tests execute helpers with controlled temporary state and fake command
  adapters, verifying OS routing, dependency decisions, port cleanup, readiness,
  browser fallback, and failure exit codes;
- Makefile targets run ShellCheck and existing application tests;
- final verification runs `make verify`, `make docker-config`, a real
  `make s-doc` smoke path with browser opening disabled, and a controlled local
  readiness path.

Tests must not install host packages, kill unrelated real processes, open a
browser, or delete a real SQLite database.

## Safety and Failure Handling

- Unsupported operating systems fail before mutation.
- Downloaded installer scripts use pinned or official upstream URLs.
- Host package installation is isolated to `make i`.
- Cleanup targets name explicit generated directories.
- Port cleanup targets only the configured listener PIDs.
- Existing `.env`, SQLite files, and Docker volumes are preserved.
- Every script uses strict error handling and returns a nonzero exit code on a
  failed required stage.
- No remote Git operation is performed.
