# Frontend deployment and API configuration

## Vercel

Import `YunfengJ2025/WAD2ProjectT4` into Vercel and set **Root Directory** to
`client`. Use the Vite preset, `npm run build` as the build command, and `dist`
as the output directory. The checked-in `vercel.json` supplies these build
settings and serves `index.html` for Vue Router routes opened directly.

Alternatively, run `npx vercel login`, then `npx vercel --prod` from `client`.
Keep the CLI project root as `./` when deploying from that directory.

The frontend can be deployed before the backend. Until a hosted backend is
available, the landing page and frontend assets work, but sign-in and API-backed
features cannot load data. Once the backend is hosted, add
`VITE_API_BASE_URL=https://your-backend.example.com` in Vercel's project
environment variables and redeploy. Do not put backend secrets in Vite variables.

## Local development

Leave `VITE_API_BASE_URL` unset. Start the backend on port 8000 and run
`npm run dev` in the client directory. Vite forwards `/api` requests to the
backend and removes the first `/api` prefix.

## Separate frontend and backend hosting

Set `VITE_API_BASE_URL=https://your-backend.example.com` in the frontend host's
build environment, then rebuild and redeploy. Use the actual backend origin,
without a trailing `/api`. This variable is public configuration, not a secret.

The shared request helper sends posts to `/post`, profiles to `/user`, reviews
to `/review`, and the community leaderboard to `/api/leaderboard` on that origin.
The backend currently enables CORS, including requests with Bearer authorization.
The backend listens on `0.0.0.0` and uses the host's `PORT`, falling back to 8000.

If hosting both under one origin instead, leave the variable unset and configure
the production reverse proxy to forward `/api/*` to the backend, removing only
the first `/api` prefix. Vite's development proxy is not part of the built site.
Configure the frontend host to serve index.html for client-side routes too.

## Verify after deployment

- Open Community and check that posts and the leaderboard load.
- Sign in, open Profile, and check reviews, posts, profile edits and photo uploads.
- Open another user's public profile.
- Inspect Network requests: URLs should use the deployed origin, never localhost.

Changing the base URL affects every caller of the shared helper, including auth.
Dashboard and Leaderboard also use the shared API URL configuration.
