# Backend test coverage

Measured on 2026-10-05 with Node 24.21.0 and c8 native V8 coverage. All **141 tests passed**, including 38 additional tests for the coverage work. Lint, TypeScript checks, and the production build pass.

## Results

| Scope | Lines | Branches | Functions | Statements |
| --- | ---: | ---: | ---: | ---: |
| All configured backend source | 94.29% | 96.04% | 95.65% | 94.29% |
| Application source (`app/`) | 99.81% | 97.01% | 98.19% | 99.81% |
| Controllers | 100% | 96.77% | 100% | 100% |
| Database migrations | 100% | 100% | 100% | 100% |
| Maintenance CLI | 100% | 87.18% | 100% | 100% |

The initial baseline was 81.72% lines, 79.60% branches, and 87.67% functions overall; application source was 96.84%, 80.05%, and 95.62%, respectively.

## Scope

`.c8rc.json` still includes all source in `app`, `start`, `config`, `providers`, `database`, `scripts`, and `bin`, plus `adonisrc.ts` and `ace.js`. The `all` setting counts files never loaded as zero coverage. Tests, dependencies, build output, and TypeScript declaration files are outside this scope. Source maps attribute production child-process execution to TypeScript. No coverage exclusions or suppression comments were added to raise the percentages.

Production tests build the backend, migrate/reset/remigrate isolated temporary databases, start the real HTTP server, and terminate it gracefully. Maintenance tests execute real subprocesses for backups, scheduling, encrypted export/restore, publishing signed APKs, and invalid CLI arguments. Child processes inherit V8 coverage; the compilation process itself does not.

Lucid regenerates `database/schema.ts` during migrations. Its generated formatting is excluded from ESLint, but the file remains included in coverage. No generated code is manually edited for coverage.

## Behavior added to the test suite

- Controller category/entry edits and deletion, stale revisions, missing records, actual balances, monthly suggestions, and sync pagination/rejection isolation.
- Ledger validation and ownership, monthly planning carry-forward and revision handling, recurrence validation/correction/review, and sync deletion/conflict guards.
- Backup retention/input boundaries, encryption tampering, retry after background worker failure, APK version/signature validation, and HTML escaping.
- Real production migration lifecycle, server startup/invalid configuration, graceful shutdown, maintenance scheduling/CLI failures, and reproducible OpenAPI publication.

The migration lifecycle test exposed a reset failure: the starter authentication tables were dropped after an earlier migration had already retired them. Their rollback now uses `dropTableIfExists`; the regression test passes. The OpenAPI generator accepts an optional output path so its contract can be checked in a temporary directory.

## Remaining gaps

- Generated `database/schema.ts` and `database/schema_rules.ts` are unused by the query-builder application and remain at zero coverage.
- Starter serializer-provider methods and importer/error paths in framework entrypoints remain partially unexecuted.
- Some serializer fallbacks and controller/domain guards require unsupported legacy values or inconsistent database state.
- Alternate environment configuration, web recurrence preload error/logging paths, and maintenance scheduler's later timer ticks are not all exercised.

These gaps are retained in the report. Coverage measures execution and does not prove every behavior is correct. Source-map merging across TypeScript and production JavaScript can also affect function and branch counts.

## Reproduce and inspect

```sh
cd backend
npm ci
npm run test:coverage
```

Use Node 24 or newer. The command prints a per-file table and writes `coverage/index.html`, `coverage/coverage-summary.json`, `coverage/coverage-final.json`, and `coverage/lcov.info`. Reports are ignored by Git and excluded from Docker build context.

The command now fails if overall coverage falls below **94% lines/statements**, **95% branches**, or **95% functions**. These thresholds preserve the measured baseline across the complete configured scope.
