import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ScrollToTop from './ScrollToTop.vue'
let wrapper
let container
beforeEach(() => {
  vi.stubGlobal('scrollY', 0)
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  container = document.createElement('main')
  container.innerHTML = '<h1>Community</h1>'
  document.body.appendChild(container)
})
afterEach(() => {
  wrapper?.unmount()
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function scroll(y) {
  vi.stubGlobal('scrollY', y)
  window.dispatchEvent(new Event('scroll'))
  await flushPromises()
}
function mountButton(props = {}) {
  wrapper = mount(ScrollToTop, { props, global: { stubs: { transition: false } } })
}
it('appears only past the threshold and disappears on return to the top', async () => {
  mountButton()
  expect(document.querySelector('.scroll-to-top')).toBeNull()
  await scroll(401)
  expect(document.querySelector('.scroll-to-top').getAttribute('aria-label')).toBe('Scroll to top')
  await scroll(0)
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(document.querySelector('.scroll-to-top')).toBeNull()
})
it('smoothly returns to the top and restores heading focus without a second scroll', async () => {
  vi.stubGlobal('scrollY', 600)
  mountButton()
  await flushPromises()
  document.querySelector('.scroll-to-top').click()
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  const heading = container.querySelector('h1')
  expect(document.activeElement).toBe(heading)
  heading.blur()
  expect(heading.hasAttribute('tabindex')).toBe(false)
})
it('respects reduced motion and supports a custom visibility threshold', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  vi.stubGlobal('scrollY', 150)
  mountButton({ threshold: 100 })
  await flushPromises()
  document.querySelector('.scroll-to-top').click()
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})
it('removes its scroll listener on unmount', () => {
  const add = vi.spyOn(window, 'addEventListener')
  const remove = vi.spyOn(window, 'removeEventListener')
  mountButton()
  const listener = add.mock.calls.find(call => call[0] === 'scroll')
  expect(listener[2]).toEqual({ passive: true })
  wrapper.unmount()
  expect(remove).toHaveBeenCalledWith('scroll', listener[1])
  wrapper = null
})
