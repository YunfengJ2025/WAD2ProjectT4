import { startOfDay, toDateInputValue } from '../../utils/wateringStatus.js'

// Turns the visits from GET /care-visits into the same item shape buildSchedule makes,
// so the calendar and list can show them without changing.
export function buildSitterSchedule(visits, now = new Date()) {
    const todayISO = toDateInputValue(startOfDay(now))
    const items = []

    for (const visit of visits ?? []) {
        if (['cancelled', 'missed', 'expired'].includes(visit.status)) continue

        for (const item of visit.items ?? []) {
            if (['cancelled', 'missed'].includes(item.status) || !item.plant) continue

            const plannedISO = toDateInputValue(item.originalDueAt) // the day the owner asked for
            let status, dueAt, originalDueAt

            if (item.status === 'completed') {
                // the server sets dueAt to the moment you submitted proof
                dueAt = toDateInputValue(item.dueAt)
                if (dueAt < todayISO) continue // finished on an earlier day, not part of the schedule
                status = 'done'
                originalDueAt = dueAt
            } else if (plannedISO < todayISO) {
                continue // that day has passed: proof can no longer be submitted and the server marks it missed
            } else if (plannedISO === todayISO) {
                status = 'due'
                dueAt = originalDueAt = plannedISO
            } else {
                status = 'upcoming'
                dueAt = originalDueAt = plannedISO
            }

            // the server stores the string "none" when there is no adjustment
            const adjusted = item.adjustmentType && item.adjustmentType !== 'none'

            items.push({
                requestItemId: item.requestItemId,
                plantId: item.plantId,
                plantName: item.plant.plantName,
                photoUrl: item.plant.photoUrl || '',
                plantLocation: item.plant.plantLocation || '',
                status,
                originalDueAt,
                dueAt,
                adjustmentType: adjusted ? item.adjustmentType : null,
                adjustmentReason: adjusted ? item.adjustmentReason || null : null,
                // extra fields the calendar and list ignore, but the card link uses
                visitId: visit.visitId,
                ownerName: visit.owner?.userName ?? '',
                link: { path: '/requests', query: { tab: 'sits' } },
            })
        }
    }

    return items
}