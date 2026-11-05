# Leaf It to Us

A Vue and Express application for plant care requests, nearby sitters, visit proof,
community posts, profiles, reviews, watering schedules and community rankings.

## Setup

Use **pnpm** to install dependencies. The client and server have separate
`pnpm-lock.yaml` files; commit the relevant lockfile when changing dependencies.
Use Node.js 22.18+ or 24.12+ as specified in the client package.

Install each application's dependencies:

```sh
cd server
pnpm install
cd ../client
pnpm install
```

Configure `server/.env` with your MongoDB connection (`DB`) and a `JWT_SECRET` of
at least 32 bytes. Photo uploads also need the Cloudinary settings; map address
lookup uses the OneMap configuration. See [authentication setup](server/AUTH.md).
Keep real credentials out of source control.

MongoDB must support transactions for community posting and deletion. Use Atlas
or a local replica set. The ordinary backend runs on port 8000 unless `PORT` is set.

Start the backend in one terminal:

```sh
cd server
pnpm dev
```

Start the frontend in another terminal:

```sh
cd client
pnpm dev
```

Vite serves the client on port 5173 and forwards `/api` requests to the backend.
The root package does not run either application; use the folders above.

## Checks

From `client`:

```sh
pnpm test:unit --run
pnpm exec eslint src e2e
pnpm build
```

From `server`:

```sh
pnpm test
```

## Browser tests and deployment

- [Client commands and testing guides](client/README.md)
- [General E2E setup](client/E2E_TESTING.md)
- [Care workflow E2E setup](client/e2e/README.md)
- [API deployment configuration](client/API_DEPLOYMENT.md)

Run database-writing browser tests only against a dedicated test backend/database.
