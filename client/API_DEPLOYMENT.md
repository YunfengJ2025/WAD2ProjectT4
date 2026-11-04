# Community and Profile API configuration

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
Hardcoded calls elsewhere in the app are outside this initial Community/Profile pass.
