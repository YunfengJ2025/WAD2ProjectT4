// Unit tests for getCareSteps (careSteps.js)
import { describe, it, expect } from 'vitest'
import { getCareSteps, getDoneSteps, saveDoneSteps, getRequestSteps } from './careSteps'

describe('getCareSteps', () => {
  it('makes one step per line', () => {
    expect(getCareSteps('Water the soil\nWipe the leaves')).toEqual([
      'Water the soil',
      'Wipe the leaves',
    ])
  })

  it('keeps commas inside a step', () => {
    expect(getCareSteps('Water slowly, not on the leaves')).toEqual([
      'Water slowly, not on the leaves',
    ])
  })

  it('skips empty lines and extra spaces', () => {
    expect(getCareSteps('  Water  \n\n   \nTurn the pot')).toEqual(['Water', 'Turn the pot'])
  })

  it('returns an empty list when there are no notes', () => {
    expect(getCareSteps('')).toHaveLength(0)
    expect(getCareSteps(null)).toHaveLength(0)
  })
})

describe('getDoneSteps / saveDoneSteps', () => {
  it('remembers ticks until the plant is watered again', () => {
    localStorage.clear()
    const plant = { plantId: 1, lastWateredAt: '2026-11-01T03:00:00.000Z' }

    saveDoneSteps(plant, ['Water the soil'])
    expect(getDoneSteps(plant)).toEqual(['Water the soil'])
  })

  it('keeps ticks made earlier today when the plant is then watered', () => {
    localStorage.clear()
    const plant = { plantId: 1, lastWateredAt: '2026-11-01T03:00:00.000Z' }
    saveDoneSteps(plant, ['Water the soil']) // ticked today, before watering

    const wateredNow = { plantId: 1, lastWateredAt: new Date().toISOString() }
    expect(getDoneSteps(wateredNow)).toEqual(['Water the soil'])
  })

  it('starts fresh when the ticks are from an earlier watering', () => {
    localStorage.clear()
    // ticks saved on an earlier day, for the previous watering
    const old = { wateredAt: '2026-11-01T03:00:00.000Z', savedOn: '2026-11-01', done: ['Water the soil'] }
    localStorage.setItem('care-checklist-1', JSON.stringify(old))

    const wateredAgain = { plantId: 1, lastWateredAt: '2026-11-07T03:00:00.000Z' }
    expect(getDoneSteps(wateredAgain)).toEqual([])
  })

  it('returns no ticks when nothing was saved', () => {
    localStorage.clear()
    expect(getDoneSteps({ plantId: 2, lastWateredAt: null })).toHaveLength(0)
  })
})

it('uses request instructions before nested or flat plant notes', () => {
  expect(getRequestSteps({ careInstructions: 'Turn pot', plant: { wateringInfo: { notes: 'Water' } } })).toEqual(['Turn pot'])
  expect(getRequestSteps({ plant: { wateringInfo: { notes: 'Water' } } })).toEqual(['Water'])
  expect(getRequestSteps({ wateringInfo: { notes: 'Water\nWipe leaves' } })).toEqual(['Water', 'Wipe leaves'])
})
