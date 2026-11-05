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
  await expect(page).toHaveURL('/plants')
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

test('cannot delete a plant (or the account) while the plant is in an active care request', async ({
  page,
}) => {
  const unique = Date.now()
  const plantName = `E2E Locked ${unique}`
  const password = 'Test-password-123'

  // (1) setup: a fresh account gets 50 starter tokens, so it can always post a request.
  // It is deleted at the end, together with anything it created.
  await page.goto('/register')
  await page.getByLabel('Username', { exact: true }).fill(`e2e_lock_${unique}`)
  await page.getByLabel('Email', { exact: true }).fill(`e2e-lock-${unique}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Postal code', { exact: true }).fill('560123')
  await page.getByLabel('Block', { exact: true }).fill('123')
  await page.getByLabel('Unit number', { exact: true }).fill('#02-01')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/schedule')

  // Add an outdoor plant (only outdoor plants can be requested)
  await page.getByRole('link', { name: 'My Plants', exact: true }).click()
  await page.getByRole('link', { name: '+ Add plant', exact: true }).click()
  await page.getByLabel('Plant name').fill(plantName)
  await page.getByLabel('Outside my door').check()
  await page.getByLabel('Where to find it').fill('Corridor ledge')
  await page.getByLabel('Sheltered').check()
  await page.getByLabel('Water every').fill('1')
  await page.getByLabel('Amount').fill('100')
  await page.getByLabel('Last watered').fill(daysAgo(2))
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('article').filter({ hasText: plantName })).toBeVisible()

  // (2) actions: post a one-day care request for this plant (tomorrow, 1 token)
  await page.getByRole('link', { name: 'My Requests', exact: true }).click()
  await page.getByRole('link', { name: '+ New Request', exact: true }).click()
  await page.getByRole('button', { name: plantName, exact: false }).click()
  await page.getByLabel('Start date', { exact: true }).fill(daysAgo(-1))
  await page.getByLabel('End date', { exact: true }).fill(daysAgo(-1))
  await page.getByLabel('Reward per visit (tokens)').fill('1')
  await page.getByLabel('Water left outside', { exact: true }).check()
  await page.getByRole('button', { name: 'Post request', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Request #' }).filter({ hasText: 'posted.' }),
  ).toBeVisible()

  // (3) assert: deleting from the My Plants card is refused by the server
  await page.getByRole('link', { name: 'My Plants', exact: true }).click()
  const card = page.getByRole('article').filter({ hasText: plantName })
  await card.getByRole('button', { name: `Delete ${plantName}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(
    page.getByText('This plant is in an active care request', { exact: false }),
  ).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(card).toBeVisible()

  // (3) assert: on the plant's page, Delete is disabled and the 🔒 reason is shown
  await card.getByRole('link', { name: plantName, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
  await expect(page.getByText("so it can't be deleted", { exact: false })).toBeVisible()

  // (3) assert: the account can't be deleted either while the request is active
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  await page.getByLabel('Enter your password to confirm').fill(password)
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('You still have 1 active care request')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  // ---------- Cancel the request, then the plant can be deleted ----------
  await page.getByRole('link', { name: 'My Requests', exact: true }).click()
  const requestCard = page.getByRole('article').filter({ hasText: plantName })
  page.once('dialog', (dialog) => dialog.accept()) // "Cancel the request?" browser box
  await requestCard.getByRole('button', { name: 'Cancel request', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Request #' }).filter({ hasText: 'cancelled.' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'My Plants', exact: true }).click()
  await page
    .getByRole('article')
    .filter({ hasText: plantName })
    .getByRole('link', { name: plantName, exact: true })
    .click()
  const deleteButton = page.getByRole('button', { name: 'Delete', exact: true })
  await expect(deleteButton).toBeEnabled()
  await deleteButton.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(`${plantName} deleted`)).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: plantName })).toHaveCount(0)

  // ---------- Clean up: delete the test account (allowed now, nothing is active) ----------
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  await page.getByLabel('Enter your password to confirm').fill(password)
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
  await expect(page).toHaveURL('/')
})

// "YYYY-MM-DD" for n days before today (the format a date input uses)
function daysAgo(n) {
  const day = new Date()
  day.setDate(day.getDate() - n)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
