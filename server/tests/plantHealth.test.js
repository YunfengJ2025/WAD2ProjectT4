const test = require("node:test");
const assert = require("node:assert");
const { cleanHealthResponse } = require("../services/plantHealth");

test("healthy plant has no issues", () => {
  const out = cleanHealthResponse({ result: { is_healthy: { binary: true, probability: 0.9 }, disease: { suggestions: [] } } });
  assert.equal(out.isHealthy, true);
  assert.deepEqual(out.issues, []);
});

test("sick plant keeps likely issues only, most likely first", () => {
  const out = cleanHealthResponse({ result: { is_healthy: { binary: false, probability: 0.1 }, disease: { suggestions: [
    { name: "B", probability: 0.3, details: {} },
    { name: "A", probability: 0.8, details: { treatment: { prevention: "Water less" } } },
    { name: "C", probability: 0.05, details: {} },
  ] } } });
  assert.equal(out.isHealthy, false);
  assert.deepEqual(out.issues.map((i) => i.name), ["A", "B"]);
  assert.deepEqual(out.issues[0].treatment.prevention, ["Water less"]);
});

test("missing fields do not crash", () => {
  assert.equal(cleanHealthResponse({}).isHealthy, true);
});