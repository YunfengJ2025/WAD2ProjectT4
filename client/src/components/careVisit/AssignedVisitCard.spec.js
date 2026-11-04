/* AssignedVisitCard.spec.js
 Care checklist (Carolyn): component tests for the sitter's "Complete visit" pop-up.
 The card receives a visit via props; the checklist, proof photo and submit button
 are inside the pop-up, so each test opens it first.
*/
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import AssignedVisitCard from './AssignedVisitCard.vue'

// The visit is dated today, because proof can only be submitted on the visit day
function makeVisit(notes) {
  return {
    visitId: 1,
    visitDate: new Date().toISOString(),
    status: 'accepted',
    request: { tokenReward: 2, waterSource: 'tap_available' },
    items: [
      {
        requestItemId: 10,
        plantId: 5,
        amountToWater: 200,
        plant: { plantId: 5, plantName: 'Monstera', wateringInfo: { notes: notes } },
      },
    ],
  }
}

// Mounts the card and opens the pop-up.
// teleport: true keeps the pop-up inside the wrapper so find() can see it;
// RouterLink is stubbed because these tests have no router.
async function openVisit(visit) {
  const wrapper = mount(AssignedVisitCard, {
    props: { visit },
    global: { stubs: { teleport: true, RouterLink: true } },
  })
  await wrapper.find('.visit-action').trigger('click')
  return wrapper
}

// Puts a file in the hidden file input and fires its change event
async function choose(wrapper, file) {
  const fileInput = wrapper.find('input[type="file"]')
  Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
  await fileInput.trigger('change')
}

const goodPhoto = () => new File(['x'], 'proof.jpg', { type: 'image/jpeg' })

describe('AssignedVisitCard complete visit pop-up', () => {
  // Verify that each line of the care notes becomes one checkbox.
  it('shows the care notes as checklist steps', async () => {
    const wrapper = await openVisit(makeVisit('Water the soil\nWipe the leaves'))

    expect(wrapper.findAll('.care-checklist input')).toHaveLength(2)
    expect(wrapper.text()).toContain('Water the soil')
    expect(wrapper.text()).toContain('0 of 2 done')
  })

  // Verify that ticking a step updates the count.
  it('counts the ticked steps', async () => {
    const wrapper = await openVisit(makeVisit('Water the soil\nWipe the leaves'))

    await wrapper.findAll('.care-checklist input')[0].setValue(true)

    expect(wrapper.text()).toContain('1 of 2 done')
  })

  // Verify that the owner's instructions for this request are used instead of the plant's notes.
  it('uses the request instructions for the checklist when given', async () => {
    const visit = makeVisit('Water the soil\nWipe the leaves')
    visit.items[0].careInstructions = 'Mist the leaves'
    const wrapper = await openVisit(visit)

    expect(wrapper.findAll('.care-checklist input')).toHaveLength(1)
    expect(wrapper.text()).toContain('Mist the leaves')
    expect(wrapper.text()).not.toContain('Wipe the leaves')
  })

  // Verify that Submit stays disabled until every plant has a photo, with the photo count.
  it('disables submit until every plant has a proof photo', async () => {
    const wrapper = await openVisit(makeVisit(''))
    const submit = wrapper.find('.submit-btn')

    expect(submit.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.photo-progress').text()).toContain('0 of 1 photo')

    await choose(wrapper, goodPhoto())

    expect(wrapper.find('.submit-btn').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.photo-progress').text()).toContain('1 of 1 photo')
    expect(wrapper.find('.upload-btn').text()).toBe('Replace photo')
  })

  // Verify that a non-image file is rejected with a clear message.
  it('rejects a file that is not a JPG, PNG or WebP', async () => {
    const wrapper = await openVisit(makeVisit(''))

    await choose(wrapper, new File(['x'], 'notes.pdf', { type: 'application/pdf' }))

    expect(wrapper.text()).toContain('Use a JPG, PNG or WebP photo')
    expect(wrapper.find('.photo-progress').text()).toContain('0 of 1 photo')
  })

  // Verify that a photo over 2 MB is rejected and its size is shown.
  it('rejects a photo bigger than 2 MB', async () => {
    const wrapper = await openVisit(makeVisit(''))
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })

    await choose(wrapper, big)

    expect(wrapper.text()).toContain('That photo is 3.0 MB')
    expect(wrapper.find('.submit-btn').attributes('disabled')).toBeDefined()
  })

  // Verify that a blank note is sent as "Care done" (the server needs some text).
  it('sends "Care done" when the note is left blank', async () => {
    const wrapper = await openVisit(makeVisit('Water the soil'))
    await choose(wrapper, goodPhoto())
    await wrapper.find('.care-checklist input').setValue(true) // tick the only step

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit-proof')[0][0].actions).toEqual({ 5: 'Care done' })
  })

  // Verify that the visit can't be submitted until every care step is ticked.
  it('blocks submitting until every care step is ticked', async () => {
    const wrapper = await openVisit(makeVisit('Water the soil\nWipe the leaves'))
    await choose(wrapper, goodPhoto())
    await wrapper.findAll('.care-checklist input')[0].setValue(true) // only 1 of 2 ticked
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit-proof')).toBeUndefined()
    expect(wrapper.find('.error').text()).toContain('Tick every care step')

    await wrapper.findAll('.care-checklist input')[1].setValue(true) // now 2 of 2
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit-proof')).toHaveLength(1)
  })

  // Verify that "Opt out" asks the page to opt out (the page shows the "are you sure?" box).
  it('emits opt-out from the footer link', async () => {
    const wrapper = await openVisit(makeVisit(''))

    await wrapper.find('.optout-btn').trigger('click')

    expect(wrapper.emitted('opt-out')).toHaveLength(1)
  })

  // Verify that no checklist shows when the plant has no care notes.
  it('hides the checklist when there are no care notes', async () => {
    const wrapper = await openVisit(makeVisit(''))

    expect(wrapper.find('.care-checklist').exists()).toBe(false)
  })
})
