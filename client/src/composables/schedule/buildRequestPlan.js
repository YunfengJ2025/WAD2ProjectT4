import { buildSchedule, addDays } from './buildSchedule.js'

// startISO / endISO: "YYYY-MM-DD", both included.
// Returns [{ date, plantIds }] for the days where at least one plant is due.
export function buildRequestPlan(plants, startISO, endISO) {
    const start = new Date(`${startISO}T00:00:00`)
    const days = Math.round((new Date(`${endISO}T00:00:00`) - start) / 86_400_000) + 1

    // buildSchedule shows a never-watered plant on one day only, but a request needs it on
    // every later due day too. Pretend it was last watered one cycle before the start,
    // so its first visit is the start date and the rest follow every frequencyDays.
    const prepared = plants.map((plant) =>
        plant.lastWateredAt
            ? plant
            : { ...plant, lastWateredAt: addDays(start, -plant.wateringInfo.frequencyDays) },
    )

    const byDate = {}
    for (const item of buildSchedule(prepared, start, days)) {
        if (item.status === 'done') continue // watered on the start day itself: no visit needed that day
        if (!byDate[item.dueAt]) byDate[item.dueAt] = []
        byDate[item.dueAt].push(item.plantId)
    }

    return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, plantIds]) => ({ date, plantIds }))
}