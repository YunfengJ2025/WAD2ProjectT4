/* AssignedVisitCard.spec.js
 Care checklist (Carolyn): component tests for the sitter's care checklist.
 The card receives a visit via props and shows the plant's care notes as checkboxes.
*/
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import AssignedVisitCard from './AssignedVisitCard.vue'

function makeVisit(notes) {
  return {
    visitId: 1,
    visitDate: '2026-11-03T02:00:00.000Z',
    status: 'accepted',
    request: { tokenReward: 2, waterSource: 'tap_available' },
    items: [
      {
        requestItemId: 10,
        plantId: 5,
        amountToWater: 200,
        plant: { plantId: 5, plantName: 'Monstera', wateringInfo: { notes: notes } },
      },
    ],
  }
}

describe('AssignedVisitCard care checklist', () => {
  // Verify that each line of the care notes becomes one checkbox.
  it('shows the care notes as checklist steps', () => {
    const wrapper = mount(AssignedVisitCard, {
      props: { visit: makeVisit('Water the soil\nWipe the leaves') },
    })

    expect(wrapper.findAll('.care-checklist input')).toHaveLength(2)
    expect(wrapper.text()).toContain('Water the soil')
    expect(wrapper.text()).toContain('0 of 2 done')
  })

  // Verify that ticking a step updates the count.
  it('counts the ticked steps', async () => {
    const wrapper = mount(AssignedVisitCard, {
      props: { visit: makeVisit('Water the soil\nWipe the leaves') },
    })

    await wrapper.findAll('.care-checklist input')[0].setValue(true)

    expect(wrapper.text()).toContain('1 of 2 done')
  })

  // Verify that no checklist shows when the plant has no care notes.
  it('hides the checklist when there are no care notes', () => {
    const wrapper = mount(AssignedVisitCard, { props: { visit: makeVisit('') } })

    expect(wrapper.find('.care-checklist').exists()).toBe(false)
  })
})
