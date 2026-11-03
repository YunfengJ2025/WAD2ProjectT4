// Component tests for PlantIcon.vue
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PlantIcon from './PlantIcon.vue'

describe('PlantIcon', () => {
  it('draws the chosen plant type', () => {
    const wrapper = mount(PlantIcon, { props: { type: 'cactus' } })
    expect(wrapper.attributes('aria-label')).toBe('Cactus')
  })

  it('shows the wilted plant when overdue', () => {
    const wrapper = mount(PlantIcon, { props: { type: 'cactus', overdue: true } })
    expect(wrapper.attributes('aria-label')).toBe('Wilted plant (overdue)')
  })

  it('uses the size for width and height', () => {
    const wrapper = mount(PlantIcon, { props: { size: 24 } })
    expect(wrapper.attributes('width')).toBe('24')
    expect(wrapper.attributes('height')).toBe('24')
  })
})

describe('PlantIcon new types', () => {
  it('draws the snake plant, monstera, vine and succulent', () => {
    expect(mount(PlantIcon, { props: { type: 'snake' } }).attributes('aria-label')).toBe(
      'Snake plant',
    )
    expect(mount(PlantIcon, { props: { type: 'monstera' } }).attributes('aria-label')).toBe(
      'Monstera',
    )
    expect(mount(PlantIcon, { props: { type: 'vine' } }).attributes('aria-label')).toBe(
      'Hanging vine',
    )
    expect(mount(PlantIcon, { props: { type: 'succulent' } }).attributes('aria-label')).toBe(
      'Succulent',
    )
  })

  it('draws a full succulent rosette (9 + 7 + 5 leaves)', () => {
    const wrapper = mount(PlantIcon, { props: { type: 'succulent' } })
    expect(wrapper.findAll('path').length).toBeGreaterThanOrEqual(21)
  })
})
