# Real-backend E2E tests

These four Playwright scenarios implement the selected journeys (1, 3, 4, 6).
They use the actual frontend, Express endpoints, MongoDB and photo upload service.
There are no mocked responses for auth, posts, likes or reviews.

## Preparation

1. Start the backend against a **dedicated test database**, not production or a shared demonstration database. Post deletion uses transactions, so MongoDB must support transactions (for example, an Atlas replica set).
2. Configure working Cloudinary credentials on that backend. The first two journeys upload the repository's small `src/assets/plant.png` image.
3. Create two distinct, valid accounts, A and B, through your normal registration/seed workflow.
4. Account A must have at least one received `VISIT` review with a numeric rating. Both accounts should be reserved for testing; avoid modifying them during a run.
5. Copy `.env.e2e.example` to `.env.e2e.local`. Fill in both accounts and set `E2E_CONFIRM_TEST_ENV=true` only after confirming that the backend uses your test database. Never put passwords into a `VITE_` variable.
6. Install the existing project dependencies. Install the test browser with `pnpm exec playwright install chromium`, or set `E2E_BROWSER_CHANNEL=chrome` to use installed Chrome.

The runner reads `.env.e2e.local` using Node's built-in environment-file support (the project already requires Node 22+). This file is excluded by the repository's `*.local` ignore rule.

## Local and deployed addresses

Local mode starts Vite at `http://localhost:5173`; start Express separately on port 8000. Leave `VITE_API_BASE_URL` unset to use the existing `/api` proxy.

For a running staging frontend, set `E2E_BASE_URL`. The runner then does not start a local server. If the frontend calls a separate backend, also set `E2E_API_BASE_URL` to its origin without `/api`; it must be the same backend used by the frontend's `VITE_API_BASE_URL`. Configure/rebuild that frontend separately. Do not point this suite at production.

## Commands (from client)

```powershell
# Verify test discovery without running the journeys.
pnpm exec playwright test posts.spec.js discussion.spec.js profile-reviews.spec.js --list

# Run all four selected journeys.
pnpm exec playwright test posts.spec.js discussion.spec.js profile-reviews.spec.js

# Observe the post lifecycle and validation journeys in a browser.
pnpm exec playwright test posts.spec.js --headed

# Inspect results after a run.
pnpm exec playwright show-report
```

## Files and assertions

| File | Scenarios |
| --- | --- |
| `e2e/posts.spec.js` | Landing/login, schedule destination, real create with photo, reload, edit, cancelled removal, confirmed deletion; invalid/oversized photo and blank content corrected without losing the draft |
| `e2e/discussion.spec.js` | Independent A/B sessions, B likes and comments, A replies, both reload, no nested reply controls |
| `e2e/profile-reviews.spec.js` | Profile-to-reviews navigation, received/written post feedback, search/type filters, average based only on received visit reviews |
| `e2e/helpers/fixtures.js` | Account configuration, UI login, HTTP response waits, run-specific record names and cleanup |

Each test gets a unique title prefix and creates its own posts. Tests run with one worker to avoid interactions through the dedicated accounts. Account B uses a separate browser context; login is performed through the UI because this app's JWT is in sessionStorage, not ordinary saved storageState.

Mutation waits match URL and HTTP method, and checks after reload verify persistence rather than just local state. The rating test derives its expected average from the real review API before adding post feedback; it checks UI consistency with the backend, not independent correctness of the backend rating data.

## Cleanup and failures

The fixture records only the IDs and acting tokens of posts successfully created by that test. Teardown deletes those posts through the real authenticated API, including their discussion/likes via the backend's existing deletion flow. A post already removed in the UI may return 404 during cleanup; that is accepted. Other cleanup failures fail the test. There is no database-wide reset.

The tests do not delete pre-existing reviews or visits. They also do not claim to clean Cloudinary files independently: the current post-deletion endpoint controls storage cleanup. Periodically inspect your test upload folder if the backend does not remove uploaded files.

The public community feed must remain small enough for the UI to be usable. Do not run the tests concurrently with teammates using these accounts. Reports and traces may contain test-account input and application data; keep them private. Git already ignores `playwright-report/` and `test-results/`.

These tests and documentation were written with AI assistance. Review and understand them, and disclose that assistance in the submission README.txt as required by the project brief.

## Care workflow browser tests

Care workflow E2E tests

`care-workflow.spec.js` exercises the real Vue app, Express API, and MongoDB.
It uses two isolated browser sessions and newly registered accounts per run.
The shared care fixture creates accounts and signs in through the UI. Outdoor
plant creation uses the real API as setup in this original multi-visit test; sign-in, request
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

Four lifecycle tests

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
