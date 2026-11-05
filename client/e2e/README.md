Care workflow E2E tests

`care-workflow.spec.js` exercises the real Vue app, Express API, and MongoDB.
It uses two isolated browser sessions and newly registered accounts per run.
Account and outdoor plant creation use the real API as setup; sign-in, request
creation, acceptance, and My Sits checks happen through the UI. No API routes
or Vue components are mocked. This original multi-visit test does not upload photos;
the completion lifecycle test below uploads one proof image.

The test verifies:

1. Owner selects a plant and posts a two-day request from My Requests.
2. The request appears in the owner's list.
3. Sitter finds and accepts today's visit in Find Nearby.
4. The accepted visit disappears from the open list and appears in My Sits.
5. Sitter accepts tomorrow's visit through Find Requests.
6. Both visits appear in My Sits with the correct day labels and persist on reload.
7. The owner's My Sits contains no sitter assignments; their request shows a sitter was found.

Run with a disposable local database. The test registers two new accounts,
receives starter tokens, and leaves its plant, request and visits in that test
database for inspection. Each run uses unique names. There is no account deletion
API, so reset the disposable database separately when finished. Do not point the
backend at your shared database for these tests.

Terminal 1, start MongoDB (create the directory first):

```sh
mkdir -p /tmp/wad2-care-e2e-db
mongod --dbpath /tmp/wad2-care-e2e-db --port 27028 --bind_ip 127.0.0.1
```

Terminal 2, from `server`:

```sh
PORT=8008 HOST=127.0.0.1 DB=mongodb://127.0.0.1:27028/wad2_care_e2e node server.js
```

The existing `server/.env` supplies the JWT secret. The shell `DB` value overrides
its database connection without editing the file. Keep port 8008 free for this
backend. The dedicated `vite.care.config.js` forwards `/api` to 127.0.0.1:8008. It does not reuse your normal development server.

Terminal 3, from `client`:

```sh
npx playwright install chromium
E2E_LIVE=1 npm run test:e2e:care
```

The dedicated config starts a separate Vite instance at port 5178 and runs Chromium headlessly,
with Singapore time and no retries. For the Playwright UI:

```sh
E2E_LIVE=1 npm run test:e2e:care -- --ui
```

Without `E2E_LIVE=1`, the database-writing test is skipped. A missing backend or
failed registration with the flag enabled fails the test; it is not silently skipped.
MapLibre runs normally, but the workflow selects cards alongside the map instead
of relying on pixel coordinates or external map tiles. Tile rendering is outside these tests. The original multi-visit test covers assignment persistence; the lifecycle files below cover proof, rewards and cancellation.

Four lifecycle tests (Week 10 E2E approach)

Each file follows setup → browser actions → assertions. The shared
`care-helpers.js` registers fresh owner/sitter accounts using the real API, signs
in through the UI, and adds the plant and request through their forms.

| File                        | Workflow and expected outcome                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `care-completion.spec.js`   | Add plant → request → accept → Start visit → tick both steps → upload PNG → submit → automatic payment → owner sees proof and leaves feedback → sitter sees feedback and updated balance. |
| `care-opt-out.spec.js`      | Add plant → request → accept → opt out → owner notification → a different sitter accepts the reopened visit.                                                                              |
| `care-missed.spec.js`       | Add plant → request → accept → miss deadline → owner notification → reserved reward released → owner creates replacement → replacement visible to sitters.                                |
| `care-cancellation.spec.js` | Add plant → request → owner cancels before acceptance → cancelled request persists → hidden from available visits → tokens released.                                                      |

Completion uploads one small test PNG to the configured Cloudinary account.
Valid upload configuration and network access are required. The test verifies
that the saved proof image loads, not just that an image element exists.
Reviews are optional and do not control reward payment.

The missed-visit test uses `server/e2e/miss-visit.cjs` to backdate its accepted
visit and invoke the real `sweepVisits()` service. This simulates elapsed time
without waiting overnight; the app's missed-visit, penalty, reservation and
notification logic still runs normally. The helper refuses non-local databases,
requires the exact database name `wad2_care_e2e`, and checks that the visit belongs
to an E2E owner. It is a CLI only, with no application endpoint. The backend and
helper MUST use the same isolated database.

Run all care tests, including the original multi-visit test, from `client`:

```sh
E2E_LIVE=1 E2E_DB_URL=mongodb://127.0.0.1:27028/wad2_care_e2e npm run test:e2e:care
```

Run one flow:

```sh
E2E_LIVE=1 npm run test:e2e:care -- care-opt-out.spec.js
```

A missing `E2E_DB_URL` fails the missed-visit test with a configuration error.
The other tests do not directly access MongoDB. Tests leave their records and
proof uploads for inspection. Traces and screenshots are retained on failure.
