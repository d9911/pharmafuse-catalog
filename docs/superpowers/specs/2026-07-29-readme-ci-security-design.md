# PharmaFuse README, CI, and Security Design

**Date:** 2026-07-29
**Status:** Approved design, pending implementation
**Repository:** `https://github.com/d9911/pharmafuse-catalog`

## 1. Goal

Present PharmaFuse as a credible, easy-to-run open-source backend project while
making its quality and security statements verifiable. English is the primary
project language, Russian remains available as a complete alternative, and
GitHub badges must point to checks that actually exist.

## 2. Scope

The implementation will:

- replace the current Russian-first `README.md` with an English primary README;
- add `README.ru.md` with equivalent Russian content and language navigation;
- move detailed GraphQL, normalization, matching, and provenance material into
  dedicated catalog documentation;
- add GitHub Actions CI, CodeQL, Dependabot, and `SECURITY.md`;
- align `package.json` metadata with the actual Git remote and current runtime;
- preserve the author's metadata, GPL-3.0-or-later declaration, and the license
  link at the end of both READMEs;
- keep all developer and Docker commands behind Makefile targets.

This work will not claim that the project is impossible to compromise, carbon
neutral, independently audited, or compliant with a security standard.

## 3. Documentation Structure

### 3.1 Primary README

`README.md` will be concise, English-first, and structured as follows:

1. Project name, one-sentence value proposition, and language switch.
2. Verifiable badges:
   - CI workflow status;
   - CodeQL workflow status;
   - Node.js 24;
   - Docker;
   - TypeScript;
   - GPL-3.0-or-later.
3. Core capabilities.
4. Architecture summary.
5. Environment requirements.
6. Docker quick start.
7. Local development quick start.
8. Minimal GraphQL import and catalog examples.
9. Testing and quality gates.
10. Security model and vulnerability reporting link.
11. Sustainability statement.
12. Documentation index.
13. Author and license.

Badges will not advertise coverage, build passing, security review, or package
publication unless a real source exists for that claim.

### 3.2 Russian README

`README.ru.md` will mirror the English README's meaning and section order. Both
files will begin with links to the other language:

```text
English | Русский
```

Commands, paths, API field names, and numerical examples must remain identical
between languages.

### 3.3 Detailed catalog documentation

Long material currently in `README.md` will be retained in:

- `docs/catalog-guide.md` — English;
- `docs/catalog-guide.ru.md` — Russian.

The guides will contain:

- provider fixture locations;
- the full `importCatalog` mutation and catalog query;
- the verified `3 records -> 1 medicine -> 2 merged duplicates` arithmetic;
- idempotent re-import behavior;
- GTIN validation behavior;
- the composite matching key;
- provenance and raw/normalized payload storage;
- Clean Architecture dependency direction;
- Graphify commands.

The existing design and implementation-plan documents remain unchanged except
for links when necessary.

## 4. Environment Requirements

The README and `package.json` will describe two supported workflows.

### Docker workflow

- Docker Engine, Docker Desktop, or OrbStack with Docker Compose v2;
- GNU Make;
- an available host port, default `3000`.

### Local workflow

- Node.js `>=24.11.0 <25`;
- npm `>=11 <12`;
- GNU Make;
- a native compiler toolchain only when npm cannot obtain a compatible
  prebuilt `better-sqlite3` binary;
- Graphify only for optional architecture graph commands.

The SQLite CLI is not a runtime prerequisite because the application uses the
embedded `better-sqlite3` driver.

## 5. Package Metadata

Existing author, contributor, license, bugs, and homepage data will be
preserved. The following corrections and additions are planned:

- set `repository.url` to
  `git+https://github.com/d9911/pharmafuse-catalog.git`, matching `origin`;
- retain `"private": true` and `"license": "GPL-3.0-or-later"`;
- add the verified npm package-manager declaration;
- add focused discovery keywords for NestJS, GraphQL, SQLite, pharmacy catalog
  normalization, deduplication, provenance, and Clean Architecture;
- add `directories` metadata for documentation and tests;
- keep Node/npm engine ranges as the authoritative local runtime contract.

No publication configuration will be added while the package remains private.

## 6. GitHub Actions CI

`.github/workflows/ci.yml` will run on:

- pushes to `main`;
- pull requests targeting `main`;
- manual dispatch.

The workflow will use one current Ubuntu runner and Node.js 24 with npm cache.
All project operations will call Makefile targets:

1. deterministic dependency installation through a new `make install-ci`;
2. `make verify`;
3. `make docker-config`;
4. `make docker-build`;
5. a production dependency audit that fails on critical findings while still
   exposing lower-severity findings in logs.

The implementation must verify current supported major versions of official
GitHub actions against GitHub documentation before pinning workflow references.

## 7. CodeQL

`.github/workflows/codeql.yml` will analyze JavaScript/TypeScript on:

- pushes to `main`;
- pull requests targeting `main`;
- a weekly scheduled run;
- manual dispatch.

The workflow will use GitHub's CodeQL initialization, a Makefile-driven build,
and CodeQL analysis. It will request only the permissions needed to read source
and upload security results.

The CodeQL badge in the README will link to this workflow. CodeQL will be
described as static analysis, not as proof that the application has no
vulnerabilities.

## 8. Dependabot

`.github/dependabot.yml` will check weekly for:

- npm dependencies;
- Docker base-image updates;
- GitHub Actions updates.

Updates will target `main`, use bounded open-pull-request limits, and group
compatible patch/minor npm updates where supported. Major updates remain
separate so their compatibility can be reviewed explicitly.

## 9. Security Policy

`SECURITY.md` will:

- identify the currently supported `0.1.x` line;
- direct reporters to GitHub private security advisories;
- provide the author's published email as a fallback;
- request reproduction steps, affected versions, impact, and suggested
  mitigations when available;
- ask for coordinated disclosure;
- avoid promising a response SLA that the project cannot guarantee.

The README security section will link to this policy and list implemented
controls:

- strict input validation;
- deterministic matching instead of fuzzy auto-merging;
- transactional SQLite writes and foreign keys;
- provenance and payload hashing;
- non-root Docker runtime;
- automated tests, dependency updates, and CodeQL.

These controls reduce risk; they do not make the service unhackable.

## 10. Sustainability Statement

The project will use the heading **Lean by design** rather than claim certified
eco-friendliness. The statement may factually describe:

- a single deployable backend service;
- embedded SQLite for the supplied workload;
- multi-stage Docker builds;
- deterministic and idempotent imports that avoid duplicate storage.

It will not make numerical energy or emissions claims because the repository
contains no measurement supporting them.

## 11. Verification

Implementation is acceptable when:

- English and Russian READMEs link to each other and end with the GPL license
  link;
- Markdown links resolve to repository files or confirmed GitHub URLs;
- workflow badges match real workflow filenames;
- YAML and project formatting checks pass;
- `package.json` and the lockfile remain valid;
- `make verify` passes;
- `make docker-config` passes;
- `make docker-build` succeeds;
- workflow files invoke project operations through Makefile targets;
- no README statement claims absolute security, certification, measured
  sustainability, or unverified test coverage.

## 12. Commit Boundaries

The implementation should produce one focused commit:

```text
docs(project): add bilingual README and security automation
```

The commit will include documentation, package metadata, Makefile targets,
GitHub workflows, Dependabot configuration, and `SECURITY.md`. It will not push
to the remote repository.
