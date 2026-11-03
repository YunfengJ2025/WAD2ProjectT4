// Run from the server folder:  node scripts/testOnemap.js
require("dotenv").config({ path: "./.env" });

(async () => {
  const { ONEMAP_EMAIL, ONEMAP_PASSWORD } = process.env;
  console.log("email set:", !!ONEMAP_EMAIL, "| password set:", !!ONEMAP_PASSWORD);

  try {
    const login = await fetch("https://www.onemap.gov.sg/api/auth/post/getToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ONEMAP_EMAIL, password: ONEMAP_PASSWORD }),
    });
    const body = await login.json().catch(() => ({}));
    console.log("login status:", login.status, "| got token:", !!body.access_token);
    if (!body.access_token) {
      console.log("login reply:", JSON.stringify({ ...body, access_token: undefined }));
      return;
    }

    const res = await fetch(
      "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=200640&returnGeom=Y&getAddrDetails=Y&pageNum=1",
      { headers: { Authorization: body.access_token } },
    );
    const data = await res.json().catch(() => ({}));
    console.log("search status:", res.status, "| found:", data.found,
      "| lat/lng:", data.results?.[0]?.LATITUDE, data.results?.[0]?.LONGITUDE);
  } catch (e) {
    console.log("network error:", e.cause?.code || e.message);
  }
})();