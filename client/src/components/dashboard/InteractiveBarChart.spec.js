/* InteractiveBarChart.spec.js
 * Component tests for InteractiveBarChart.vue (Week 10 Slides 22–24 & 36).
 * Uses a custom stub for the child Bar chart component (Slide 23–24) to verify:
 *   1. Displays loading state when chartData has no labels
 *   2. Passes chartData prop to the child Bar component when labels exist
 */

import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { Bar } from 'vue-chartjs'
import InteractiveBarChart from './InteractiveBarChart.vue'

// Give the third-party Bar component an explicit name so Vue Test Utils can stub it by name
Bar.name = 'Bar'

describe('InteractiveBarChart', () => {
  // Test case (1): Displays loading message when chartData has no labels (Week 10 Slide 25)
  it('displays loading message when chartData has no labels', () => {
    const wrapper = mount(InteractiveBarChart, {
      props: {
        chartData: {},
      },
      global: {
        stubs: {
          Bar: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Loading visualisations…')
  })

  // Test case (2): Passes chartData to child Bar component using a custom stub (Week 10 Slide 23–24)
  it('renders Bar component and passes chartData when labels are provided', () => {
    const wrapper = mount(InteractiveBarChart, {
      props: {
        chartData: {
          labels: ['Jun', 'Jul', 'Aug'],
          datasets: [{ label: 'Visits Completed', data: [2, 4, 5] }],
        },
      },
      global: {
        stubs: {
          Bar: {
            props: ['data'],
            template: '<div>Months: {{ data.labels.join(", ") }}</div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Months: Jun, Jul, Aug')
  })
})
