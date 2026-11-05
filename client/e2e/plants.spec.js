// plants.spec.js
// E2E test for My Plants: add a plant, mark it watered, edit it, then delete it.
// The plant gets a unique name each run and is deleted at the end, so the test can be repeated.
import process from 'node:process'
import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: process.env.E2E_EMAIL || 'sitter.test@leafittous.sg',
  password: process.env.E2E_PASSWORD || 'Sitter123!',
}

test('adds a plant, marks it watered, edits it and deletes it', async ({ page }) => {
  const plantName = `E2E Fern ${Date.now()}`
  const newName = `${plantName} renamed`

  // (1) setup: sign in and open My Plants
  await page.goto('/signin?redirect=/plants')
  await page.getByLabel('Email', { exact: true }).fill(TEST_USER.email)
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My Plants', exact: true })).toBeVisible()

  // ---------- Add ----------
  await page.getByRole('link', { name: '+ Add plant', exact: true }).click()
  await page.getByLabel('Plant name').fill(plantName)
  await page.getByLabel('Outside my door').check()
  await page.getByLabel('Where to find it').fill('Corridor ledge')
  await page.getByLabel('Sheltered').check()
  await page.getByLabel('Water every').fill('3')
  await page.getByLabel('Amount').fill('200')
  await page.getByLabel('Care notes').fill('Water the soil\nWipe the leaves')
  // Last watered 5 days ago (it is watered every 3 days), so the plant is overdue
  await page.getByLabel('Last watered').fill(daysAgo(5))

  // The live preview updates while typing
  await expect(page.getByLabel('Live preview')).toContainText(plantName)

  await page.getByRole('button', { name: 'Confirm', exact: true }).click()

  // Back on My Plants: the new plant's card shows its 2 care steps
  await expect(page).toHaveURL(/\/plants$/)
  const card = page.getByRole('article').filter({ hasText: plantName })
  await expect(card).toBeVisible()
  await expect(card).toContainText('2 care steps')

  // ---------- Mark watered ----------
  // The plant is overdue, so it can be watered straight away (no "water early?" question)
  await card.getByRole('button', { name: 'Mark watered', exact: true }).click()
  await expect(page.getByText(`${plantName} watered`)).toBeVisible()
  await expect(card.getByRole('button', { name: 'Watered today ✓' })).toBeDisabled()

  // ---------- Edit ----------
  await card.getByRole('link', { name: `Edit ${plantName}` }).click()
  await expect(page.getByLabel('Plant name')).toHaveValue(plantName)
  await page.getByLabel('Plant name').fill(newName)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Changes saved')).toBeVisible()

  // The new name is shown on My Plants
  await page.getByRole('link', { name: 'My Plants', exact: true }).click()
  const renamedCard = page.getByRole('article').filter({ hasText: newName })
  await expect(renamedCard).toBeVisible()

  // ---------- Delete ----------
  await renamedCard.getByRole('button', { name: `Delete ${newName}` }).click()
  // "Are you sure?" pop-up: confirm
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()

  // (3) assert: the plant is gone
  await expect(page.getByText(`${newName} deleted`)).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: newName })).toHaveCount(0)
})

// "YYYY-MM-DD" for n days before today (the format a date input uses)
function daysAgo(n) {
  const day = new Date()
  day.setDate(day.getDate() - n)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
