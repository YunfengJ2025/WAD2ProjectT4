import { expect, it } from 'vitest'
import { ownerAddress } from './visitFormat'

it('formats a participant address without missing-field separators', () => {
  expect(ownerAddress({ block: '123', unitNumber: '#02-01', postalCode: '560123' }))
    .toBe('Blk 123, #02-01, Singapore 560123')
  expect(ownerAddress({ postalCode: '560123' })).toBe('Singapore 560123')
  expect(ownerAddress(null)).toBe('')
})
