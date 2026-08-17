# demo-tfw-ts

TypeScript + Playwright test suite for the REST API [Restful
Booker](https://restful-booker.herokuapp.com), the GraphQL API [Hygraph](https://hygraph.com) (Ecommerce demo
schema), and the [DemoQA](https://demoqa.com/automation-practice-form) UI form.

## Prerequisites

- Node.js 18+
- Chrome/Chromium (installed via `npx playwright install`)

## How to Run

```bash
npm install
npx playwright install chromium

# Run all tests
npm test

# Run only API tests
npm run test:api

# Run only UI tests
npm run test:ui

# Run only GraphQL tests
npm run test:graphql
```

API/UI/GraphQL tests are split via Playwright `projects` (`playwright.config.ts`), so `--project=<name>` works out of
the box with no extra wiring.

Credentials for `/auth` are passed via environment variables (`.env`, see `.env.example`):

```bash
BOOKER_USERNAME=admin USER_PASSWORD=password123 npm test
```

Without the variable, the test fails with a clear `Test Run Error! Please check env variable ...` message instead of
a silent fallback — so a credential swap never goes unnoticed.

## Project Structure

```
src/
├── core/            config (host/credentials), a FileUtil-style helper for reading GQL files
├── api/
│   ├── clients/      AuthClient, BookingClient — thin wrappers over the endpoints (APIRequestContext)
│   ├── types/         Booking, CreateBookingResponse, AuthRequest/Response — interfaces, wire field names as-is
│   ├── steps/         AuthSteps, BookingSteps — test.step() wrappers for the report
│   ├── data/           booking.data.ts — test data builders on @faker-js/faker
│   └── auth/           token.provider.ts — a lazily cached token
├── graphql/           GraphQlClient (Hygraph)
└── ui/                 PracticeFormPage, ForumSteps (Playwright Page)
tests/
├── api/               auth.spec.ts, booking-crud.spec.ts, negative.spec.ts
├── graphql/            positive.spec.ts, negative.spec.ts
└── ui/                 forum.spec.ts
resources/
├── GQL/                test GraphQL queries (*.json)
└── files/              upload-test.txt for the UI test
```

## Endpoint Coverage (REST)

| Endpoint                | What's covered                                                                                                                              |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `POST /auth`           | successful and unsuccessful (invalid credentials, empty fields) authentication; on failure the status stays 200, the error is in `reason`     |
| `GET /ping`            | service availability (201)                                                                                                                    |
| `GET /booking`         | booking list, filtering by `firstname`/`lastname`/`checkin`/`checkout`                                                                        |
| `GET /booking/{id}`    | existing id (200) and non-existent id (404)                                                                                                   |
| `POST /booking`        | creation, response body validation, empty body, unicode/special characters, negative `totalprice`, invalid field types                       |
| `PUT /booking/{id}`    | full update with a token (Cookie `token`), without a token (403), with an invalid token (403)                                                 |
| `PATCH /booking/{id}`  | partial update                                                                                                                                 |
| `DELETE /booking/{id}` | with a token (201), without a token (403), with an invalid token (403)                                                                        |

The auth token is passed on every protected request via **Cookie `token`**, not `Authorization: Bearer`.

`booking-crud.spec.ts` uses a shared fixture booking (`beforeAll`/`afterAll`) and cleans up every booking it created
through a separate `APIRequestContext` created manually (`playwrightRequest.newContext()`) rather than the
worker-scoped `{ request }` fixture — Playwright doesn't allow reusing a test fixture inside `afterAll`.
`negative.spec.ts` cleans up its created bookings after each test via `afterEach`.

## GraphQL and UI

- `positive.spec.ts`/`negative.spec.ts` (graphql) run queries against the public Hygraph demo schema (pagination,
  nested fields, invalid queries) — test queries live in `resources/GQL/*.json`.
- `forum.spec.ts` — an end-to-end scenario filling out and submitting the DemoQA form via Playwright (headless by
  default).

## Test Strategy

Tests are split by interface (`api`/`graphql`/`ui`) via separate Playwright `projects` rather than lumped into one
package — this lets them run independently and keeps the browser out of runs that only need HTTP. Inside `api`,
three layers are separated: `clients` (bare HTTP via `APIRequestContext`), `steps` (`test.step()` wrappers for the
report), `tests` (scenarios and assertions).

Authorization uses a lazily cached token (`token.provider.ts`) instead of fetching a token in module-level code on
every run — the token is requested once per run, and only when it's actually needed.

The `api` and `graphql` projects run with `fullyParallel: false` — tests within a single file run sequentially
rather than in parallel, because both external services (the restful-booker Heroku app and the Hygraph demo CDN)
return `429 Too Many Requests` under aggressive parallel load; the `ui` project stays fully parallel.

## Coverage Notes

- There is deliberately no stub test designed to fail on its first attempt just to populate a retry tab in the
  report — that would break the "all tests green" guarantee without adding real coverage value.
- `data: null` in GraphQL error-validation responses is real Hygraph API behavior (verified with `curl`), hence the
  assertion `expect(body.data).toBeNull()` rather than `toBeUndefined()`.

## Reports

Playwright collects its built-in HTML report and `allure-playwright` results at the same time:

```bash
npm test
npm run report            # open the Playwright HTML report
npm run allure:generate   # build a static Allure report from allure-results/
npm run allure:serve      # build and immediately open the Allure report (requires the Allure CLI)
```
