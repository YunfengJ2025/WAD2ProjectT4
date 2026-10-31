import { describe, it, expect } from 'vitest'
import { applyWeatherAdjustments } from '../schedule/applyWeatherAdjustments.js'

const NOW = new Date('2026-10-22T09:00:00')   // fixed "today", local time
const TODAY = '2026-10-22'
const TOMORROW = '2026-10-23'

// A plant with both weather flags on. Pass overrides to change what a test needs.
function plant(overrides) {
  return {
    plantId: 1,
    plantName: 'Pothos',
    rainExposed: true,
    weatherAdjustmentEnabled: true,
    lastWateredAt: null,
    ...overrides,
  }
}

// A schedule item that is due today.
function item(overrides) {
  return {
    requestItemId: '1-2026-10-22',
    plantId: 1,
    plantName: 'Pothos',
    status: 'due',
    originalDueAt: TODAY,
    dueAt: TODAY,
    adjustmentType: null,
    adjustmentReason: null,
    ...overrides,
  }
}

const RAIN = { condition: 'rain', stationName: 'Bedok', tempHigh: null }
const HOT = { condition: 'sunny', stationName: 'Bedok', tempHigh: 35 }

describe('rain skip', () => {
  it('moves a due-today item to tomorrow', () => {
    const result = applyWeatherAdjustments([item()], [plant()], RAIN, NOW)

    expect(result[0].dueAt).toBe(TOMORROW)
    expect(result[0].originalDueAt).toBe(TODAY)
    expect(result[0].status).toBe('upcoming')
    expect(result[0].adjustmentType).toBe('skipped-rain')
    expect(result[0].adjustmentReason).toContain('Bedok')
  })

  it('keeps the same id when an item moves', () => {
    const result = applyWeatherAdjustments([item()], [plant()], RAIN, NOW)

    expect(result[0].requestItemId).toBe('1-2026-10-22')
  })

  it('does not move a plant that is not rain exposed', () => {
    const result = applyWeatherAdjustments([item()], [plant({ rainExposed: false })], RAIN, NOW)

    expect(result[0].dueAt).toBe(TODAY)
    expect(result[0].adjustmentType).toBeNull()
  })

  it('does not move a plant with weather adjustment turned off', () => {
    const result = applyWeatherAdjustments([item()], [plant({ weatherAdjustmentEnabled: false })], RAIN, NOW)

    expect(result[0].dueAt).toBe(TODAY)
  })

  it('does not move an overdue item', () => {
    const overdue = item({ status: 'overdue', originalDueAt: '2026-10-18' })
    const result = applyWeatherAdjustments([overdue], [plant()], RAIN, NOW)

    expect(result[0].dueAt).toBe(TODAY)
    expect(result[0].status).toBe('overdue')
  })

  it('changes nothing when it is not raining', () => {
    const weather = { condition: 'sunny', stationName: 'Bedok', tempHigh: null }
    const result = applyWeatherAdjustments([item()], [plant()], weather, NOW)

    expect(result).toEqual([item()])
  })

  it('does not change the original list', () => {
    const original = item()
    applyWeatherAdjustments([original], [plant()], RAIN, NOW)

    expect(original.dueAt).toBe(TODAY)
  })
})

describe('heat extra watering', () => {
  it('adds an extra watering today for a plant not scheduled today', () => {
    const result = applyWeatherAdjustments([], [plant()], HOT, NOW)

    expect(result).toHaveLength(1)
    expect(result[0].adjustmentType).toBe('extra-heat')
    expect(result[0].dueAt).toBe(TODAY)
    expect(result[0].originalDueAt).toBe(TODAY)
    expect(result[0].adjustmentReason).toContain('35')
  })

  it('does nothing below the 34 degree threshold', () => {
    const result = applyWeatherAdjustments([], [plant()], { ...HOT, tempHigh: 33 }, NOW)

    expect(result).toHaveLength(0)
  })

  it('does nothing when the temperature is unknown', () => {
    const result = applyWeatherAdjustments([], [plant()], { ...HOT, tempHigh: null }, NOW)

    expect(result).toHaveLength(0)
  })

  it('does nothing when it is raining', () => {
    const result = applyWeatherAdjustments([], [plant()], { ...HOT, condition: 'rain' }, NOW)

    expect(result).toHaveLength(0)
  })

  it('does not add an extra if the plant is already scheduled today', () => {
    const result = applyWeatherAdjustments([item()], [plant()], HOT, NOW)

    expect(result).toHaveLength(1)
    expect(result[0].adjustmentType).toBeNull()
  })

  it('does not add an extra if the plant was already watered today', () => {
    const watered = plant({ lastWateredAt: '2026-10-22T07:00:00' })
    const result = applyWeatherAdjustments([], [watered], HOT, NOW)

    expect(result).toHaveLength(0)
  })

  it('does not add an extra if weather adjustment is off', () => {
    const result = applyWeatherAdjustments([], [plant({ weatherAdjustmentEnabled: false })], HOT, NOW)

    expect(result).toHaveLength(0)
  })
})

describe('rain and heat together', () => {
  it('only skips for rain and adds no heat extras', () => {
    const weather = { condition: 'rain', stationName: 'Bedok', tempHigh: 35 }
    const result = applyWeatherAdjustments([item()], [plant()], weather, NOW)

    expect(result).toHaveLength(1)
    expect(result[0].adjustmentType).toBe('skipped-rain')
  })
})