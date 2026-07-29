# Security Policy

## Supported versions

PharmaFuse Catalog is currently in initial development. Security fixes are
provided for the latest `0.1.x` release line only.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in public issues,
discussions, pull requests, or social media.

Use
[GitHub private vulnerability reporting](https://github.com/d9911/pharmafuse-catalog/security/advisories/new)
when it is available for the repository. If that channel is unavailable, email
[admin@d9911.org](mailto:admin@d9911.org) with:

- the affected version or commit;
- a concise description of the issue and its impact;
- reproducible steps or a minimal proof of concept;
- any known mitigations;
- a safe way to contact you.

Please avoid accessing, changing, or retaining data that does not belong to
you. We will acknowledge the report, investigate it, and coordinate disclosure
through the same private channel. Response and remediation times depend on the
severity and reproducibility of the report; this document does not promise a
fixed service-level agreement.

## Security controls

The repository uses layered, verifiable controls:

- pull requests and pushes to `main` run formatting, linting, type checks,
  tests, architecture-cycle checks, a production build, a production
  dependency audit, and a Docker image build;
- CodeQL analyzes JavaScript and TypeScript changes and runs on a weekly
  schedule;
- Dependabot checks npm, Docker, and GitHub Actions dependencies weekly;
- Docker runs the application as a non-root user;
- catalog imports validate input, run inside a database transaction, retain
  source provenance, and verify fixture hashes before replacing catalog state.

These controls reduce risk but do not guarantee that the software is free of
vulnerabilities.

## Scope

Reports concerning the application source, GraphQL API, import pipeline,
SQLite persistence, container image, or repository automation are in scope.
Third-party services and provider systems that are not maintained in this
repository are out of scope.
