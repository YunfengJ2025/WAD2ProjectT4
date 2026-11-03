/* CareRequestForm.spec.js
 Care checklist (Carolyn): when a plant is picked for a request, its water amount
 and care notes are filled in from the plant's profile.
*/
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import CareRequestForm from './CareRequestForm.vue'

const plants = [
  {
    plantId: 5,
    plantName: 'Orchid',
    plantLocation: 'Window shelf',
    wateringInfo: { frequencyDays: 3, amountMl: 100, notes: 'Mist the leaves\nKeep out of sun' },
  },
]

describe('CareRequestForm plant details', () => {
  // Verify that picking a plant fills in its amount and instructions.
  it('fills in the amount and instructions from the plant', async () => {
    const wrapper = mount(CareRequestForm, { props: { plants } })

    await wrapper.find('.plant-option').trigger('click')

    expect(wrapper.find('.plant-care input').element.value).toBe('100')
    expect(wrapper.find('.plant-care textarea').element.value).toBe('Mist the leaves\nKeep out of sun')
  })

  // Verify that the owner can still change them for this request.
  it('lets the owner change the instructions', async () => {
    const wrapper = mount(CareRequestForm, { props: { plants } })

    await wrapper.find('.plant-option').trigger('click')
    await wrapper.find('.plant-care textarea').setValue('Only mist today')

    expect(wrapper.find('.plant-care textarea').element.value).toBe('Only mist today')
  })
})
