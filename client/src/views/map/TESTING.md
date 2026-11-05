Map page component tests follow Week 10 slides 17–29 and 41–42.

`MapFeature.spec.js` uses Vitest (`describe`, `it`, `expect`) and Vue Test Utils
(`mount`, `trigger`, `setValue`). Each test sets up data, performs an action,
and checks the resulting display. The fixed date makes results repeatable.

`views/map/FindNearby.vue` is the routed page for both Find nearby and Find requests.
`components/map/RequestMap.vue` is its reusable map component. The API is mocked
so tests need no account, server, or database. `RequestMap` is replaced with a
custom stub that displays received requests and emits `select` when clicked,
following the slides' prop-passing and child-event examples. These are isolated
component tests; they do not verify real map rendering or full application workflows.

| Case               | Input / action                              | Expected result                                                              |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| Distance boundary  | Visits at 299, 300, 301 m; choose 300 m     | Only 299 and 300 m appear in list and map stub                               |
| Loading            | API response pending, then resolves         | Loading message replaced by visits                                           |
| Initial state      | Mount with one nearby visit                 | Find nearby heading, Singapore date, one card                                |
| Filters            | Change distance and date                    | Matching visits appear; unmatched date shows empty state                     |
| Details            | Press Enter on a card, then Back            | Details open, then list returns                                              |
| Load failure       | API rejects, then click Try again           | Error appears, then results return                                           |
| Sign-in failure    | API reports sign-in required                | Sign-in message without retry button                                         |
| Acceptance         | Click Accept request, then resolve API call | Button disabled while pending; accepted visit removed and confirmation shown |
| Nationwide groups  | Switch to See all requests                  | Visits grouped by owner and period; map pins deduplicated by postal code     |
| Child event        | Click a map stub pin                        | Parent shows the selected group's visits                                     |
| Nationwide failure | Failed nationwide load, then retry          | Results return while Find requests remains active                            |

`MapFeature.spec.js` also checks that filtering a nationwide group
by date keeps all visits in the matching request, and that returning nearby
restores today's date.

From `client`, run once:

```sh
npm run test:unit -- --run src/views/map/
```

For watch mode:

```sh
npm run test:unit -- src/views/map/
```

Playwright (slides 45–61) is for E2E tests of complete workflows and is separate
from these component tests. No E2E or real-map integration coverage is claimed here.

The four real-browser lifecycle flows are documented in
[`client/e2e/README.md`](../../../e2e/README.md). They cover completion and feedback,
sitter opt-out, missed visits and make-up requests, and owner cancellation.
