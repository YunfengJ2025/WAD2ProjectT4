Care request workflow E2E test

`care-workflow.spec.js` exercises the real Vue app, Express API, and MongoDB.
It uses two isolated browser sessions and newly registered accounts per run.
Account and outdoor plant creation use the real API as setup; sign-in, request
creation, acceptance, and My Sits checks happen through the UI. No API routes
or Vue components are mocked. No photo uploads or paid external services are used.

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
DB=mongodb://127.0.0.1:27028/wad2_care_e2e node server.js
```

The existing `server/.env` supplies the JWT secret. The shell `DB` value overrides
its database connection without editing the file. Keep port 8000 free for this
backend. The frontend proxy forwards `/api` calls to that port.

Terminal 3, from `client`:

```sh
npx playwright install chromium
E2E_LIVE=1 npm run test:e2e:care
```

The dedicated config starts/reuses Vite at port 5173 and runs Chromium headlessly,
with Singapore time and no retries. For the Playwright UI:

```sh
E2E_LIVE=1 npm run test:e2e:care -- --ui
```

Without `E2E_LIVE=1`, the database-writing test is skipped. A missing backend or
failed registration with the flag enabled fails the test; it is not silently skipped.
MapLibre runs normally, but the workflow selects cards alongside the map instead
of relying on pixel coordinates or external map tiles. Tile rendering, proof
submission, rewards, completed history, and cancellations are outside this test.
