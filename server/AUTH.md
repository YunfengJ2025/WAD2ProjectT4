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
- `GET /user` and `PATCH /user/token-balance/:transactionId`: require a valid
  token and a current database role of `admin`.
- Plant routes using `requireUser` also require a Bearer token.
- `POST /user/logout`: returns HTTP 204. Clients must discard their token.
  This does not revoke issued tokens; they remain usable until their one-hour
  expiry. No refresh-token or server-side revocation flow is implemented.

Send `Authorization: Bearer <accessToken>` with protected requests. Tokens use
HS256 with issuer and audience verification. Missing, invalid or expired
credentials return HTTP 401; insufficient permissions return HTTP 403.
Cookie sessions are no longer used. The demo frontend still needs to be wired
to retain the returned access token, attach this header and clear it on logout.

This change covers user routes and the existing shared authentication middleware.
Other public backend routes, including token transaction routes, still need a
separate authorization review before production use.

Run `npm test` from `server` for HTTP authentication tests with mocked database
operations; these tests do not require a running MongoDB instance.
