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
