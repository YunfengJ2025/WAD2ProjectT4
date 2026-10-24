import { startOfDay, toDateInputValue } from "../../utils/wateringStatus.js"

// Returns a new Date 'n' days after 'date'. It copies first, because setDate changes a date in place.
export function addDays(date, n) {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
}

export function buildSchedule(plants, now = new Date(), days = 28) {
    const today = startOfDay(now)
    const end = addDays(today, days) // build dates up to (not including) this day
    const todayISO = toDateInputValue(today) // "2026-10-21"
    const items = []

    // build schedule item from plant data
    function makeItem(plant, originalDue, due, statusOverride) {
        const originalISO = toDateInputValue(originalDue)
        let status = '' // based on originalDue, overdue plants will be moved to today showing 'overdue'
        if (statusOverride) {
            status = statusOverride              // 'done' decided by the owner
        } else if (originalISO < todayISO) {
            status = 'overdue'
        } else if (originalISO === todayISO) {
            status = 'due'
        } else {
            status = 'upcoming'
        }

        const item = {
            requestItemId: `${plant.plantId}-${originalISO}`,
            plantId: plant.plantId,
            plantName: plant.plantName,
            photoUrl: plant.photoUrl || '',
            plantLocation: plant.plantLocation || '',
            status,
            originalDueAt: originalISO,
            dueAt: toDateInputValue(due), // formats a local YYYY-MM-DD
            adjustmentType: null,
            adjustmentReason: null,
        }

        return item
    }

    for (const plant of plants) {
        const freq = plant.wateringInfo.frequencyDays

        // Never watered: due today, and we cannot predict later dates
        if (!plant.lastWateredAt) {
            items.push(makeItem(plant, today, today))
            continue
        }

        // Watered today: show it as done, then count the next dates from today
        if (toDateInputValue(startOfDay(plant.lastWateredAt)) === todayISO) {
            items.push(makeItem(plant, today, today, 'done'))
        }

        // First due date = the day it was last watered + frequency
        let next = addDays(startOfDay(plant.lastWateredAt), freq)

        // Late: show it today, keep the real date as originalDueAt, assume it is watered today and count from there
        if (next < today) {
            items.push(makeItem(plant, next, today))
            next = addDays(today, freq)
        }

        // Add watering dates every 'freq' days until end of the window
        while (next < end) {
            items.push(makeItem(plant, next, next))
            next = addDays(next, freq)
        }
    }

    return items
    
}