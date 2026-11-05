// Complete user workflows with Playwright.
// Setup → actions → assertions. API setup creates accounts only; all feature actions use the UI.
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { test as base, expect } from '@playwright/test'

// Shared setup keeps account creation and UI sign-in consistent across care journeys.
export async function registerCareAccount(
  request,
  role,
  suffix = randomUUID().replaceAll('-', '').slice(0, 12),
) {
  const email = `e2e-${role}-${suffix}@example.com`
  const password = `Test-${randomUUID()}!`
  const response = await request.post('/api/user/register', {
    data: {
      userName: `e2e_${role}_${suffix}`,
      email,
      password,
      postalCode: '560123',
      block: '123',
      unitNumber: '#02-01',
      lat: 1.35,
      lng: 103.82,
    },
  })
  expect(response.status(), `Register test ${role}`).toBe(201)
  return { email, password, ...(await response.json()) }
}

export async function signInCareAccount(page, account, path) {
  await page.goto(`/signin?redirect=${encodeURIComponent(path)}`)
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(path)
}

export const test = base.extend({
  care: async ({ browser, request, baseURL }, use) => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const owner = await registerCareAccount(request, 'owner', suffix)
    const sitter = await registerCareAccount(request, 'sitter', suffix)
    const options = { baseURL, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' }
    const ownerContext = await browser.newContext(options)
    const sitterContext = await browser.newContext(options)
    try {
      const ownerPage = await ownerContext.newPage()
      const sitterPage = await sitterContext.newPage()
      ownerPage.setDefaultTimeout(10000)
      sitterPage.setDefaultTimeout(10000)
      await signInCareAccount(ownerPage, owner, '/plants')
      await signInCareAccount(sitterPage, sitter, '/my-sits')
      await use({ ownerPage, sitterPage, owner, sitter, plantName: `E2E Plant ${suffix}` })
    } finally {
      await ownerContext.close()
      await sitterContext.close()
    }
  },
})

export function singaporeDate(days = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}
export function requestCard(page, plantName) {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: plantName, exact: true }) })
}
export function historyCard(page, plantName) {
  return page.getByRole('article').filter({ hasText: plantName })
}

export async function addPlantAndRequest({ ownerPage, plantName }, date) {
  await test.step('Owner adds an outdoor plant through the plant form', async () => {
    await ownerPage.goto('/plants/new')
    await ownerPage.getByRole('textbox', { name: 'Plant name', exact: true }).fill(plantName)
    await ownerPage
      .getByRole('textbox', { name: 'Where to find it', exact: true })
      .fill('Sheltered corridor beside door')
    await ownerPage.getByRole('radio', { name: 'Outside my door', exact: true }).check()
    await ownerPage.getByRole('radio', { name: 'Sheltered', exact: true }).check()
    await ownerPage.getByRole('spinbutton', { name: 'Water every', exact: true }).fill('1')
    await ownerPage.getByRole('spinbutton', { name: 'Amount', exact: true }).fill('200')
    // Never watered: first visit is due on the chosen request date.
    await ownerPage.getByLabel('Last watered', { exact: false }).fill('')
    await ownerPage
      .getByLabel('Care notes', { exact: false })
      .fill('Water the soil\nWipe the leaves')
    await ownerPage.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(ownerPage).toHaveURL('/plants')
    await expect(ownerPage.getByRole('link', { name: plantName, exact: true })).toBeVisible()
  })
  await test.step('Owner posts a one-visit request', async () => {
    await ownerPage.goto('/requests')
    await ownerPage.getByRole('link', { name: '+ New Request', exact: true }).click()
    await ownerPage.getByRole('button', { name: plantName, exact: false }).click()
    await ownerPage.getByLabel('Start date', { exact: true }).fill(date)
    await ownerPage.getByLabel('End date', { exact: true }).fill(date)
    await ownerPage.getByLabel('Reward per visit (tokens)').fill('2')
    await ownerPage.getByLabel('Water left outside', { exact: true }).check()
    await ownerPage.getByLabel('Note', { exact: true }).fill('Please use the side gate')
    await expect(ownerPage.getByRole('button', { name: 'Post request', exact: true })).toBeEnabled()
    await ownerPage.getByRole('button', { name: 'Post request', exact: true }).click()
    await expect(
      ownerPage.getByRole('status').filter({ hasText: 'Request #' }).filter({ hasText: 'posted.' }),
    ).toBeVisible()
    await ownerPage.getByRole('link', { name: '← My requests', exact: true }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('waiting for a sitter')
  })
}
export async function acceptRequest({ sitterPage, owner, plantName }, date) {
  await test.step('Sitter finds and accepts the request on the map page', async () => {
    await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
    await sitterPage.getByLabel('Filter requests by date').fill(date)
    await sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }).click()
    await expect(sitterPage.getByText(plantName, { exact: true })).toBeVisible()
    await sitterPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(
      sitterPage.getByRole('status').filter({ hasText: 'You accepted the visit' }),
    ).toBeVisible()
    await sitterPage.getByRole('link', { name: 'View in My Sits', exact: false }).click()
    await expect(requestCard(sitterPage, plantName)).toBeVisible()
  })
}

export { expect }
// Database writes are opt-in.
test.skip(process.env.E2E_LIVE !== '1', 'Set E2E_LIVE=1 with a disposable local backend')
test.setTimeout(120_000)
