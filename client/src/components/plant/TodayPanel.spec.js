/* TodayPanel.spec.js
 Component tests for TodayPanel.vue.
 The component receives the user's plants via props &:
   1. Lists plants that need water today, all ticked
   2. Shows plants already watered today as chips
   3. Updates the button text when a plant is unticked
   4. Shows "All caught up" when nothing needs water
*/
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import TodayPanel from './TodayPanel.vue'

// A plant last watered `daysAgo` days ago that needs water every 2 days
function makePlant(plantId, plantName, daysAgo) {
  const lastWatered = new Date()
  lastWatered.setDate(lastWatered.getDate() - daysAgo)
  return {
    plantId: plantId,
    plantName: plantName,
    lastWateredAt: lastWatered.toISOString(),
    wateringInfo: { frequencyDays: 2, amountMl: 200, notes: '' },
  }
}

// TodayPanel uses the plants store, so each test gives it a Pinia
function mountPanel(plants) {
  return mount(TodayPanel, {
    props: { plants: plants },
    global: {
      plugins: [createPinia()],
      // RouterLink needs a router, so a simple stub that just shows its text is used
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('TodayPanel', () => {
  // Verify that overdue and due plants are listed, and all start ticked.
  it('lists plants that need water, all ticked', () => {
    const wrapper = mountPanel([
      makePlant(1, 'Monstera', 4), // overdue
      makePlant(2, 'Fern', 2), // due today
      makePlant(3, 'Aloe', 0), // watered today
    ])

    const boxes = wrapper.findAll('.check-list input')
    expect(boxes).toHaveLength(2)
    expect(boxes[0].element.checked).toBe(true)
    expect(boxes[1].element.checked).toBe(true)
    expect(wrapper.text()).toContain('Monstera')
    expect(wrapper.text()).toContain('Fern')
    // overdue plant shows an overdue tag, due plant shows "Due today"
    expect(wrapper.text()).toContain('2 days overdue')
    expect(wrapper.text()).toContain('Due today')
    expect(wrapper.find('button').text()).toBe('Mark 2 as watered')
  })

  // Verify that a plant watered today appears under "Watered today".
  it('shows plants watered today', () => {
    const wrapper = mountPanel([makePlant(1, 'Monstera', 4), makePlant(3, 'Aloe', 0)])

    expect(wrapper.text()).toContain('Watered today (1)')
    expect(wrapper.find('.chips').text()).toContain('Aloe')
  })

  // Verify that unticking a plant changes how many will be watered.
  it('updates the button when a plant is unticked', async () => {
    const wrapper = mountPanel([makePlant(1, 'Monstera', 4), makePlant(2, 'Fern', 2)])

    // setValue(false) unticks the checkbox, like the user clicking it
    await wrapper.findAll('.check-list input')[1].setValue(false)

    expect(wrapper.find('button').text()).toBe('Mark 1 as watered')
  })

  // Verify that "Select all" unticks every plant, then ticks them all again.
  it('select all unticks and ticks every plant', async () => {
    const wrapper = mountPanel([makePlant(1, 'Monstera', 4), makePlant(2, 'Fern', 2)])
    const selectAll = wrapper.find('.select-all input')

    await selectAll.setValue(false)
    expect(wrapper.find('button').text()).toBe('Mark 0 as watered')

    await selectAll.setValue(true)
    expect(wrapper.find('button').text()).toBe('Mark 2 as watered')
  })

  // Verify that a due plant with unticked care steps shows under "Care to-do".
  it('shows care steps left for plants that need water', () => {
    localStorage.clear()
    const fern = makePlant(2, 'Fern', 2) // due today
    fern.wateringInfo.notes = 'Water the soil\nWipe the leaves'
    const aloe = makePlant(3, 'Aloe', 0) // not due, so not in Care to-do
    aloe.wateringInfo.notes = 'Keep dry'

    const wrapper = mountPanel([fern, aloe])

    expect(wrapper.text()).toContain('Care to-do (1)')
    expect(wrapper.find('.todo-list').text()).toContain('Fern')
    expect(wrapper.find('.todo-list').text()).toContain('2 steps left')
    expect(wrapper.find('.todo-list').text()).not.toContain('Aloe')
  })

  // Verify the empty state when nothing needs water.
  it('says all caught up when nothing needs water', () => {
    const wrapper = mountPanel([makePlant(3, 'Aloe', 0)])

    expect(wrapper.text()).toContain('All caught up')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
