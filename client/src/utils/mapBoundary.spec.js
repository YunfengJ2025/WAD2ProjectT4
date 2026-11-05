import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isWithinSingapore } from './mapBoundary'

const areas = JSON.parse(readFileSync('public/sg-areas.json', 'utf8'))

describe('Singapore search pin boundary', () => {
  it.each([
    ['central Singapore', 103.85, 1.3],
    ['Tampines', 103.944, 1.354],
    ['Sentosa', 103.83, 1.25],
  ])('accepts %s using the actual map boundary', (_, lng, lat) => {
    expect(isWithinSingapore({ lng, lat }, areas)).toBe(true)
  })

  it.each([
    ['sea inside the camera rectangle', 103.8, 1.17],
    ['Johor', 103.76, 1.49],
    ['Batam', 104.03, 1.05],
    ['far outside the map', 0, 0],
  ])('rejects %s', (_, lng, lat) => {
    expect(isWithinSingapore({ lng, lat }, areas)).toBe(false)
  })

  it('rejects invalid coordinates and unavailable boundaries', () => {
    expect(isWithinSingapore({ lng: NaN, lat: 1.3 }, areas)).toBe(false)
    expect(isWithinSingapore({ lng: 103.85, lat: 1.3 }, null)).toBe(false)
  })

  it('handles polygon holes and separate islands', () => {
    const boundary = { features: [{ geometry: { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
      [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
    ] } }] }
    expect(isWithinSingapore({ lng: 3, lat: 3 }, boundary)).toBe(true)
    expect(isWithinSingapore({ lng: 1.5, lat: 1.5 }, boundary)).toBe(false)
    expect(isWithinSingapore({ lng: 5.5, lat: 5.5 }, boundary)).toBe(true)
    expect(isWithinSingapore({ lng: 0, lat: 2 }, boundary)).toBe(true)
  })
})
