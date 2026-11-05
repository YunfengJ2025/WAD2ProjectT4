import { test, expect } from '@playwright/test'

// These layout checks use browser-only API fixtures and never change the database.
const longName = 'Responsive audit plant with an exceptionally long name 1793863532651'
const user = {
  userId: 1, userName: 'VeryLongUnbrokenGardenerUsernameForLayoutChecks',
  email: 'layout@example.com', tokenBalance: 50, availableTokens: 50,
  badges: [], createdAt: '2026-01-01', neighbourhood: 'Ang Mo Kio',
}
const plants = [{
  plantId: 1, plantName: longName,
  plantLocation: 'Outside the door beside the corridor shoe rack with a long location',
  isOutdoor: true, wateringInfo: { frequencyDays: 1, amountMl: 200, notes: 'Water soil\nWipe leaves' },
  lastWateredAt: null,
}]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('leaf-access-token', 'layout-test-token'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    let body = {}
    if (path === '/user/me') body = { user }
    else if (path === '/plants') body = { plants }
    else if (path === '/api/leaderboard') body = {
      leaderboard: [1, 2, 3].map((id) => ({
        id, name: id === 1 ? user.userName : `AnotherLongUnbrokenGardenerUsername${id}`,
        availableTokens: 12345, ratingAverage: 4.9,
      })),
    }
    else if (path.startsWith('/api/dashboard/stats/')) body = { user, stats: {}, badges: [] }
    else if (path.startsWith('/api/dashboard/charts/')) body = { activityChart: null, tokenFlowChart: null }
    else if (path.includes('/status/')) body = { hideFromLeaderboard: false }
    else body = { posts: [], reviews: [], visits: [], notifications: [], unreadCount: 0 }
    await route.fulfill({ json: body })
  })
  await page.route('https://api-open.data.gov.sg/**', (route) => route.abort())
})

async function expectNoPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
}

for (const width of [320, 375, 390]) {
  test(`pages fit and profile action receives clicks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 375 ? 812 : 844 })
    await page.goto('/plants')
    await expect(page.locator('.my-plants .card')).toHaveCount(1)
    await expectNoPageOverflow(page)
    for (const action of ['.water-btn', '.icon-btn']) {
      for (const button of await page.locator(`.my-plants .card ${action}`).all()) {
        const bounds = await button.boundingBox()
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      }
    }

    await page.goto('/dashboard')
    await expect(page.getByText('Community Achievements')).toBeVisible()
    await expectNoPageOverflow(page)

    await page.goto('/leaderboard')
    await expect(page.locator('.lb-row')).toHaveCount(3)
    await expectNoPageOverflow(page)
    for (const row of await page.locator('.lb-row').all()) {
      const name = await row.locator('.lb-name').boundingBox()
      const rating = await row.locator('.lb-rating').boundingBox()
      expect(name.x + name.width).toBeLessThanOrEqual(rating.x + 1)
    }

    await page.goto('/profile')
    const explore = page.getByRole('link', { name: 'Explore Badges' })
    await expect(explore).toBeVisible()
    await explore.scrollIntoViewIfNeeded()
    await expectNoPageOverflow(page)
    await explore.click() // Fails if sticky navigation intercepts the pointer.
    await expect(page).toHaveURL(/\/dashboard$/)
  })
}

test('tablet calendar wraps full plant names within their cards', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/schedule')
  const calendar = page.locator('.week:visible')
  await expect(calendar).toBeVisible()
  // Open status groups to exercise the cards inside the narrow day columns.
  for (const button of await calendar.locator('.group-strip[aria-expanded="false"]').all()) {
    await button.click()
  }
  const names = calendar.locator('.plant-name')
  await expect(names.first()).toBeVisible()
  for (const name of await names.all()) {
    expect(await name.textContent()).toBe(longName)
    expect(await name.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  }
  await expectNoPageOverflow(page)
})
