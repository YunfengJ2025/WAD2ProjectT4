import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import TokenBalance from './TokenBalance.vue'

// Verify that balance values and request reasons share an accessible tooltip relationship.
it('shows balances and the request reasons in the keyboard-accessible hover card', async () => {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.user = { tokenBalance: 50, frozenTokenBalance: 20, availableTokenBalance: 30,
    tokenReservations: [{ requestId: 7, amount: 20 }] }
  vi.spyOn(auth, 'refreshUser').mockResolvedValue()
  const wrapper = mount(TokenBalance, { global: { plugins: [pinia] } })
  await flushPromises()
  expect(wrapper.text()).toContain('Total: 50 tokens')
  expect(wrapper.text()).toContain('Available: 30')
  expect(wrapper.get('button').text()).toContain('Frozen: 20')
  expect(wrapper.get('[role="tooltip"]').text()).toContain('20 tokens frozen for care request #7')
  expect(wrapper.get('button').attributes('aria-describedby')).toBe(wrapper.get('[role="tooltip"]').attributes('id'))
  wrapper.unmount()
})
