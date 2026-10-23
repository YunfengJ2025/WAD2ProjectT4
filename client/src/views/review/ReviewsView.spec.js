import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReviewsView from './ReviewsView.vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import ReviewForm from '@/components/review/ReviewForm.vue'

describe('review preview', () => {
  it('filters post comments and shows an empty search state', async () => {
    const wrapper = mount(ReviewsView)
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(3)
    await wrapper.get('button[aria-pressed="false"]:last-child').trigger('click')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(1)
    expect(wrapper.findComponent(ReviewCard).props('review').type).toBe('POST')
    await wrapper.get('#review-search').setValue('no matching message')
    expect(wrapper.text()).toContain('No reviews found')
    wrapper.unmount()
  })

  it('requires a visit rating, shares a review, and prevents reviewing that visit twice', async () => {
    const wrapper = mount(ReviewsView)
    await wrapper.get('.page-heading button').trigger('click')
    const form = wrapper.getComponent(ReviewForm)
    await form.get('select').setValue('visit-101')
    await form.get('textarea').setValue('Thank you for looking after my plants.')
    await form.get('form').trigger('submit')
    expect(form.get('[role="alert"]').text()).toContain('Choose a star rating')
    await form.get('input[value="5"]').setValue(true)
    await form.get('form').trigger('submit')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(4)
    expect(wrapper.findAllComponents(ReviewCard)[0].text()).toContain('Thank you for looking after my plants.')
    await wrapper.get('.page-heading button').trigger('click')
    expect(wrapper.getComponent(ReviewForm).find('option[value="visit-101"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('adds a reply under its parent without creating another top-level review', async () => {
    const wrapper = mount(ReviewsView)
    const card = wrapper.findAllComponents(ReviewCard).find(item => item.props('review').type === 'POST')
    await card.get('.reply-button').trigger('click')
    await card.get('textarea').setValue('Happy to help again!')
    await card.get('form').trigger('submit')
    expect(card.text()).toContain('Happy to help again!')
    expect(card.find('.reply .reply-button').exists()).toBe(false)
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(3)
    wrapper.unmount()
  })

  it('does not allow replies on visit reviews', () => {
    const wrapper = mount(ReviewsView)
    const cards = wrapper.findAllComponents(ReviewCard).filter(item => item.props('review').type === 'VISIT')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) expect(card.find('.reply-button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('lets the other participant review the same visit independently', async () => {
    const wrapper = mount(ReviewsView)
    await wrapper.get('.page-heading button').trigger('click')
    let form = wrapper.getComponent(ReviewForm)
    await form.get('select').setValue('visit-101')
    await form.get('textarea').setValue('Excellent sitter.')
    await form.get('input[value="5"]').setValue(true)
    await form.get('form').trigger('submit')
    await wrapper.get('#preview-reviewer').setValue('2')
    await wrapper.get('.page-heading button').trigger('click')
    form = wrapper.getComponent(ReviewForm)
    await form.get('select').setValue('visit-101-owner')
    await form.get('textarea').setValue('Clear instructions from the request maker.')
    await form.get('input[value="4"]').setValue(true)
    await form.get('form').trigger('submit')
    const pair = wrapper.findAllComponents(ReviewCard).map(card => card.props('review')).filter(review => review.visitId === 101 && [1, 2].includes(review.creatorId))
    expect(pair).toHaveLength(2)
    expect(pair.map(review => [review.creatorId, review.receiverId])).toEqual(expect.arrayContaining([[1, 2], [2, 1]]))
    wrapper.unmount()
  })
})
