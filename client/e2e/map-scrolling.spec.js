import { test, expect } from '@playwright/test'

// Layout checks use API fixtures and do not write to the database.
test.use({ viewport: { width: 393, height: 852 } })

for (const mode of ['Find nearby', 'Find requests']) {
  test(mode + ' contains long-list scrolling and shrinks after filtering', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const nextDay = new Date(today + 'T12:00:00+08:00')
    nextDay.setDate(nextDay.getDate() + 1)
    const tomorrow = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const visits = Array.from({ length: 4 }, (_, index) => ({
      visitId: index + 1, requestId: index + 1, ownerId: index + 2,
      ownerName: 'Gardener ' + index, address: 'Blk ' + index,
      visitDate: index === 3 ? tomorrow : today,
      date: index === 3 ? tomorrow : today,
      startDate: today, endDate: tomorrow,
      lat: 1.35, lng: 103.82, distanceKm: 0.2,
      plants: [{ plantId: index + 1, plantName: 'Fern' }],
    }))
    await page.addInitScript(() => sessionStorage.setItem('leaf-access-token', 'layout-test-token'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const path = new URL(route.request().url()).pathname
      let body = { notifications: [], unreadCount: 0 }
      if (path.endsWith('/user/me')) body = { user: { userId: 1, userName: 'Tester' } }
      if (path.endsWith('/find-nearby')) body = { origin: { lat: 1.35, lng: 103.82 }, visits }
      await route.fulfill({ json: body })
    })
    await page.goto('/find-nearby')
    // These two cases exercise the same layout through its two entry modes.
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (mode === 'Find requests') {
      await page.getByRole('button', { name: 'See all requests', exact: true }).click()
    }
    const results = page.getByRole('region', { name: 'Plant care requests' })
    await expect(results.locator('.requestCard')).toHaveCount(mode === 'Find requests' ? 4 : 3)
    await expect(results).toHaveClass('requests is-scrollable')
    await results.hover()
    const pageBefore = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 250)
    await expect.poll(() => results.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(pageBefore)

    // Start near the bottom, then overscroll: the page must stay in place.
    await results.evaluate((node) => { node.scrollTop = node.scrollHeight - node.clientHeight - 30 })
    await page.mouse.wheel(0, 400)
    await expect.poll(() => results.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(2)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    expect(await page.evaluate(() => window.scrollY)).toBe(pageBefore)
    const gap = await page.evaluate(() => document.querySelector('.requests').getBoundingClientRect().top - document.querySelector('.mapArea').getBoundingClientRect().bottom)
    expect(gap).toBeGreaterThanOrEqual(16)

    await page.getByLabel('Filter requests by date').fill(tomorrow)
    await expect(results.locator('.requestCard')).toHaveCount(1)
    await expect(results).toHaveClass('requests')
    expect(await results.evaluate((node) => node.clientHeight)).toBeLessThan(400)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await results.hover()
    const shortListPageY = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, -200)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(shortListPageY)
  })
}
