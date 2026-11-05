import { toDateInputValue } from './wateringStatus'

// Turns a plant's care notes into checklist steps: one step per line.
// Used by PlantDetailView (owner) and can be reused on the care visit page (helper),
// so both split the notes the same way.
//
// "Water the soil\n\nWipe the leaves " -> ["Water the soil", "Wipe the leaves"]
export function getCareSteps(notes) {
  if (!notes) return []
  const steps = []
  for (const line of notes.split('\n')) {
    // skip empty lines and remove spaces at the start/end
    if (line.trim() !== '') steps.push(line.trim())
  }
  return steps
}

// Steps for one plant in a care request (sitter side).
// Uses the owner's instructions for that request; if they left it empty,
// falls back to the plant's own care notes.
export function getRequestSteps(item) {
  return getCareSteps(item.careInstructions || item.plant?.wateringInfo?.notes || item.wateringInfo?.notes)
}

// The owner's ticks are kept in localStorage until the plant is watered again, e.g.
// "care-checklist-5" ->
//   {"wateredAt":"2026-11-02T03:00:00.000Z","savedOn":"2026-11-02","done":["Water the soil"]}
// Watering the plant changes lastWateredAt, so the checklist starts fresh,
// unless the steps were ticked earlier the same day (ticked first, then watered).
function storageKey(plant) {
  return `care-checklist-${plant.plantId}`
}

// The steps ticked since the plant was last watered
export function getDoneSteps(plant) {
  const saved = JSON.parse(localStorage.getItem(storageKey(plant)) || 'null')
  if (!saved) return []
  // Not watered since the ticks were saved: keep them
  if (saved.wateredAt === (plant.lastWateredAt || null)) return saved.done
  // Watered since, but the ticks are from today: they belong to this watering
  if (saved.savedOn === toDateInputValue(new Date())) return saved.done
  // Ticks from an earlier watering: start fresh
  return []
}

export function saveDoneSteps(plant, done) {
  const data = {
    wateredAt: plant.lastWateredAt || null,
    savedOn: toDateInputValue(new Date()), // the day the ticks were last changed
    done: done,
  }
  localStorage.setItem(storageKey(plant), JSON.stringify(data))
}
