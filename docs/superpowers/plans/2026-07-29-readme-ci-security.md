# PharmaFuse README, CI, and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver bilingual project documentation backed by real CI, CodeQL,
Dependabot, and a responsible vulnerability-reporting policy.

**Architecture:** Keep the root READMEs concise and route detailed catalog
behavior to bilingual guides under `docs/`. GitHub automation is split by
responsibility: CI verifies the project and Docker image, CodeQL performs static
analysis, and Dependabot maintains npm, Docker, and Actions dependencies. All
project commands remain Makefile targets.

**Tech Stack:** Markdown, npm 11.16.0, GNU Make, GitHub Actions,
`actions/checkout@v7`, `actions/setup-node@v7`,
`github/codeql-action@v4`, Dependabot v2, Node.js 24, Docker Compose.

## Global Constraints

- English is the primary project language; Russian remains a complete option.
- Preserve Denis Gutsuliak's author/contributor metadata.
- Preserve GPL-3.0-or-later and end both READMEs with a `LICENSE` link.
- Use `https://github.com/d9911/pharmafuse-catalog` for repository links.
- Keep `"private": true`.
- Support Node.js `>=24.11.0 <25` and npm `>=11 <12`.
- Use port `3008` as the default for local and Docker execution.
- Do not claim absolute security, an independent audit, compliance
  certification, carbon neutrality, or measured emissions.
- Do not add a coverage badge without a real coverage publishing service.
- Run project operations through Makefile targets.
- Do not push commits or mutate remote Git settings.

---

## Target File Structure

```text
.github/
├── dependabot.yml
└── workflows/
    ├── ci.yml
    └── codeql.yml
docs/
├── catalog-guide.md
├── catalog-guide.ru.md
└── superpowers/
    ├── plans/2026-07-29-readme-ci-security.md
    └── specs/2026-07-29-readme-ci-security-design.md
README.md
README.ru.md
SECURITY.md
makefile
package.json
package-lock.json
```

---

### Task 1: Package Metadata and CI Makefile Interface

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `makefile`
- Modify:
  `docs/superpowers/specs/2026-07-29-readme-ci-security-design.md`

**Interfaces:**

- Produces: `make install-ci` for deterministic CI installation.
- Produces: `make audit-ci` for production audit with a critical failure
  threshold.
- Preserves: existing local and Docker targets.

- [ ] **Step 1: Correct and enrich package metadata**

Set:

```json
{
  "packageManager": "npm@11.16.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/d9911/pharmafuse-catalog.git"
  },
  "keywords": ["pharmacy", "catalog", "normalization", "deduplication", "provenance", "graphql", "nestjs", "sqlite", "clean-architecture"],
  "directories": {
    "doc": "docs",
    "test": "test"
  }
}
```

Keep the existing author, contributors, license, bugs, homepage, engines,
scripts, and dependencies.

- [ ] **Step 2: Add CI-specific Makefile targets**

Add:

```make
install-ci: ## Install exact lockfile dependencies for CI
	$(NPM) ci

audit-ci: ## Fail CI only when production dependencies contain critical findings
	$(NPM) audit --omit=dev --audit-level=critical
```

Add both targets to `.PHONY`. Do not replace the existing offline audit
targets.

- [ ] **Step 3: Correct the CodeQL design after primary-source verification**

Change the design statement from a Makefile-driven CodeQL build to
`build-mode: none`. GitHub's official CodeQL documentation states that
interpreted JavaScript/TypeScript must use `none`; CI remains responsible for
the real `make build`.

- [ ] **Step 4: Synchronize the lockfile and inspect metadata**

Run:

```bash
make install
make deps
```

Expected:

- both commands exit `0`;
- the root package is `pharmafuse-catalog@0.1.0`;
- no invalid peer dependency is reported.

---

### Task 2: GitHub CI, CodeQL, Dependabot, and Security Policy

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/codeql.yml`
- Create: `.github/dependabot.yml`
- Create: `SECURITY.md`

**Interfaces:**

- Consumes: `make install-ci`, `make verify`, `make docker-config`,
  `make docker-build`, and `make audit-ci`.
- Produces: workflow badge URLs named `ci.yml` and `codeql.yml`.

- [ ] **Step 1: Add the CI workflow**

Create `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Verify and build
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - name: Check out repository
        uses: actions/checkout@v7
      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - name: Install dependencies
        run: make install-ci
      - name: Verify application
        run: make verify
      - name: Validate Docker configuration
        run: make docker-config
      - name: Audit production dependencies
        run: make audit-ci
      - name: Build production image
        run: make docker-build
```

- [ ] **Step 2: Add CodeQL**

Create `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '23 4 * * 1'
  workflow_dispatch:

permissions:
  contents: read
  security-events: write

concurrency:
  group: codeql-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  analyze:
    name: Analyze JavaScript and TypeScript
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Check out repository
        uses: actions/checkout@v7
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: javascript-typescript
          build-mode: none
      - name: Perform CodeQL analysis
        uses: github/codeql-action/analyze@v4
        with:
          category: /language:javascript-typescript
```

- [ ] **Step 3: Add weekly Dependabot updates**

Create `.github/dependabot.yml` with three weekly ecosystems:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '05:00'
      timezone: UTC
    target-branch: main
    open-pull-requests-limit: 5
    groups:
      npm-minor-and-patch:
        patterns: ['*']
        update-types: ['minor', 'patch']

  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '05:30'
      timezone: UTC
    target-branch: main
    open-pull-requests-limit: 3

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '06:00'
      timezone: UTC
    target-branch: main
    open-pull-requests-limit: 3
```

