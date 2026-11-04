import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import UserAvatar from './UserAvatar.vue'

// Component contract: render the supplied photo, or a safe initial fallback.
// No router, store, or server is needed for this presentational component.
describe('UserAvatar', () => {
  it('shows the supplied user photo and accessible description', () => {
    // Arrange: supply public profile data through props.
    const wrapper = mount(UserAvatar, {
      props: { user: { userName: 'Alice', photoUrl: '/alice.png' } },
    })
    // Assert: check the visible identity rather than internal computed properties.
    expect(wrapper.get('img').attributes('src')).toBe('/alice.png')
    expect(wrapper.get('img').attributes('alt')).toBe("Alice's profile photo")
    wrapper.unmount()
  })
  it('falls back after a broken image and recovers when the photo changes', async () => {
    const wrapper = mount(UserAvatar, {
      props: { user: { userName: ' alice ', photoUrl: '/old.png' } },
    })
    // Act: simulate the browser reporting an unavailable image.
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('A')
    await wrapper.setProps({ user: { userName: 'Alice', photoUrl: '/new.png' } })
    expect(wrapper.get('img').attributes('src')).toBe('/new.png')
    wrapper.unmount()
  })
  it('handles missing user details without crashing', () => {
    const wrapper = mount(UserAvatar)
    expect(wrapper.text()).toBe('U')
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
})
