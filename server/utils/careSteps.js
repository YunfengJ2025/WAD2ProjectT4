// Care checklist (Carolyn): same rule as client/src/utils/careSteps.js,
// so the server and the browser count the steps the same way.
// "Water the soil\n\nWipe the leaves " -> ["Water the soil", "Wipe the leaves"]
function getCareSteps(notes) {
  if (!notes) return [];
  const steps = [];
  for (const line of String(notes).split("\n")) {
    if (line.trim() !== "") steps.push(line.trim());
  }
  return steps;
}

// Steps for one plant in a visit: this request's instructions, else the plant's notes
function getRequestSteps(item, plant) {
  return getCareSteps(item.careInstructions || plant?.wateringInfo?.notes);
}

module.exports = { getCareSteps, getRequestSteps };
