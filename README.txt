LEAF IT TO US
=============

A plant-care application for watering schedules, plant-sitting requests,
nearby sitters, visit proof and rewards, community posts, profiles and reviews.

LIVE APPLICATION
----------------
Landing page: https://leafittous.vercel.app/
The landing page is public. Sign in or create an account to use personal plants,
care requests, visits and other account features.

DUMMY ACCOUNT
-------------
Sign in using the Email and Password fields (the login identifier is email).
Email: sitter.test@leafittous.sg
Password: Sitter123!
These dummy credentials were verified against the live backend on
5 November 2026. A fresh local database does not automatically contain this
account: use Create account to register users.
For owner/sitter workflows, use two separate accounts in separate browsers or
an ordinary window and a private window.

LOCAL SETUP FROM THE SUBMITTED FILES
----------------------------------
1. Install Node.js 22.18 or newer in the 22.x series, or Node.js 24.12 or newer.
   Install pnpm if it is unavailable:
     npm install -g pnpm

2. Open a terminal in the extracted project folder and install dependencies:
     cd server
     pnpm install --frozen-lockfile
     cd ../client
     pnpm install --frozen-lockfile

3. Configure server/.env. Supply your own service credentials; do not put
   backend secrets in client files. The required configuration is:
     DB=<MongoDB connection string>
     JWT_SECRET=<random secret of at least 32 bytes>
     PORT=8000

   Use a MongoDB Atlas cluster or a local MongoDB replica set. Community
   operations use database transactions, so a standalone MongoDB server is
   insufficient for all features.

   To enable photo uploads, also set:
     CLOUDINARY_CLOUD_NAME=<your Cloudinary cloud name>
     CLOUDINARY_API_KEY=<your Cloudinary API key>
     CLOUDINARY_API_SECRET=<your Cloudinary API secret>

   To enable OneMap address lookup, also set:
     ONEMAP_EMAIL=<your OneMap account email>
     ONEMAP_PASSWORD=<your OneMap account password>

   Plant-health checks use demo mode by default. For live checks, set:
     PLANT_HEALTH_MODE=live
     PLANT_ID_API_KEY=<your plant identification API key>

   Generate a suitable JWT secret with:
     node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

4. Start the backend in a terminal from the project folder:
     cd server
     pnpm dev
   Backend address: http://localhost:8000
   Keep this terminal open. The database connection must succeed.

5. Start the frontend in a second terminal from the project folder:
     cd client
     pnpm dev
   Open http://localhost:5173/ (or the local URL printed by Vite).
   Keep this terminal open too. Leave VITE_API_BASE_URL unset locally so Vite
   forwards /api requests to the backend on port 8000.

6. Register an account if your database has no users, then sign in.
   Add a plant before creating a care request. Use another account to accept
   the request and perform the sitter workflow.

PRODUCTION BUILD
----------------
From client:
  pnpm build
  pnpm preview
The build is written to client/dist. Preview serves the built frontend only;
the backend is still required. For a separately hosted backend, set
VITE_API_BASE_URL to its HTTPS origin before building. See
client/API_DEPLOYMENT.md for hosting and client-side route configuration.

TESTS
-----
Frontend unit/component/integration tests, from client:
  pnpm test:unit --run

Backend tests, from server:
  pnpm test

Frontend lint and production build, from client:
  pnpm exec eslint src e2e
  pnpm build

Browser tests require additional setup and an isolated test database. They
create records and some upload photos. Do not run them against the shared
application database. See client/E2E_TESTING.md for
accounts, local ports, browser installation and the care-workflow commands.

PROJECT STRUCTURE AND FURTHER GUIDES
----------------------------------
client/  Vue 3 frontend, components, views and browser tests.
server/  Express API, MongoDB models, services and backend tests.
server/AUTH.md               Authentication and environment setup.
client/COMPONENT_TESTING.md  Component testing instructions.
client/INTEGRATION_TESTING.md  Integration testing instructions.
client/API_DEPLOYMENT.md     Frontend and backend deployment configuration.
