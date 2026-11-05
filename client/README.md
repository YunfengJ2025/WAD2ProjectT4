# Leaf It to Us — client

The Vue 3 frontend uses Vite, Pinia, Bootstrap and MapLibre. Follow the
[project setup guide](../README.md) to start the separate Express backend first.

Use pnpm for dependency installation and keep `pnpm-lock.yaml` updated:

```sh
pnpm install
pnpm dev
```

## Checks

```sh
# All Vitest component, integration and utility tests, once
pnpm test:unit --run

# Watch tests while editing
pnpm test:unit

# Read-only lint check
pnpm exec eslint src e2e

# Production bundle
pnpm build
```

`pnpm lint` also runs the project's automatic lint fixes. Use the read-only command
above when reviewing changes.

## Test guides

- [Component tests](COMPONENT_TESTING.md)
- [Integration tests](INTEGRATION_TESTING.md)
- [Map page tests](src/views/map/TESTING.md)
- [General Playwright E2E tests](E2E_TESTING.md)
- [Care workflow browser tests](e2e/README.md)

The ordinary Playwright config and the care config serve different test setups.
The care config uses dedicated frontend/backend ports to avoid your normal dev
server. Keep the original multi-visit test and the four lifecycle tests: their
shared setup lives in `e2e/care-helpers.js`, but their assertions cover different flows.

## Production hosting

See [API configuration](API_DEPLOYMENT.md) for `VITE_API_BASE_URL`, reverse-proxy
routing and the client-side route fallback required by the frontend host.
