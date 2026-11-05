# User, review, post, and token component tests

Run these commands from `client` after installing the project's dependencies:

```sh
pnpm exec vitest run src/components/user src/components/review src/components/post src/components/token
```

To watch one component while editing:

```sh
pnpm exec vitest src/components/review/ReviewCard.spec.js
```

## How the tests follow Week 10

- `describe()` groups one component's behaviours. `it()` describes an observable result.
- **Arrange:** mount the component with sample props, a fresh Pinia instance, or memory router.
- **Act:** use `trigger()`, `setValue()`, or `setProps()` to simulate interaction or parent updates.
- **Assert:** use `expect()` and matchers such as `toBe()`, `toEqual()`, `toContain()`, and `toHaveLength()`.
- Await Vue interactions before checking the DOM. Use `flushPromises()` when a store action or navigation is asynchronous.
- `afterEach()` unmounts shared wrappers and restores mocks to keep cases independent.

Parent tests replace complex children with small stubs, as demonstrated in the lecture. For example, ProfilePosts tests the six-post selection and author props; PostCard tests its own navigation and photo selection. ProfileReviews does not repeat UserAvatar's broken-image tests.

Store action spies provide controlled success and failure without a server or database. These tests check how components respond; they do not prove HTTP persistence. View integration tests and real-backend Playwright journeys are separate layers.

## Coverage by component

| Component        | Behaviours checked                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| UserAvatar       | Profile photo, accessible description, missing/broken photo fallback, recovery after prop update                                |
| ProfilePosts     | Six-post limit, current author, navigation links, empty/error/retry states                                                      |
| ProfileReviews   | Received-only selection, newest-first ordering, six-review limit, loading/error/retry/empty states                              |
| StarRating       | Fractional display, accessible rating, selection event, parent prop update                                                      |
| ReviewCard       | Related-post navigation, trimmed reply event, busy/blank guards, replies disallowed for visits/replies/guests/profile summaries |
| PostCard         | Photo navigation, selected state, post navigation, missing/broken image behaviour                                               |
| PostDraftPreview | Arrows, keyboard, thumbnails, wrapping, swipe, vertical-gesture preservation, cancellation, photo removal                       |
| LikeButton       | Selected state/count, pending state, failure feedback, guest redirect                                                           |
| TokenBalance     | Total/available/frozen values, reservation details, fallback values, reactive updates, refresh failure                          |

We do not test every HTML tag, decorative CSS class, or Vue's own functionality. The fractional star fill is an intentional visual-output assertion, not a general CSS snapshot.

## Limits

jsdom does not perform real layout or touch scrolling. These tests cannot verify responsive widths, actual swipe scrolling, CSS-only tooltip visibility, or animation appearance. Check those in a browser. Token transaction correctness belongs in service/backend tests and complete user journeys, not TokenBalance's display tests.

These test cases and documentation were prepared with AI assistance and should be reviewed and understood by the team. Record the assistance in the submission's README.txt as required by the project brief.
