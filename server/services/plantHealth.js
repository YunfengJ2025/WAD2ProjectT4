const crypto = require("node:crypto");
const HealthCheck = require("../models/healthCheckModel");

// UNCONFIRMED: confirm this URL and the request shape in your Kindwise dashboard docs
// before using live mode. It is the only place that needs to change.
const API_URL = "https://api.plant.id/v3/health_assessment";
const DETAILS = "description,treatment,cause";
const MIN_ISSUE_PROBABILITY = 0.2;   // ignore very unlikely diseases
const cache = new Map();             // same photo twice -> one paid call

const asList = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : v ? [String(v)] : []);

// Pure function: turns Plant.id's response into the small shape we store.
// It accepts is_healthy as an object ({binary, probability}) or a plain boolean.
function cleanHealthResponse(raw) {
  const result = raw?.result ?? raw?.health_assessment ?? {};
  const h = result.is_healthy;
  const healthyBinary = h && typeof h === "object" ? h.binary : h;
  const healthyProbability = h && typeof h === "object" ? h.probability : result.is_healthy_probability;

  const suggestions = result.disease?.suggestions ?? result.diseases ?? [];
  const issues = suggestions
    .filter((s) => (s.probability ?? 0) >= MIN_ISSUE_PROBABILITY)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map((s) => {
      const d = s.details ?? s.disease_details ?? {};
      const t = d.treatment ?? {};
      return {
        name: s.name,
        probability: Math.round(s.probability * 100) / 100,
        description: d.description || "",
        cause: d.cause || "",
        commonNames: asList(d.common_names),
        treatment: {
          prevention: asList(t.prevention),
          biological: asList(t.biological),
          chemical: asList(t.chemical),
        },
      };
    });

  const isHealthy = typeof healthyBinary === "boolean" ? healthyBinary : issues.length === 0;
  return {
    isHealthy,
    healthProbability: typeof healthyProbability === "number" ? healthyProbability : null,
    issues: isHealthy ? [] : issues,
  };
}

// Mock: odd plant ids come back healthy, even ones sick, so you can test both.
function mockResponse(plantId) {
  if (plantId % 2 === 1)
    return { result: { is_healthy: { binary: true, probability: 0.93 }, disease: { suggestions: [] } } };
  return {
    result: {
      is_healthy: { binary: false, probability: 0.12 },
      disease: {
        suggestions: [
          {
            name: "Leaf spot",
            probability: 0.71,
            details: {
              description: "Brown or black spots on the leaves, often from wet foliage.",
              cause: "Fungal infection, helped by water sitting on the leaves.",
              treatment: {
                prevention: ["Water the soil, not the leaves.", "Give the plant more airflow."],
                biological: ["Remove the affected leaves."],
                chemical: ["Use a copper-based fungicide if it spreads."],
              },
            },
          },
          { name: "Overwatering", probability: 0.18, details: {} },   // below the cut-off, filtered out
        ],
      },
    },
  };
}

async function callPlantId(buffer, mimetype) {
  const res = await fetch(`${API_URL}?details=${DETAILS}`, {
    method: "POST",
    headers: { "Api-Key": process.env.PLANT_ID_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ images: [buffer.toString("base64")] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Plant.id responded ${res.status}`);
  return res.json();
}

async function analysePhoto({ buffer, mimetype, plantId }) {
  const live = process.env.PLANT_HEALTH_MODE === "live" && process.env.PLANT_ID_API_KEY;
  if (!live) return { provider: "mock", ...cleanHealthResponse(mockResponse(plantId)) };

  const key = crypto.createHash("sha256").update(buffer).digest("hex");
  if (!cache.has(key)) cache.set(key, cleanHealthResponse(await callPlantId(buffer, mimetype)));
  return { provider: "plant.id", ...cache.get(key) };
}

// Runs one check per plant, one after another. Never throws: a failure is saved as "failed".
async function runHealthChecks({ items, filesByPlant, ownerId, visitId }) {
  for (const item of items) {
    const base = { requestItemId: item.requestItemId, visitId, plantId: item.plantId, ownerId };
    try {
      const file = filesByPlant.get(item.plantId);
      const outcome = await analysePhoto({ buffer: file.buffer, mimetype: file.mimetype, plantId: item.plantId });
      await HealthCheck.create({ ...base, status: "completed", ...outcome });
    } catch (err) {
      console.warn(`Health check failed for plant ${item.plantId}:`, err.message);
      await HealthCheck.create({ ...base, status: "failed", error: err.message }).catch(() => {});
    }
  }
}

module.exports = { cleanHealthResponse, analysePhoto, runHealthChecks };