import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, it, expect, afterEach, vi } from 'vitest'
import TokenBalance from './TokenBalance.vue'
import { useAuthStore } from '@/stores/auth'
let wrapper
// Clean up both the rendered component and action spies after every case.
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})
async function open(user, failure = false) {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.user = user
  // Refresh is a store responsibility. Replace it to keep this test offline.
  const refresh = vi.spyOn(auth, 'refreshUser')
  if (failure) refresh.mockRejectedValue(new Error('Offline'))
  else refresh.mockResolvedValue()
  wrapper = mount(TokenBalance, { global: { plugins: [pinia] } })
  await flushPromises() // onMounted awaits refresh before displaying any error.
  return auth
}
describe('TokenBalance', () => {
  it('shows balances and links the frozen amount to reservation details', async () => {
    await open({
      tokenBalance: 50,
      availableTokenBalance: 30,
      frozenTokenBalance: 20,
      tokenReservations: [{ requestId: 7, amount: 20 }],
    })
    expect(wrapper.text()).toContain('Total: 50 tokens')
    expect(wrapper.text()).toContain('Available: 30')
    expect(wrapper.get('button').text()).toContain('Frozen: 20')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('20 tokens frozen for care request #7')
    expect(wrapper.get('button').attributes('aria-describedby')).toBe(
      wrapper.get('[role="tooltip"]').attributes('id'),
    )
  })
  it('uses total as the available fallback and displays an empty reservation state', async () => {
    const auth = await open({ tokenBalance: 50 })
    expect(wrapper.text()).toContain('Available: 50')
    expect(wrapper.text()).toContain('No tokens are frozen.')
    // Act: an updated profile must update the displayed balance reactively.
    auth.user.tokenBalance = 25
    await flushPromises()
    expect(wrapper.text()).toContain('Total: 25 tokens')
  })
  it('shows zero balances when no user is available', async () => {
    await open(null)
    expect(wrapper.text()).toContain('Total: 0 tokens')
    expect(wrapper.text()).toContain('Available: 0')
  })
  it('keeps the saved balance visible when refreshing fails', async () => {
    await open({ tokenBalance: 50 }, true)
    expect(wrapper.get('[role="alert"]').text()).toContain('Offline')
    expect(wrapper.text()).toContain('Total: 50 tokens')
  })
})
