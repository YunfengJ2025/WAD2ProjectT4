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

    expect(wrapper.find('.plant-care input[type="checkbox"]').element.checked).toBe(true)
    expect(wrapper.find('.plant-care input[type="number"]').element.value).toBe('100')
    expect(wrapper.find('.plant-care input[type="number"]').element.disabled).toBe(true)
    expect(wrapper.find('.plant-care textarea').element.value).toBe('Mist the leaves\nKeep out of sun')
  })

  it('follows updated plant amounts until the owner chooses a custom amount', async () => {
    const wrapper = mount(CareRequestForm, { props: { plants } })
    await wrapper.find('.plant-option').trigger('click')
    const updatedPlants = [{ ...plants[0], wateringInfo: { ...plants[0].wateringInfo, amountMl: 300 } }]
    await wrapper.setProps({ plants: updatedPlants })
    expect(wrapper.find('.plant-care input[type="number"]').element.value).toBe('300')
    await wrapper.find('.plant-care input[type="checkbox"]').setValue(false)
    await wrapper.find('.plant-care input[type="number"]').setValue(150)
    await wrapper.setProps({ plants })
    expect(wrapper.find('.plant-care input[type="number"]').element.value).toBe('150')
    expect(wrapper.text()).toContain('Custom amount for this request')
  })

  // Verify that the owner can still change them for this request.
  it('lets the owner change the instructions', async () => {
    const wrapper = mount(CareRequestForm, { props: { plants } })

    await wrapper.find('.plant-option').trigger('click')
    await wrapper.find('.plant-care textarea').setValue('Only mist today')

    expect(wrapper.find('.plant-care textarea').element.value).toBe('Only mist today')
  })
})
