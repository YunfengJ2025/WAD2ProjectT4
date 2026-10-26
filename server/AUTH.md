JWT authentication
==================

Set `JWT_SECRET` in `server/.env` to a randomly generated secret of at least
32 bytes before starting the server. For example, generate one with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep existing database and Cloudinary environment settings. `.env.example`
shows the new authentication setting; never commit your real secret.

- `POST /user/register`: accepts `userName`, `email`, `password` and existing
  optional address fields. Returns HTTP 201 with `{ user, accessToken,
  tokenType: "Bearer", expiresIn: 3600 }`.
- `POST /user/login`: accepts `email` and `password`, returning the same shape.
- `GET /user/me`: returns `{ user }` for a valid access token.
- `PATCH /user/me`: updates the authenticated user's `userName`, `email`,
  `postalCode`, `block`, and `unitNumber`. Accepts JSON for details or
  multipart form data with an optional `photo` file (JPG, PNG or WebP, up to
  2MB). Returns `{ user }`, including `photoUrl` and `createdAt`; Cloudinary
  management ids are excluded. Configure the existing `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` settings for uploads.
  Replaced avatars use `FOLDERS.userIcon`. A failed database save removes the
  new upload while preserving the previous image.
- `GET /user` and `PATCH /user/token-balance/:transactionId`: require a valid
  token and a current database role of `admin`.
- Plant routes using `requireUser` also require a Bearer token.
- `POST /user/logout`: returns HTTP 204. Clients must discard their token.
  This does not revoke issued tokens; they remain usable until their one-hour
  expiry. No refresh-token or server-side revocation flow is implemented.

Send `Authorization: Bearer <accessToken>` with protected requests. Tokens use
HS256 with issuer and audience verification. Missing, invalid or expired
credentials return HTTP 401; insufficient permissions return HTTP 403.
Cookie sessions are no longer used. The frontend auth store retains the token
in session storage, attaches this header, and clears it on logout. The profile
page updates that same store after saving, including the navbar avatar.

This change covers user routes and the existing shared authentication middleware.
Other public backend routes, including token transaction routes, still need a
separate authorization review before production use.

Run `npm test` from `server` for HTTP authentication tests with mocked database
operations; these tests do not require a running MongoDB instance.
