import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import LeaderboardView from './LeaderboardView.vue'

const sampleLeaderboard = [
  { id: 1, name: 'ari', availableTokens: 248, ratingAverage: 4.9, photoUrl: '' },
  { id: 2, name: 'Marcus Tan', availableTokens: 180, ratingAverage: 4.8, photoUrl: '' },
  { id: 3, name: 'Siti R.', availableTokens: 142, ratingAverage: 4.9, photoUrl: '' },
  { id: 4, name: 'bob', availableTokens: 95, ratingAverage: 5.0, photoUrl: '' },
]

function mountLeaderboard() {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.user = { userId: 2, userName: 'Marcus Tan', hideFromLeaderboard: false }

  return mount(LeaderboardView, {
    global: {
      plugins: [pinia],
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('LeaderboardView', () => {
  it('displays Top 3 Podium, rank medals, and highlights the logged-in user row', async () => {
    const wrapper = mountLeaderboard()

    wrapper.vm.leaderboard = sampleLeaderboard
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.podium-card.gold').text()).toContain('ari')
    expect(wrapper.find('.podium-card.silver').text()).toContain('Marcus Tan')
    expect(wrapper.find('.podium-card.bronze').text()).toContain('Siti R.')

    const rows = wrapper.findAll('.lb-row')
    expect(rows).toHaveLength(4)
    expect(rows[0].text()).toContain('🥇')
    expect(rows[1].text()).toContain('🥈')
    expect(rows[1].text()).toContain('You')
    expect(rows[3].text()).toContain('#4')
  })

  it('hides the current user and recalculates remaining ranks when opt-out is enabled', async () => {
    const wrapper = mountLeaderboard()

    wrapper.vm.leaderboard = sampleLeaderboard
    wrapper.vm.isOptedOut = true
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.lb-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('ari')
    expect(rows[1].text()).toContain('Siti R.')
    expect(rows[1].text()).toContain('🥈')
    expect(rows[2].text()).toContain('bob')
    expect(rows[2].text()).toContain('🥉')
  })

  it('displays empty state message when leaderboard has no neighbours', async () => {
    const wrapper = mountLeaderboard()

    wrapper.vm.leaderboard = []
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.podium-section').exists()).toBe(false)
    expect(wrapper.text()).toContain('No neighbours on the leaderboard yet!')
  })
})
