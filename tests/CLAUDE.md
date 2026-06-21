# CLAUDE.md — E2E and API Test Scrub

## Context

This is a public read-quality showcase repo for a production test suite. The README.md
in this repo is the source of truth for what this project is, how it's structured, and
how it should read to a technical audience. Read it fully before starting work.

The two folders being added in this session — tests/e2e/ and src/**tests**/api/ — are
described in the README under "Test layers" and "Repo structure". Use those descriptions
to understand what each file is supposed to do and how it should present to a reader.

## Already-Scrubbed Reference

The following folders are already public-safe and committed. Use them as the pattern
reference for what clean files look like in this repo:

- tests/cucumber/ — mirrors tests/e2e/ feature-for-feature; same Playwright automation
  underneath, same domain coverage
- src/**tests**/db/ — sits in the same **tests** tree as api/; same Vitest patterns,
  same process.env credential approach

When in doubt about how a credential, URL, or app reference should look after scrubbing,
find the equivalent pattern in cucumber/ or db/ and match it exactly.

## What to Scrub

### Credentials

- Hardcoded Clerk user IDs, secret keys, publishable keys → process.env references
- Real email addresses (test users, seed accounts) → process.env.TEST_USER_EMAIL
  or a clearly fake placeholder like test-user@example.com
- Neon/DATABASE_URL connection strings → process.env.DATABASE_URL
- Hardcoded auth tokens → process.env.TEST_AUTH_TOKEN

### URLs

- Any internal, staging, or production app URLs → process.env.BASE_URL
  or http://localhost:3000

### App name references

- "shenny" as a brand or product name in string literals, test descriptions,
  or comments → "the app" or omit entirely
- Do NOT replace "shenny" in import paths or file references where it is
  structurally load-bearing

## What NOT to Change

- Test logic, selectors, assertions, or structure
- Import paths (even if they reference @/lib/... that won't resolve — the README
  already explains this is expected and by design)
- Type definitions
- Anything already using process.env

## README Check

After scrubbing, read through README.md and verify:

- The e2e and API layer descriptions still accurately reflect what is now in the repo
- The repo structure diagram matches the actual folder layout
- No updates are needed — but flag any discrepancies for owner review rather than
  editing the README without flagging first

## Deliverable

- List every file changed and exactly what was replaced
- Flag anything ambiguous before acting on it
- Do NOT commit or push — owner will review first
