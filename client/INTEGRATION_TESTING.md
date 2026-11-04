# Frontend integration tests

Run from `client`:

```sh
pnpm exec vitest run src/views/post src/views/review src/views/user
```

Run one page while developing (omit `run` for watch mode):

```sh
pnpm exec vitest run src/views/post/PostDetailView.spec.js
```

## Organisation

The former `CommunityFlow.spec.js` has been split without dropping its scenarios:

| File | Integrated behaviour |
| --- | --- |
| `views/post/CommunityView.spec.js` | Feed cards, searching, filtering, sorting, real child like control and shared like state |
| `views/post/CreatePostView.spec.js` | Create/edit form, live preview, file selection, multipart requests, navigation and ownership rejection |
| `views/post/PostDetailView.spec.js` | Gallery, review cards, child reply events, comment persistence responses and failure drafts |
| `views/post/RecentlyLikedView.spec.js` | Liked-post store and rendered cards |
| `views/user/ProfilePosts.integration.spec.js` | Profile post section through its store and real cards |
| `views/user/ProfilePage.integration.spec.js` | Full profile, post/review sections, HTTP helper and shared identity after editing |
| `views/review/ReviewsView.integration.spec.js` | Real authenticated HTTP helper, ratings, received-review filtering and related-post navigation |

The existing reviews/profile view tests also remain: they cover focused page behaviours with selected dependencies stubbed. The explicit `.integration.spec.js` cases supplement them where the complete connection matters.

## What stays real

Page components, relevant child components, Pinia stores and memory routing execute normally. The shared post harness creates fresh state and unmounts components after each test. Its liked state starts loaded and empty to prevent unrelated initial requests consuming page fixtures; actual like toggles still use the real store and HTTP helper. The recently liked page explicitly forces a reload.

`fetch` supplies controlled server responses. Independent parallel requests use URL-based fixtures rather than relying on request order. The community leaderboard's Axios request is mocked because it is outside these post journeys. Destination routes use placeholders: tests verify navigation to a destination without retesting its page.

## Reading a test

1. **Arrange:** create known responses and mount the page with its dependencies.
2. **Act:** type, click, upload, or submit through rendered controls.
3. **Assert:** check the request payload, rendered result, shared state or destination route.

Await Vue interactions; use `flushPromises()` after asynchronous requests or routing. Do not use arbitrary sleeps. Component tests own isolated validation and presentation rules; integration tests focus on important interactions between those pieces.

These tests run in jsdom, not a browser. They do not verify CSS layout or prove that MongoDB persisted a record. Real browser/backend/database workflows remain the next Playwright E2E layer required by the project brief.

These tests and documentation were developed with AI assistance. Team members should review and understand them and disclose the assistance in the submission README.txt.
