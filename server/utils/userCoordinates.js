// Where a user lives, as { lat, lng }. Shared by Find Nearby and the weather banner.
// Signup never saves coordinates, so the first call looks the postal code up with
// OneMap and saves the result on the user. Every later call reads it from the database.
// (updateProfile clears lat/lng when the postal code or block changes.)

const { User } = require("../models/userModel");
const { geocodePostal } = require("./onemap");

// Returns { lat, lng }, or null if OneMap has no match. Throws (status 503) if OneMap is down.
async function coordinatesOf(user) {
  if (Number.isFinite(user.lat) && Number.isFinite(user.lng)) {
    return { lat: user.lat, lng: user.lng };
  }
  const pos = await geocodePostal(user.postalCode);
  if (pos) await User.updateOne({ userId: user.userId }, { $set: { lat: pos.lat, lng: pos.lng } });
  return pos;
}

module.exports = { coordinatesOf };
