import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { Bar } from 'vue-chartjs'
import InteractiveBarChart from './InteractiveBarChart.vue'

Bar.name = 'Bar'

describe('InteractiveBarChart', () => {
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
