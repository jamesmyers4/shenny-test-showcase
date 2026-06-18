# Test Suite Showcase

The automated test suite extracted from **Shenny**, a production full-stack web/mobile
application (Next.js, TypeScript, React Native) built solo. Shenny is a documentation
and AI-analysis application: users capture timestamped records, and an AI layer analyzes
them. This repo is a **read-quality showcase** of the testing approach — the test code
is real, but it was written against the live application and is **not** clone-and-run.
See [Running this](#running-this).

## What this demonstrates

- **Multi-layer test strategy** — five complementary layers covering the full stack:
  browser flows, API contracts, database integrity, load behavior, and BDD documentation.
  (`tests/e2e/`, `src/__tests__/api/`, `src/__tests__/db/`, `tests/load/`, `tests/cucumber/`)
- **Playwright Page Object Model** — every screen wrapped in a typed page object so specs
  read as intent, not selectors. (`tests/e2e/pages/`)
- **Vitest API-route testing against a Next.js backend** — a lightweight HTTP harness
  loads route handlers and exercises real request/response contracts.
  (`src/__tests__/helpers/server.ts`, `src/__tests__/api/`)
- **Prisma-layer DB integration tests** — eight Vitest files hit a real isolated database
  directly with no HTTP layer, asserting on schema integrity, ownership enforcement,
  soft-delete contracts, and tamper-detection invariants. (`src/__tests__/db/`)
- **Testing of AI-pipeline output** — the non-deterministic model layer is mocked at its
  boundary and asserted on structure, not wording.
  (`src/__tests__/mocks/`, `src/__tests__/api/message-analysis.test.ts`)
- **Accessibility coverage** — automated WCAG 2.1 AA scans (axe-core) plus keyboard,
  focus, and ARIA specs. (`tests/e2e/accessibility.spec.ts`, and the keyboard/focus/aria specs)
- **BDD / Gherkin suite** — 109 Cucumber scenarios across 20 feature files mirroring the
  E2E suite, serving as living documentation over every UI flow. (`tests/cucumber/`)
- **Load testing** — k6 scenarios covering rate-limiter correctness, auth bypass attempts,
  entry throughput, and AI route response times under concurrent load. (`tests/load/`)

## Test strategy

The suite is layered by what each layer is best at catching, and by cost. **API-contract
tests** (Vitest + Supertest) own the bulk of the logic coverage: auth boundaries, input
validation, ownership enforcement (every mutation is verified to reject cross-user access),
status codes, and billing-webhook state transitions. They run against a real isolated test
database so the assertions reflect actual persistence behavior, while external services
(the model API, payments, email, object storage) are mocked at the module boundary so runs
are deterministic and free. **E2E tests** (Playwright) are reserved for things that only
break in a real browser — multi-step flows, redirects and route guards, rendering, and
keyboard/focus behavior — and use a Page Object Model so a UI change touches one file, not
fifty specs. Anything cheaper to verify below the browser is pushed down a layer; E2E is
spent only where it earns its keep.

The most deliberate part is **testing non-deterministic AI output**. The model is never
called in CI — it is mocked at its SDK boundary with fixtures shaped exactly like real
responses, which keeps runs deterministic and removes cost and flakiness from the critical
path. Assertions then target _structure and contract_ rather than exact text: that a tone
evaluation returns one of a fixed enum, that an analysis result carries the required fields
with a score in range, that a cache key short-circuits a second identical request so the
model is not called twice. The judgment is that for an LLM feature, the test's job is to
prove the surrounding pipeline — parsing, validation, caching, persistence, gating — is
correct for any well-formed model response, and to leave the open-ended quality of the
prose itself to separate human and sampling review rather than brittle string matching.

## Test layers

**API contract tests** (`src/__tests__/api/`) — the primary logic layer. Architecture
and design rationale covered under [Test strategy](#test-strategy) above.

**DB integration tests** (`src/__tests__/db/`) sit below the HTTP layer entirely. Eight
Vitest files hit a real isolated test database directly via Prisma — no route handler, no
HTTP server. The layer covers schema integrity and factory defaults, Prisma-level ownership
enforcement (queries scoped by `userId` that must never cross user boundaries regardless of
route logic), soft-delete behavior and its cascade contracts, billing cap aggregation and
audit trail persistence, and the tamper-detection hash invariant: `entryHash`, once set,
must survive subsequent updates to any other field unchanged.

**Load tests** (`tests/load/`) use k6 v2.0.0. Four scenarios target a running app instance
with no mocking: rate-limiter correctness under spike load (100 VUs, 30-second hold), auth
bypass attempts across three strategies against multiple routes, steady-state entry
throughput, and AI route response times under concurrent pressure. Rate-limiter and auth
scenarios assert on correct gating behavior — 429s and 401s are treated as passes, not
failures.

**BDD / Cucumber** (`tests/cucumber/`) mirrors the E2E suite feature-for-feature in
Gherkin. The same Playwright browser automation runs underneath — `world.ts` initialises a
Chromium context per scenario — with the Cucumber runner on top. 109 scenarios across 20
feature files cover every domain in the E2E suite: auth, onboarding, entries, recordings,
message analysis, insight reports, billing, exports, cases, access grants, accessibility,
and keyboard navigation. The Gherkin layer serves as living documentation and a stable
English-language contract over the UI flows.

## Repo structure

tests/e2e/
\*.spec.ts E2E specs (flows, access, billing, a11y, keyboard/focus/aria)
pages/ Page Object Model — one class per screen
fixtures/ Synthetic, obviously-fake test data
helpers/ DB seeding, API helpers, axe wrapper
setup/ Auth fixture + global setup
tests/cucumber/
features/ Gherkin feature files — 1 per e2e spec (20 total)
steps/ Step definition files — 1 per feature (20 total)
support/ world.ts, hooks.ts, cucumber.config.ts
tests/load/
scenarios/ k6 scenario files (rate-limiter, entries, auth, ai-routes)
helpers/ Auth header helper
config.ts Shared thresholds and stage configs
src/**tests**/
api/ Vitest + Supertest API-route contract tests
db/ Vitest DB integration tests (Prisma layer, no HTTP)
helpers/ Test HTTP server, supertest client, auth mock
mocks/ Module-boundary mocks (AI SDK)
globalSetup.ts / globalTeardown.ts
vitest.config.ts playwright.config.ts jest.config.ts tsconfig.json package.json
docker-compose.yml .github/workflows/test-full.yml

## Running this

This is a read-quality showcase, not a runnable project. The E2E and API tests were written
against the live application, its database schema, and its runtime environment; many files
import from the application's own source (`@/lib/...`), which is not included here, so those
imports will not resolve. No environment configuration, service credentials, or connection
details are included — by design. Nothing in this repo is intended to run standalone; it is
published to show test architecture, layering, and judgment, not to execute.

## Tooling

Playwright (E2E + accessibility via axe-core), Vitest + Supertest (API-route contract
tests), Vitest + Prisma (DB integration tests), k6 v2.0.0 (load tests),
Cucumber/Gherkin (BDD suite), TypeScript throughout. The tests exercise Next.js route
handlers, authenticated flows (Clerk, mocked at the boundary), Stripe billing webhooks,
AI-analysis pipelines (Anthropic SDK, mocked at the boundary), and Prisma ORM behavior
against a real Neon Postgres test database.

---

Built by James Myers
