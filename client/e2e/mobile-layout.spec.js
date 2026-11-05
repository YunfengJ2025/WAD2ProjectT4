import { test, expect } from '@playwright/test'

// Isolated display fixtures: no real accounts, plants or visits are changed.
async function seedDisplay(page) {
  await page.addInitScript(() => sessionStorage.setItem('leaf-access-token', 'layout-test'))
  const user = { userId: 1, userName: 'Aye Chan', email: 'layout@example.com', bio: '',
    postalCode: '528566', block: '123A', unitNumber: '#12-3456', tokenBalance: 50,
    tokenReservations: [], badges: [], createdAt: '2026-01-01T00:00:00Z' }
  const plants = ['MoneyPlant', 'Orchid', '[Test] Overdue Peace Lily', '[Test] Overdue Fern', '[Test] Overdue Cactus'].map((plantName, i) => ({
    plantId: i + 1, ownerId: 1, plantName, plantLocation: 'By the door', isOutdoor: true,
    photoUrl: '', wateringInfo: { frequencyDays: 2, amountMl: 100, notes: 'Water the soil' },
    lastWateredAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdAt: '2026-01-01T00:00:00Z',
  }))
  const makeVisit = (visitId, selected, status) => ({ visitId, status,
    visitDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    plants: selected, request: { requestId: 1, tokenReward: 10, waterSource: 'bring_own' },
    owner: user,
    items: selected.map((plant) => ({ requestItemId: plant.plantId, plantId: plant.plantId,
      plant, status, amountToWater: 100, careInstructions: 'Water the soil' })),
  })
  const assigned = makeVisit(1, [plants[0]], 'accepted')
  const history = makeVisit(2, plants.slice(0, 2), 'missed')
  const leaderboard = Array.from({ length: 41 }, (_, i) => ({
    id: i === 38 ? 1 : i + 2,
    name: i === 38 ? user.userName : i % 2 ? `e2e_owner_868369bc44f4_${i}` : `Neighbour ${i + 1}`,
    ratingAverage: 4.6, availableTokens: 150 - i * 3,
  }))
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    const data = {
      '/user/me': { user }, '/notifications': { notifications: [] },
      '/plants': { plants }, '/review/me': { reviews: [] }, '/post/me': [],
      '/token/user/1': [], '/care-visits/assignments': { visits: [assigned] },
      '/care-visits': { visits: [history] }, '/care-visits/available': { visits: [] },
      '/care-requests': { requests: [] },
      '/plants/1': { plant: plants[0], inActiveRequest: false },
      '/api/leaderboard': { leaderboard },
      '/api/leaderboard/status/1': { hideFromLeaderboard: false },
    }
    return route.fulfill({ json: data[path] || {} })
  })
  await page.route('https://api-open.data.gov.sg/**', (route) => route.fulfill({ json: { data: { items: [] } } }))
}

