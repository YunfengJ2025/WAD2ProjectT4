Redundancy review — 5 November 2026

Scope: tracked files, exact file hashes, client runtime imports from main.js,
server runtime imports from server.js, source references, duplicate object keys,
repeated helpers, and a read-only client ESLint run. The findings below record the original audit. The cleanup status is listed below.
Static reference analysis is not a proof that every
unreferenced file is disposable; maintenance scripts and tests have other entry points.

Cleanup status

Validation: 185 frontend tests, 69 backend tests and all five care E2E tests pass.
Client lint and the production build also pass. Browser checks used the isolated
local database; application changes have not been pushed.

- Removed all eight empty test.js placeholders, mockDb.json, the unattached ReviewForm
  and its isolated test. Updated component-testing documentation.
- Replaced the duplicated template READMEs with project setup and client-specific guides.
- Removed unused session/fs imports, old commented session middleware, Leaflet,
  express-session, the npm fs dependency and the unused shop image folder constant.
- Standardized dependency installation on pnpm, retained its client/server lockfiles,
  regenerated them offline, and removed the redundant npm package-lock.json files.
- Shared Singapore calendar helpers between the request page and map, shared the
  backend dateInSingapore helper between controllers, and reused existing water labels.
- Shared care E2E registration/sign-in setup, preserving the multi-visit assertions.
- Shared upload MIME/size validation while preserving each upload field/count/error contract.
- Removed redundant bindings/assignments and supplied explicit multi-word component names.
- By user request, CareRequestCard.vue and every file in the frontend careVisit view
  and component folders are unchanged. Its duplicate prop, the legacy My Sits branch,
  and the visit-card date helpers are intentionally still present. These exclusions
  were verified against file hashes captured before cleanup.
- Configuration variants, maintenance scripts and ERD source/export artifacts were
  retained because the audit did not establish that they were redundant.

Confirmed file duplication and empty placeholders

- README.md and client/README.md are byte-for-byte identical (1,607 bytes).
  They both contain Vue starter instructions. Prefer a project-specific root README
  and a client-specific README or a link to one canonical setup guide. The root
  package.json does not have the dev/build scripts the duplicated root guide suggests.
- Eight tracked files contain zero bytes and have no imports/references:
  - client/src/components/careRequest/test.js
  - client/src/components/plant/test.js
  - client/src/components/review/test.js
  - client/src/views/boards/test.js
  - client/src/views/plant/test.js
  - client/src/views/post/test.js
  - client/src/views/review/test.js
  - client/src/views/user/test.js
  These are placeholders, not the real *.spec.js tests, and can be removed without
  removing test coverage.
- No other byte-identical tracked file groups were found, including assets.

Unused application files / unused UI paths

1. client/src/data/mockDb.json
   No source or repository references were found. The current stores use the API.
   Candidate for removal or relocation into an explicitly documented example fixture.

2. client/src/components/review/ReviewForm.vue
   The runtime import graph and repository search found only ReviewForm.spec.js
   importing it. Neither ReviewsView nor VisitDetailView renders this form: visit
   feedback uses the inline form in VisitDetailView, and post feedback uses the
   post discussion forms. If no future feature needs it, remove the component and
   its test together and update COMPONENT_TESTING.md. Passing isolated tests do not
   establish that a component is actually connected to a page.

3. Legacy Available Sits UI in client/src/views/careVisit/CareVisitsView.vue
   The only runtime caller is the /my-sits route, which always passes section='mine'.
   The old available section and AvailableVisitCard therefore cannot appear through
   the current router. Nevertheless load() still fetches /care-visits/available;
   its failure can reject the shared Promise.all even though the result is not shown.
   The available acceptance flow duplicates the active FindNearby acceptance flow.
   Simplify the view and its data loading first, then consider removing
   AvailableVisitCard.vue. CareVisit.spec.js currently mounts the default combined
   view and exercises .available-list, so that test needs updating with the cleanup.
   Do not just delete the imported card and leave the branch behind.

Confirmed redundant code and consolidation opportunities

- CareRequestCard.vue:22–23 declares the highlighted prop twice with the same
  definition. One declaration can be removed. The duplicate was confirmed by an
  object-key AST check, rather than just matching similar text.
- server/server.js imports express-session and fs but does not use either binding.
  Its old session middleware block is commented out. JWT authentication is active.
