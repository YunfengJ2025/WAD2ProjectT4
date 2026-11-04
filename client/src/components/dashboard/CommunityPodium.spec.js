/* CommunityPodium.spec.js
 * Component tests for CommunityPodium.vue (Week 10 Slides 20–24 & 35–36).
 * Receives top leaders via props and verifies:
 *   1. Renders top 3 caregivers on Gold (#1), Silver (#2), and Bronze (#3) podium cards
 *   2. Hides podium when fewer than 3 leaders are provided (conditional rendering, Slide 25)
 */

import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import CommunityPodium from './CommunityPodium.vue'

describe('CommunityPodium', () => {
  // Test case (1): Renders top 3 caregivers on Gold, Silver, and Bronze podium cards
  it('renders top 3 caregivers with names and token counts on the podium', () => {
    const wrapper = mount(CommunityPodium, {
      props: {
        leaders: [
          { id: 1, name: 'Ari', availableTokens: 248, photoUrl: '' },
          { id: 2, name: 'Marcus Tan', availableTokens: 180, photoUrl: '' },
          { id: 3, name: 'Siti R.', availableTokens: 142, photoUrl: '' },
        ],
      },
      global: {
        // Automatic stub for RouterLink (Week 10 Slide 23)
        stubs: { RouterLink: true },
      },
    })

    expect(wrapper.text()).toContain('Community Champions 🏆')
    expect(wrapper.find('.podium-card.gold').text()).toContain('Ari')
    expect(wrapper.find('.podium-card.gold').text()).toContain('248')
    expect(wrapper.find('.podium-card.silver').text()).toContain('Marcus Tan')
    expect(wrapper.find('.podium-card.silver').text()).toContain('180')
    expect(wrapper.find('.podium-card.bronze').text()).toContain('Siti R.')
    expect(wrapper.find('.podium-card.bronze').text()).toContain('142')
  })

  // Test case (2): Conditional rendering when fewer than 3 leaders exist (Week 10 Slide 25)
  it('does not render podium when fewer than 3 leaders are provided', () => {
    const wrapper = mount(CommunityPodium, {
      props: {
        leaders: [{ id: 1, name: 'Ari', availableTokens: 248 }],
      },
      global: {
        stubs: { RouterLink: true },
      },
    })

    expect(wrapper.text()).toBe('')
  })
})
