import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { test, expect } from '@playwright/test'

// Real frontend + backend + database. Run against a disposable local test database.
test.describe('Owner request → map acceptance → My Sits', () => {
  // Database writes are intentionally opt-in for the normal E2E suite.
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(process.env.E2E_LIVE !== '1', 'Set E2E_LIVE=1 with the local test backend running')

  test('keeps every accepted visit in the sitter’s account after reloading', async ({
    browser,
    request,
    baseURL,
  }) => {
    test.setTimeout(90_000)
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const password = `Test-${randomUUID()}!`
    const plantName = `E2E Fern ${suffix}`
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const next = new Date(`${today}T12:00:00+08:00`)
    next.setUTCDate(next.getUTCDate() + 1)
    const tomorrow = next.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

    // Arrange through the real API; the workflow under test starts with request creation.
    async function register(role) {
      const email = `e2e-${role}-${suffix}@example.com`
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
      expect(response.status(), `Register ${role} on the test backend`).toBe(201)
      return { email, ...(await response.json()) }
    }
    const owner = await register('owner')
    const sitter = await register('sitter')
    const plantResponse = await request.post('/api/plants', {
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      multipart: {
        plantName,
        plantLocation: 'Sheltered corridor',
        frequencyDays: '1',
        amountMl: '200',
        notes: 'Water the soil\nWipe the leaves',
        isOutdoor: 'true',
        rainExposed: 'false',
        weatherAdjustmentEnabled: 'false',
      },
    })
    expect(plantResponse.status(), 'Create the owner’s outdoor plant').toBe(201)

    const ownerContext = await browser.newContext({
      baseURL,
      timezoneId: 'Asia/Singapore',
      reducedMotion: 'reduce',
    })
    const sitterContext = await browser.newContext({
      baseURL,
      timezoneId: 'Asia/Singapore',
      reducedMotion: 'reduce',
    })
    try {
      const ownerPage = await ownerContext.newPage()
      const sitterPage = await sitterContext.newPage()
      async function signIn(page, account, destination) {
        await page.goto(`/signin?redirect=${encodeURIComponent(destination)}`)
        await page.getByLabel('Email', { exact: true }).fill(account.email)
        await page.getByLabel('Password', { exact: true }).fill(password)
        await page.getByRole('button', { name: 'Sign in', exact: true }).click()
        await expect(page).toHaveURL(new RegExp(`${destination}$`))
      }

      await test.step('Owner posts a two-day request from My Requests', async () => {
        await signIn(ownerPage, owner, '/requests')
        await ownerPage.getByRole('link', { name: '+ New Request', exact: true }).click()
        await ownerPage.getByRole('button', { name: new RegExp(plantName) }).click()
        await ownerPage.getByLabel('Start date', { exact: true }).fill(today)
        await ownerPage.getByLabel('End date', { exact: true }).fill(tomorrow)
        await ownerPage.getByLabel('Reward per visit (tokens)').fill('2')
        await ownerPage.getByLabel('Water left outside', { exact: true }).check()
        await ownerPage.getByLabel('Note', { exact: true }).fill(`Use side gate ${suffix}`)
        await expect(ownerPage.getByText('2 visits over 2 days.', { exact: false })).toBeVisible()
        await ownerPage.getByRole('button', { name: 'Post request', exact: true }).click()
        await expect(
          ownerPage.getByRole('status').filter({ hasText: /Request #\d+ posted/ }),
        ).toContainText(/Request #\d+ posted/)
        await ownerPage.getByRole('link', { name: '← My requests', exact: true }).click()
        await expect(ownerPage.getByRole('heading', { name: plantName, exact: true })).toBeVisible()
      })

      await test.step('Sitter accepts today’s visit through Find nearby', async () => {
        await signIn(sitterPage, sitter, '/my-sits')
        await expect(
          sitterPage.getByText('You have no accepted visits yet.', { exact: false }),
        ).toBeVisible()
        await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
        await expect(
          sitterPage.getByRole('heading', { name: 'Find nearby', exact: true }),
        ).toBeVisible()
        await sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }).click()
        await expect(sitterPage.getByText(plantName, { exact: true })).toBeVisible()
        await expect(sitterPage.getByText(`Use side gate ${suffix}`, { exact: true })).toBeVisible()
        await sitterPage.getByRole('button', { name: 'Accept request', exact: true }).click()
        await expect(
          sitterPage.getByRole('status').filter({ hasText: 'You accepted the visit' }),
        ).toContainText('You accepted the visit')
        await expect(
          sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }),
        ).toHaveCount(0)
        await sitterPage.getByRole('link', { name: 'View in My Sits', exact: false }).click()
        await expect(sitterPage.getByRole('heading', { name: plantName, exact: true })).toHaveCount(
          1,
        )
      })

      await test.step('Sitter accepts the remaining visit through Find requests', async () => {
        await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
        await sitterPage.getByRole('button', { name: 'See all requests', exact: true }).click()
        await expect(
          sitterPage.getByRole('heading', { name: 'Find requests', exact: true }),
        ).toBeVisible()
        await sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }).click()
        await sitterPage.locator('.requestCard').click()
        await expect(sitterPage.getByText(plantName, { exact: true })).toBeVisible()
        await sitterPage.getByRole('button', { name: 'Accept request', exact: true }).click()
        await expect(
          sitterPage.getByRole('status').filter({ hasText: 'You accepted the visit' }),
        ).toContainText('You accepted the visit')
        await sitterPage.getByRole('link', { name: 'View in My Sits', exact: false }).click()
      })

      await test.step('My Sits shows both accepted visits after reload, only for the sitter', async () => {
        await expect(
          sitterPage.getByRole('heading', { name: 'My Sits', exact: true }),
        ).toBeVisible()
        const cards = sitterPage
          .getByRole('article')
          .filter({ has: sitterPage.getByRole('heading', { name: plantName, exact: true }) })
        await expect(cards).toHaveCount(2)
        await expect(cards.filter({ hasText: 'Due today' })).toHaveCount(1)
        await expect(cards.filter({ hasText: 'Tomorrow' })).toHaveCount(1)
        await sitterPage.reload()
        await expect(cards).toHaveCount(2)
        await ownerPage.goto('/my-sits')
        await expect(
          ownerPage.getByText('You have no accepted visits yet.', { exact: false }),
        ).toBeVisible()
        await expect(ownerPage.getByRole('heading', { name: plantName, exact: true })).toHaveCount(
          0,
        )
        await ownerPage.goto('/requests')
        const ownerCard = ownerPage.getByRole('article').filter({ hasText: plantName })
        await expect(ownerCard).toContainText('sitter found')
      })
    } finally {
      await ownerContext.close()
      await sitterContext.close()
    }
  })
})