- [ ] **Step 4: Add the responsible disclosure policy**

Create `SECURITY.md` in English with:

- a `0.1.x` supported-version table;
- a private-advisory link to
  `https://github.com/d9911/pharmafuse-catalog/security/advisories/new`;
- fallback email `admin@d9911.org`;
- requested report fields: version, reproduction, impact, logs with secrets
  removed, and suggested mitigation;
- a coordinated-disclosure request;
- no guaranteed response SLA;
- a statement that public issues must not contain undisclosed vulnerabilities.

- [ ] **Step 5: Validate the configuration files**

Run:

```bash
make format
make format-check
make docker-config
```

Expected: all commands exit `0`.

---

### Task 3: Bilingual Catalog Guides

**Files:**

- Create: `docs/catalog-guide.md`
- Create: `docs/catalog-guide.ru.md`
- Source: current staged `README.md`

**Interfaces:**

- Produces: stable documentation targets linked by both root READMEs.
- Preserves: the verified normalization arithmetic and GraphQL contracts.

- [ ] **Step 1: Write the English catalog guide**

Use these headings in order:

```markdown
# PharmaFuse Catalog Guide

## Provider fixtures

## Importing the catalog

## Reading the catalog

## Normalization and deterministic matching

## GTIN validation

## Idempotency and provenance

## Clean Architecture boundaries

## Verification and Graphify
```

Include the complete mutation and query from the current README. Preserve:

```text
3 provider records
- 1 canonical medicine
= 2 merged duplicates
```

Document the composite key exactly:

```text
normalizedName
|normalizedManufacturer
|dosageMicrograms
|dosageForm
|packageSize
|countryCode
```

- [ ] **Step 2: Write the equivalent Russian guide**

Use the same commands, paths, field names, examples, and section order in
`docs/catalog-guide.ru.md`. Add language links at the top of both guide files.

- [ ] **Step 3: Check factual parity**

Run:

```bash
rg -n "providerRecordsRead|05050123456789|normalizedManufacturer|make graph-query" docs/catalog-guide.md docs/catalog-guide.ru.md
```

Expected: every searched contract appears in both files.

---

### Task 4: English Primary README and Russian Alternative

**Files:**

- Replace: `README.md`
- Create: `README.ru.md`

**Interfaces:**

- Consumes: workflow filenames, `SECURITY.md`, bilingual guides, Makefile
  targets, package engine ranges.
- Produces: the public repository landing page and Russian language switch.

- [ ] **Step 1: Write the English README**

Start with:

```markdown
# PharmaFuse

**English** | [Русский](README.ru.md)

[![CI](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/ci.yml)
[![CodeQL](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml/badge.svg)](https://github.com/d9911/pharmafuse-catalog/actions/workflows/codeql.yml)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![License: GPL v3+](https://img.shields.io/badge/License-GPL_v3%2B-blue.svg)](LICENSE)
```

Follow with these headings:

```markdown
## What PharmaFuse does

## Architecture

## Requirements

## Quick start with Docker

## Local development

## GraphQL preview

## Quality gates

## Security

## Lean by design

## Documentation

## Author

## License
```

Requirements must distinguish Docker and local workflows. The GraphQL preview
must stay short and link to `docs/catalog-guide.md`. Security must link to
`SECURITY.md` and describe controls as risk reduction, not a guarantee.

End with:

```markdown
## License

[GNU General Public License v3.0 or later](LICENSE)
```

- [ ] **Step 2: Write the Russian README**

Mirror the English structure and facts. Start with:

```markdown
# PharmaFuse

[English](README.md) | **Русский**
```

Use the same badges and finish with the same `LICENSE` target.

- [ ] **Step 3: Verify language links and prohibited claims**

Run:

```bash
rg -n "README.ru.md|SECURITY.md|catalog-guide.md|GNU General Public License" README.md
rg -n "README.md|SECURITY.md|catalog-guide.ru.md|GNU General Public License" README.ru.md
rg -ni "unhackable|impossible to hack|carbon neutral|independently audited|100% secure" README.md README.ru.md SECURITY.md
```

Expected:

- required links are present;
- the prohibited-claim search returns no matches.

---

### Task 5: Final Verification and Focused Commit

**Files:**

- Verify all files from Tasks 1-4.
- Preserve the existing design commit.

**Interfaces:**

- Produces: one locally committed implementation changeset.

- [ ] **Step 1: Run the full local verification**

Run:

```bash
make verify
make docker-config
make docker-build
make deps
```

Expected:

- 40 or more unit/integration tests pass;
- 2 e2e tests pass;
- TypeScript, ESLint, Prettier, cycle detection, and build pass;
- Docker Compose, entrypoint, healthcheck, and image build pass;
- dependency tree exits `0`.

- [ ] **Step 2: Inspect the final changes**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm:

- the user's author and GPL changes remain;
- workflow badge filenames match actual workflow files;
- repository metadata matches `origin`;
- no `.env`, SQLite database, build output, or dependency directory is staged.

- [ ] **Step 3: Create the implementation commit**

Stage only the intended documentation, metadata, Makefile, GitHub, and security
files, then commit:

```text
docs(project): add bilingual README and security automation
```

Do not push.
