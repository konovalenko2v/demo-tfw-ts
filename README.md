# QA Automation Test Suite (TypeScript + Playwright)

TS/Playwright-порт [flamingo](../flamingo) — автотесты для REST API [Restful
Booker](https://restful-booker.herokuapp.com), GraphQL API [Hygraph](https://hygraph.com) (демо-схема Ecommerce) и
UI-формы [DemoQA](https://demoqa.com/automation-practice-form).

## Prerequisites

- Node.js 18+
- Chrome/Chromium (ставится через `npx playwright install`)

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

API/UI/GraphQL тесты разделены через Playwright `projects` (`playwright.config.ts`), поэтому `--project=<name>` работает
из коробки без дополнительных обвязок.

Учётные данные для `/auth` передаются через переменные окружения (`.env`, см. `.env.example`):

```bash
BOOKER_USERNAME=admin USER_PASSWORD=password123 npm test
```

Без переменной тест падает с внятным сообщением `Test Run Error! Please check env variable ...`, а не тихим fallback —
так подмена кредов не проходит незамеченной.

## Структура проекта

```
src/
├── core/            конфиг (host/креды), FileUtil-аналог для чтения GQL-файлов
├── api/
│   ├── clients/      AuthClient, BookingClient — тонкие обёртки над эндпоинтами (APIRequestContext)
│   ├── types/         Booking, CreateBookingResponse, AuthRequest/Response — интерфейсы, wire-имена полей как есть
│   ├── steps/         AuthSteps, BookingSteps — test.step()-обёртки для отчёта
│   ├── data/           booking.data.ts — билдеры тестовых данных на @faker-js/faker
│   └── auth/           token.provider.ts — ленивый кешируемый токен
├── graphql/           GraphQlClient (Hygraph)
└── ui/                 PracticeFormPage, ForumSteps (Playwright Page)
tests/
├── api/               auth.spec.ts, booking-crud.spec.ts, negative.spec.ts
├── graphql/            positive.spec.ts, negative.spec.ts
└── ui/                 forum.spec.ts
resources/
├── GQL/                тестовые GraphQL-запросы (*.json)
└── files/              upload-test.txt для UI-теста
```

## Покрытие эндпоинтов (REST)

| Эндпоинт               | Что проверяется                                                                                                                                  |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `POST /auth`           | успешная и неуспешная (неверные credentials, пустые поля) аутентификация; в негативных случаях статус остаётся 200, ошибка передаётся в `reason` |
| `GET /ping`            | доступность сервиса (201)                                                                                                                        |
| `GET /booking`         | список бронирований, фильтрация по `firstname`/`lastname`/`checkin`/`checkout`                                                                   |
| `GET /booking/{id}`    | существующий id (200) и несуществующий id (404)                                                                                                  |
| `POST /booking`        | создание, валидация тела ответа, пустое тело, unicode/спецсимволы, отрицательный `totalprice`, невалидные типы полей                             |
| `PUT /booking/{id}`    | полное обновление с токеном (Cookie `token`), без токена (403), с невалидным токеном (403)                                                       |
| `PATCH /booking/{id}`  | частичное обновление                                                                                                                             |
| `DELETE /booking/{id}` | с токеном (201), без токена (403), с невалидным токеном (403)                                                                                    |

Токен аутентификации передаётся во всех защищённых запросах через **Cookie `token`**, не через `Authorization: Bearer`.

`booking-crud.spec.ts` использует общий фикстурный booking (`beforeAll`/`afterAll`) и подчищает все созданные
бронирования через отдельный `APIRequestContext`, созданный вручную (`playwrightRequest.newContext()`), а не через
worker-scoped `{ request }` фикстуру — Playwright не даёт переиспользовать фикстуру теста внутри `afterAll`.
`negative.spec.ts` очищает созданные бронирования после каждого теста через `afterEach`.

## GraphQL и UI

- `positive.spec.ts`/`negative.spec.ts` (graphql) гоняют запросы к публичной demo-схеме Hygraph (пагинация, вложенные
  поля, невалидные запросы) — тестовые query лежат в `resources/GQL/*.json`.
- `forum.spec.ts` — сквозной сценарий заполнения и отправки формы DemoQA через Playwright (headless по умолчанию).

## Test Strategy

Тесты разделены по интерфейсу (`api`/`graphql`/`ui`) через отдельные Playwright `projects`, а не свалены в один
пакет — это позволяет гонять их независимо и не тянуть браузер туда, где нужен только HTTP. Внутри `api` выделены три
слоя: `clients` (голый HTTP через `APIRequestContext`), `steps` (`test.step()`-обёртки для отчёта), `tests` (сценарии
и ассерты).

Для авторизации выбран ленивый кешируемый токен (`token.provider.ts`) вместо получения токена в module-level коде на
каждый прогон — токен запрашивается один раз за прогон и только когда он реально нужен.

`api` и `graphql` проекты запускаются с `workers: 1` — оба внешних сервиса (Heroku-приложение restful-booker и
демо-CDN Hygraph) отдают `429 Too Many Requests` под параллельной нагрузкой в несколько воркеров; `ui` проект остаётся
параллельным.

## Отличия от Java-версии (flamingo)

- Намеренно не портирован `submitPracticeFormShowsSuccessModal2` — в Java-сьюте это тест-заглушка, спроектированная
  падать на первой попытке (`retries.incrementAndGet() % 2 == 0`), чтобы показать retry-вкладку в Allure. Порт
  сломал бы гарантию "все тесты зелёные", а сам Java README называет его будущим долгом на удаление.
  `.github/workflows/regression.yml` под Node/Playwright.
- `data: null` в GraphQL-ответах на ошибку валидации — реальное поведение Hygraph API (проверено `curl`), поэтому
  ассерт `expect(body.data).toBeNull()`, а не `toBeUndefined()`.

## Reports

Playwright собирает встроенный HTML-отчёт и `allure-playwright` результаты одновременно:

```bash
npm test
npm run report            # открыть Playwright HTML report
npm run allure:generate   # собрать статический Allure-отчёт из allure-results/
npm run allure:serve      # собрать и сразу открыть Allure-отчёт (требует Allure CLI)
```