async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test.describe('phone layouts', () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  for (const width of [320, 390, 430]) {
    test(`profile, sits and garden remain readable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await seedDisplay(page)
      await page.goto('/profile')
      await expect(page.locator('.identity-card')).toBeVisible()
      await expect(page.locator('nav').getByRole('button', { name: 'Go back', exact: true })).toHaveCount(0)
      await expect(page.locator('.sidebar-note')).toBeHidden()
      const nav = await page.locator('.profile-sidebar nav').boundingBox()
      expect(nav.height).toBeLessThan(150)
      const identity = await page.locator('.identity-card').boundingBox()
      expect(identity.y).toBeLessThan(350)
      await noHorizontalOverflow(page)
      // All six profile sections remain reachable in the compact phone menu.
      await page.getByRole('link', { name: 'My badges', exact: true }).click()
      await expect(page).toHaveURL(/#profile-badges$/)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath('profile-phone.png') })

      await page.goto('/my-sits')
      await expect(page.locator('.visit-card')).toBeVisible()
      const title = await page.locator('.heading-text h3').boundingBox()
      const lineHeight = await page.locator('.heading-text h3').evaluate((element) => parseFloat(getComputedStyle(element).lineHeight))
      expect(title.height).toBeLessThan(lineHeight * 1.5) // MoneyPlant is one line.
      const images = page.locator('.history-card .plant-strip img')
      const first = await images.nth(0).boundingBox()
      const second = await images.nth(1).boundingBox()
      expect(Math.abs(first.x - second.x)).toBeLessThan(1)
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
      expect(await page.locator('.plant-names').evaluate((element) =>
        element.scrollHeight <= element.clientHeight + 1)).toBe(true)
      await noHorizontalOverflow(page)
      await page.screenshot({ path: testInfo.outputPath('sits-phone.png'), fullPage: true })

      // Back uses app navigation and a directly opened page has a safe fallback.
      await page.getByRole('button', { name: 'Toggle navigation' }).click()
      await page.getByRole('link', { name: 'My Plants', exact: true }).click()
      await expect(page).toHaveURL('/plants')
      const card = page.locator('.grid .card').first()
      await expect(card).toBeVisible()
      expect((await card.boundingBox()).height).toBeLessThan(280)
      const list = page.getByRole('list', { name: 'Plants needing water' })
      expect((await list.boundingBox()).height).toBeLessThanOrEqual(225)
      expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
      await card.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('compact-plants-phone.png') })
      await card.getByRole('link', { name: 'MoneyPlant', exact: true }).click()
      await expect(page).toHaveURL('/plants/1')
      await expect(page.locator('main').getByRole('button', { name: 'Go back', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Go back', exact: true }).click()
      await expect(page).toHaveURL('/plants')
      await page.goto('/plants/new')
      await expect(page.locator('.plant-form')).toBeVisible()
      await expect(page.locator('.preview-card')).toBeHidden()
      const heading = await page.locator('.form-head h1').boundingBox()
      const basics = await page.getByLabel('Plant name', { exact: false }).boundingBox()
      expect(basics.y - heading.y).toBeLessThan(200)
      await noHorizontalOverflow(page)
      await page.screenshot({ path: testInfo.outputPath('add-plant-phone.png') })
      await page.getByRole('button', { name: 'Show preview', exact: true }).click()
      await expect(page.locator('.preview-card')).toBeVisible()
      await page.goto('/plants/1/edit')
      await expect(page.getByLabel('Plant name', { exact: false })).toHaveValue('MoneyPlant')
      await expect(page.locator('main').getByRole('button', { name: 'Go back', exact: true })).toBeVisible()
      await page.goto('/plants')
      await page.getByRole('button', { name: /Garden/, exact: false }).click()
      await expect(page.locator('.garden')).toBeVisible()
      await noHorizontalOverflow(page)
      const row = page.locator('.plant-list li').last()
      await row.scrollIntoViewIfNeeded()
      const name = await row.locator('.list-name').boundingBox()
      const water = await row.getByRole('button').boundingBox()
      expect(water.y).toBeGreaterThan(name.y + name.height)
      expect(water.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: testInfo.outputPath('garden-phone.png') })
    })
  }
})

test('desktop keeps the sidebar and horizontal visit photos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedDisplay(page)
  await page.goto('/profile')
  await expect(page.locator('.identity-card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Go back', exact: true })).toBeHidden()
  const sidebar = await page.locator('.profile-sidebar').boundingBox()
  const content = await page.locator('.profile-content').boundingBox()
  expect(content.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width)
  await page.goto('/my-sits')
  const images = page.locator('.history-card .plant-strip img')
  await expect(images).toHaveCount(2)
  const first = await images.nth(0).boundingBox()
  const second = await images.nth(1).boundingBox()
  expect(second.x).toBeGreaterThan(first.x)
  expect(Math.abs(first.y - second.y)).toBeLessThan(1)
})

for (const width of [320, 432]) {
  test(`leaderboard gives names and metrics separate lines at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await seedDisplay(page)
    await page.goto('/leaderboard')
    await expect(page.locator('.lb-row')).toHaveCount(41)
    await noHorizontalOverflow(page)
    const row = page.locator('.lb-row').nth(31)
    await row.scrollIntoViewIfNeeded()
    const name = await row.locator('.lb-name').boundingBox()
    const rating = await row.locator('.lb-rating').boundingBox()
    const tokens = await row.locator('.lb-tokens').boundingBox()
    const avatar = await row.locator('.lb-avatar-img').boundingBox()
    const rank = await row.locator('.lb-rank').boundingBox()
    expect(rating.y).toBeGreaterThanOrEqual(name.y + name.height)
    expect(tokens.x).toBeGreaterThanOrEqual(rating.x + rating.width)
    expect(avatar.x).toBeGreaterThanOrEqual(rank.x + rank.width)
    expect(name.x).toBeGreaterThanOrEqual(avatar.x + avatar.width)
    await expect(page.locator('.lb-me .you-tag')).toHaveText('You')
    await page.locator('.lb-me').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('leaderboard-phone.png') })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(row).toHaveCSS('display', 'flex')
    await expect(row.locator('.mobile-metric-label').first()).toBeHidden()
  })
}