- client/package.json still lists leaflet, but no application imports/references
  were found; RequestMap uses maplibre-gl. Leaflet is a removable dependency candidate.
- server/package.json still lists express-session, referenced only by the unused
  server.js import. It also lists fs as an npm dependency, although Node already
  supplies fs. The cleanup script uses node:fs, which does not need an npm package.
  Remove dependencies through the chosen package manager and update its lockfile;
  do not manually edit only one lockfile.
- FindNearby.vue:46 repeats the water-source label mapping already provided by
  utils/visitFormat.js. It can use waterSourceLabel like the other visit/request cards.
- Singapore date formatting repeats in AssignedVisitCard.vue:76,
  CareRequestsView.vue:96 and VisitDetailView.vue:55. Date-only day addition also
  repeats in CareRequestsView.vue:104 and VisitDetailView.vue:58. Consolidate equal
  date-only behaviours into a client utility; do not accidentally replace local-time
  schedule calculations or different display formats with a different timezone rule.
- server/controllers/careRequestController.js:11 and careVisitController.js:17 each
  define dateInSingapore identically. A server date utility would avoid divergence.
  A backend utility need not be the same physical module as the browser utility.
- care-workflow.spec.js repeats registration, sign-in and browser-context setup
  already provided by care-helpers.js. The test itself adds unique multi-visit and
  view-switch coverage, so retain the assertions and consider sharing only setup.
- The file upload middleware repeats MIME types, the 2MB limit and parts of error
  handling. A shared configuration helper is possible, but the handlers have different
  contracts: single 'photo', per-plant named proof files, and up to nine 'photos'.
  They should not be collapsed into one indistinguishable upload endpoint.

Lint findings relevant to redundant code

The read-only client lint run found six errors. Four concern redundant assignments
or bindings: RequestMap.vue's homeMarker is assigned but never read;
buildSchedule.js initializes status to an immediately overwritten empty string;
LeaderboardView.vue and ProfileView.vue have unused catch bindings. Removing the
homeMarker variable must retain new Marker(...).addTo(map), whose side effect draws
that marker. The other two errors are multi-word component-name conventions for
Loading.vue and landingpage.vue, not redundancy findings.

Keep / do not remove based on filename similarity alone

- RequestMap.vue and views/map/FindNearby.vue have different responsibilities:
  reusable map rendering versus the routed search page.
- RequestsView.vue selects create/list modes; CareRequestsView.vue implements them.
  The wrapper is small but currently used.
- Component, integration and E2E test files cover different boundaries. Related names
  do not make their assertions redundant.
- care-workflow.spec.js and the four lifecycle E2E files cover overlapping setup but
  different outcomes. Merge setup if desired; preserve their distinct coverage.
- playwright.config.js and playwright.care.config.js serve different test environments;
  vite.care.config.js intentionally isolates the test backend/ports.
- Old route redirects and the server's extra board route mount points may preserve
  existing clients. Check intended compatibility before removing them.
- server/scripts/backfillTokenReservations.js, cleanupUnfinishedCareRequests.js and
  testOnemap.js are manually invoked tools, not dead files merely because server.js
  does not import them.
- tmp/pdfs and output/pdf contain generated ERD intermediate files and alternative
  exports (approximately 1.1MB and 1.7MB). They are not application runtime files;
  keep selected deliverables and generation sources as needed. They are not exact
  duplicates according to the hash scan.
- The client and server each have both package-lock.json and pnpm-lock.yaml.
  Choose and document a team package manager before removing either lockfile.

Recommended cleanup sequence

1. Remove the eight empty placeholders, duplicate highlighted declaration and unused imports.
2. Confirm that mockDb.json and the unattached ReviewForm are no longer wanted, then
   remove them and the corresponding obsolete test/documentation references.
3. Simplify My Sits' legacy available branch and align its tests with the routed page.
4. Consolidate date/label/E2E setup helpers without changing their behaviours.
5. Remove unused dependencies and resolve the lockfile policy separately.
6. Replace duplicated template READMEs with accurate setup documentation.

This review found real redundancy; it cannot certify that every repeated line is
unnecessary. Similar business concepts and formatting rules still need semantic
review before consolidation. The original static review did not touch a database or external service. Follow-up
cleanup checks use the isolated local database and the existing proof-photo uploader.
