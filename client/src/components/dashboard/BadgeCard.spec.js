import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import BadgeCard from './BadgeCard.vue'

describe('BadgeCard', () => {
  it('displays Unlocked status, checkmark, and 100% width when badge is unlocked', () => {
    const wrapper = mount(BadgeCard, {
      props: {
        badge: {
          id: 'first_sit',
          name: 'First Sit',
          description: 'Completed your first plant sitting visit!',
          unlocked: true,
          progress: 100,
          icon: '🌱',
        },
      },
    })

    expect(wrapper.text()).toContain('First Sit')
    expect(wrapper.text()).toContain('Completed your first plant sitting visit!')
    expect(wrapper.text()).toContain('✓')
    expect(wrapper.text()).toContain('Unlocked 🎉')
    expect(wrapper.find('.progress-fill').attributes('style')).toContain('width: 100%')
  })

  it('displays percentage progress and no checkmark when badge is locked', () => {
    const wrapper = mount(BadgeCard, {
      props: {
        badge: {
          id: 'ten_plants_saved',
          name: '10 Plants Saved',
          description: 'Successfully watered and cared for 10 plants.',
          unlocked: false,
          progress: 40,
          icon: '🌿',
        },
      },
    })

    expect(wrapper.text()).toContain('10 Plants Saved')
    expect(wrapper.text()).not.toContain('✓')
    expect(wrapper.text()).toContain('40% completed')
    expect(wrapper.find('.progress-fill').attributes('style')).toContain('width: 40%')
  })
})
