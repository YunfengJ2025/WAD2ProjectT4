/* DashboardView.spec.js
 * Component & Integration tests for DashboardView.vue (Week 10 Slides 22–25, 31–32 & Ex2a).
 * Verifies that DashboardView:
 *   1. Renders user greeting, neighbourhood, token balance, and all 4 stat cards
 *   2. Coordinates and renders child BadgeCard components with their props (Integration test, Slide 31–32)
 */

import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import DashboardView from './DashboardView.vue'

function mountDashboard() {
  return mount(DashboardView, {
    global: {
      plugins: [createPinia()],
      // Stub router-link and chart child components (Week 10 Slide 23)
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
        InteractiveBarChart: { template: '<div></div>' },
      },
    },
  })
}

describe('DashboardView', () => {
  // Test case (1): Displays user greeting, token pill breakdown, and 4 stat cards (Week 10 Ex2a)
  it('displays user greeting, token breakdown, and stat cards when state updates', async () => {
    const wrapper = mountDashboard()

    wrapper.vm.userData = {
      name: 'caro',
      neighbourhood: 'Blk 448B',
      tokenBalance: 37,
      availableTokenBalance: 30,
      frozenTokenBalance: 7,
      ratingAverage: 4.5,
    }
    wrapper.vm.stats = {
      totalPlantsOwned: 6,
      careRequestsPosted: 21,
      visitsCompleted: 27,
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('caro')
    expect(wrapper.text()).toContain('Blk 448B')
    expect(wrapper.text()).toContain('37')
    expect(wrapper.text()).toContain('(30 Avail · 7 Frozen)')
    expect(wrapper.text()).toContain('6')
    expect(wrapper.text()).toContain('21')
    expect(wrapper.text()).toContain('27')
    expect(wrapper.text()).toContain('4.5')
  })

  // Test case (2): Integration test verifying DashboardView and child BadgeCard components work together (Week 10 Slide 31–32)
  it('renders child BadgeCard components for unlocked and locked milestone badges', async () => {
    const wrapper = mountDashboard()

    wrapper.vm.badges = [
      {
        id: 'first_sit',
        name: 'First Sit',
        description: 'Completed your first plant sitting visit!',
        unlocked: true,
        progress: 100,
        icon: '🌱',
      },
      {
        id: 'ten_plants_saved',
        name: '10 Plants Saved',
        description: 'Successfully watered and cared for 10 plants.',
        unlocked: false,
        progress: 60,
        icon: '🌿',
      },
    ]
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('First Sit')
    expect(wrapper.text()).toContain('Unlocked 🎉')
    expect(wrapper.text()).toContain('10 Plants Saved')
    expect(wrapper.text()).toContain('60% completed')
  })
})
