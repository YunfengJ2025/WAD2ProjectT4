// Server-side OneMap helper: turns a 6-digit postal code into { lat, lng }.
// It lives on the server so the OneMap login never reaches the browser.
//
// Needs two lines in server/.env (your OneMap account):
//   ONEMAP_EMAIL=you@example.com
//   ONEMAP_PASSWORD=your-onemap-password

const BASE = "https://www.onemap.gov.sg";
const fail = (status, message) => Object.assign(new Error(message), { status });

let token = null; // OneMap tokens last about 72 hours, so keep one in memory
const hits = new Map(); // postal code -> { lat, lng }, so each postal code is looked up once

async function login() {
  const { ONEMAP_EMAIL, ONEMAP_PASSWORD } = process.env;
  if (!ONEMAP_EMAIL || !ONEMAP_PASSWORD) {
    throw fail(503, "OneMap is not set up on the server (add ONEMAP_EMAIL and ONEMAP_PASSWORD to .env)");
  }
  const res = await fetch(`${BASE}/api/auth/post/getToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ONEMAP_EMAIL, password: ONEMAP_PASSWORD }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw fail(503, `OneMap login failed (${res.status}). Check the email and password in .env`);
  const data = await res.json();
  if (!data.access_token) throw fail(503, "OneMap login did not return a token");
  token = data.access_token;
}

async function search(postal) {
  const url =
    `${BASE}/api/common/elastic/search` +
    `?searchVal=${encodeURIComponent(postal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  return fetch(url, { headers: { Authorization: token }, signal: AbortSignal.timeout(8000) });
}

// Checks a postal code with OneMap. Used by signup, profile edits and Find Nearby.
// Returns { postalCode, block, road, lat, lng }, or null if the postal code doesn't exist.
// Throws (status 503) if OneMap can't be reached, so callers can block the save.
async function lookupPostal(postalCode) {
  const postal = String(postalCode || "").trim();
  if (!/^\d{6}$/.test(postal)) return null;
  if (hits.has(postal)) return hits.get(postal);

  try {
    if (!token) await login();
    let res = await search(postal);
    if (res.status === 401 || res.status === 403) {
      await login(); // the token expired, so get a fresh one and try once more
      res = await search(postal);
    }
    if (!res.ok) throw fail(503, `OneMap search failed (${res.status})`);

    const data = await res.json();
    // OneMap's search is fuzzy: a made-up code can still return a nearby address.
    // Only accept a result whose postal code is exactly the one typed.
    const match = (data.results || []).find((result) => result.POSTAL === postal);
    if (!match) return null;
    const lat = parseFloat(match.LATITUDE); // OneMap sends numbers as text
    const lng = parseFloat(match.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const place = {
      postalCode: postal,
      // "NIL" means the address has no block number (e.g. a landed house)
      block: match.BLK_NO && match.BLK_NO !== "NIL" ? match.BLK_NO : "",
      road: match.ROAD_NAME && match.ROAD_NAME !== "NIL" ? match.ROAD_NAME : "",
      lat,
      lng,
    };
    hits.set(postal, place);
    return place;
  } catch (err) {
    if (err.status) throw err;
    throw fail(503, "Could not reach OneMap to check your postal code. Please try again."); // network error or timeout
  }
}

// Returns { lat, lng }, or null if OneMap has no match for this postal code.
async function geocodePostal(postalCode) {
  const place = await lookupPostal(postalCode);
  return place ? { lat: place.lat, lng: place.lng } : null;
}

module.exports = { lookupPostal, geocodePostal };